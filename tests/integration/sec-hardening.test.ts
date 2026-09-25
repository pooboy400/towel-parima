/**
 * Integration — تست مستقیم SEC-05/06/07 + هدر Retry-After (شکاف پوشش 55-d)
 * ---------------------------------------------------------------
 * - SEC-05: /api/csp-report — سقف بدنه با Content-Length و مسیر chunked
 *   (CR-5: خواندن bounded از stream — سرریز = cancel، بدون بافر کامل)
 * - SEC-06: publicApi روی health/media-file — سقف دقیق + هدر Retry-After (CR-7)
 * - SEC-07: گارد درگاه mock — بدون اثبات «یافت نشد»؛ کوکی اثبات درست → جزئیات
 * اجرا: DATABASE_URL=... bun test tests/integration/sec-hardening.test.ts
 */
import { describe, expect, it, afterAll } from "bun:test";
import { createHash } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { POST as cspReportPOST } from "../../src/app/api/csp-report/route";
import { GET as healthGET } from "../../src/app/api/health/route";
import { GET as mediaGET } from "../../src/app/api/media/file/[...path]/route";
import { GET as searchGET } from "../../src/app/api/search/route";
import { GET as gatewayGET } from "../../src/app/mock-gateway/route";
import { paidProofValue } from "../../src/core/commerce/checkout-service";

const DATABASE_URL =
  process.env.DATABASE_URL ?? "postgresql://prima:prima_dev_only@127.0.0.1:5432/prima?schema=public";
const db = new PrismaClient({ datasources: { db: { url: DATABASE_URL } } });

/** نوع پارامتر هندلرها (بدون import ران‌تایم next/server در تست) */
type CspReq = Parameters<typeof cspReportPOST>[0];
type HealthReq = Parameters<typeof healthGET>[0];
type MediaReq = Parameters<typeof mediaGET>[0];
type SearchReq = Parameters<typeof searchGET>[0];
type GatewayReq = Parameters<typeof gatewayGET>[0];

/** Request استاندارد وب — هندلرها فقط headers/body/url مصرف می‌کنند */
function plainRequest<T>(url: string, init?: RequestInit): T {
  return new Request(url, init) as unknown as T;
}

/** درگاه mock به request.cookies نیاز دارد — فیک مینیمال */
function gatewayRequest(authority: string, proof?: string): GatewayReq {
  return {
    url: `http://localhost/mock-gateway?authority=${encodeURIComponent(authority)}`,
    cookies: {
      get: (name: string) =>
        name === "prima_pay_proof" && proof ? { name, value: proof } : undefined,
    },
  } as unknown as GatewayReq;
}

/** روت search از request.nextUrl.searchParams استفاده می‌کند — nextUrl را اضافه می‌کنیم */
function searchRequest(q?: string): SearchReq {
  const url = `http://localhost/api/search${q ? `?q=${encodeURIComponent(q)}` : ""}`;
  const req = new Request(url);
  Object.defineProperty(req, "nextUrl", { value: new URL(url) });
  return req as unknown as SearchReq;
}

/** شنود موقت console.log برای ادعای «بدون لاگ»/«+۱ لاگ» */
function captureConsoleLog() {
  const lines: string[] = [];
  const original = console.log;
  console.log = (...args: unknown[]) => {
    lines.push(args.map((a) => (typeof a === "string" ? a : JSON.stringify(a))).join(" "));
  };
  return { lines, restore: () => { console.log = original; } };
}

// ────────────────────────── SEC-05 — csp-report ──────────────────────────

describe("SEC-05 — سقف /api/csp-report", () => {
  it("بدنهٔ ~110KB با Content-Length → 204 بدون هیچ لاگ", async () => {
    const big = "x".repeat(110 * 1024);
    const cap = captureConsoleLog();
    try {
      const res = await cspReportPOST(
        plainRequest<CspReq>("http://localhost/api/csp-report", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ "csp-report": { junk: big } }),
        }),
      );
      expect(res.status).toBe(204);
      expect(cap.lines.some((l) => l.includes("csp_violation"))).toBe(false);
    } finally {
      cap.restore();
    }
  }, 20_000);

  it("بدنهٔ chunked ۱۰۰KB بدون Content-Length → 204 بدون لاگ (خواندن bounded — CR-5)", async () => {
    const big = JSON.stringify({ "csp-report": { junk: "y".repeat(100 * 1024) } });
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const bytes = new TextEncoder().encode(big);
        for (let i = 0; i < bytes.length; i += 8192) {
          controller.enqueue(bytes.slice(i, i + 8192));
        }
        controller.close();
      },
    });
    const cap = captureConsoleLog();
    try {
      const res = await cspReportPOST(
        plainRequest<CspReq>("http://localhost/api/csp-report", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: stream,
          duplex: "half",
        } as RequestInit),
      );
      expect(res.status).toBe(204);
      // نه لاگ کامل و نه متادیتا — هم‌رفتار مسیر Content-Length (ضد log flooding)
      expect(cap.lines.some((l) => l.includes("csp_violation"))).toBe(false);
    } finally {
      cap.restore();
    }
  }, 20_000);

  it("بدنهٔ سالم کوچک → 204 با دقیقاً یک لاگ csp_violation", async () => {
    const cap = captureConsoleLog();
    try {
      const res = await cspReportPOST(
        plainRequest<CspReq>("http://localhost/api/csp-report", {
          method: "POST",
          headers: { "content-type": "application/csp-report" },
          body: JSON.stringify({ "csp-report": { "blocked-uri": "https://evil.example" } }),
        }),
      );
      expect(res.status).toBe(204);
      const hits = cap.lines.filter((l) => l.includes('"type":"csp_violation"'));
      expect(hits.length).toBe(1);
      expect(hits[0]).not.toContain("csp_violation_oversized");
    } finally {
      cap.restore();
    }
  }, 20_000);
});

// ────────────────────── SEC-06 + CR-7 — publicApi ──────────────────────

describe("SEC-06/CR-7 — publicApi با سقف دقیق و هدر Retry-After", () => {
  it("health: دقیقاً 120 پاسخ سالم سپس 429 با Retry-After ≥ 1", async () => {
    let okCount = 0;
    let limited: Response | null = null;
    for (let i = 0; i < 121; i++) {
      const res = await healthGET(plainRequest<HealthReq>("http://localhost/api/health"));
      if (res.status === 429) {
        limited = res;
      } else {
        okCount++;
        expect([200, 503]).toContain(res.status);
      }
    }
    expect(okCount).toBe(120);
    expect(limited).not.toBeNull();
    const ra = limited!.headers.get("retry-after");
    expect(ra).not.toBeNull();
    expect(Number(ra)).toBeGreaterThanOrEqual(1);
  }, 180_000);

  it("media-file: bucket مستقل، سقف 120 سپس 429 با Retry-After", async () => {
    const params = { params: Promise.resolve({ path: ["no-such-file.webp"] }) };
    let limited = false;
    for (let i = 0; i < 121; i++) {
      const res = await mediaGET(
        plainRequest<MediaReq>(`http://localhost/api/media/file/no-such-${i}.webp`),
        params,
      );
      if (res.status === 429) {
        limited = true;
        expect(res.headers.get("retry-after")).not.toBeNull();
        break;
      }
      expect([200, 404]).toContain(res.status);
    }
    expect(limited).toBe(true);
  }, 120_000);

  it("search: سقف 30/min سپس 429 با Retry-After", async () => {
    let limited = false;
    for (let i = 0; i < 31; i++) {
      const res = await searchGET(searchRequest());
      if (res.status === 429) {
        limited = true;
        expect(res.headers.get("retry-after")).not.toBeNull();
        break;
      }
      expect(res.status).toBe(200);
    }
    expect(limited).toBe(true);
  }, 60_000);
});

// ────────────────────────── SEC-07 — گارد درگاه mock ──────────────────────────

const CODE = `T${Date.now().toString().slice(-8)}${Math.floor(Math.random() * 9)}`;
const AUTHORITY = `MOCK-sechard-${Date.now().toString(36)}`;
let orderId = "";

async function seedPendingPayment() {
  const order = await db.order.create({
    data: {
      code: CODE,
      phone: "09123334455",
      status: "PENDING",
      subtotal: 250_000,
      discountTotal: 0,
      shippingTotal: 0,
      grandTotal: 250_000,
      shippingAddress: {
        fullName: "تست SEC07",
        phone: "09123334455",
        province: "تهران",
        city: "تهران",
        line: "آدرس تست",
        postalCode: "1234567890",
      },
      placedAt: new Date(),
      payments: {
        create: { provider: "mock", authority: AUTHORITY, amount: 250_000, status: "PENDING" },
      },
    },
    include: { payments: true },
  });
  orderId = order.id;
}

afterAll(async () => {
  if (orderId) {
    await db.payment.deleteMany({ where: { orderId } });
    await db.order.delete({ where: { id: orderId } });
  }
  await db.$disconnect();
});

describe("SEC-07 — گارد درگاه mock (کوکی اثبات)", () => {
  it("بدون کوکی → «تراکنش یافت نشد» بدون مبلغ و کد سفارش", async () => {
    await seedPendingPayment();
    const res = await gatewayGET(gatewayRequest(AUTHORITY));
    const text = await res.text();
    expect(text).toContain("تراکنش یافت نشد");
    expect(text).not.toContain(CODE);
    expect(text).not.toContain("تومان");
  }, 20_000);

  it("کوکی اثبات درست (sha256 authority) → مبلغ + کد سفارش", async () => {
    const res = await gatewayGET(gatewayRequest(AUTHORITY, paidProofValue(AUTHORITY)));
    const text = await res.text();
    expect(text).toContain(CODE);
    expect(text).toContain("تومان");
    expect(text).toContain("پرداخت موفق");
  }, 20_000);

  it("کوکی جعلی → «تراکنش یافت نشد»", async () => {
    const forged = createHash("sha256").update("forged-authority").digest("hex");
    const res = await gatewayGET(gatewayRequest(AUTHORITY, forged));
    const text = await res.text();
    expect(text).toContain("تراکنش یافت نشد");
    expect(text).not.toContain(CODE);
  }, 20_000);

  it("authority ناموجود → «تراکنش یافت نشد» (بدون نشت تفاوت)", async () => {
    const res = await gatewayGET(gatewayRequest("MOCK-does-not-exist", paidProofValue("MOCK-does-not-exist")));
    const text = await res.text();
    expect(text).toContain("تراکنش یافت نشد");
  }, 20_000);
});
