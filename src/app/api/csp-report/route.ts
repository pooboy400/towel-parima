import { NextRequest, NextResponse } from "next/server";
import { rateLimiter, RATE_RULES, rateKey } from "@/core/rate-limit";
import { extractClientIp } from "@/lib/client-ip";

/**
 * POST /api/csp-report — دریافت گزارش تخلف CSP (بخش ۹.۲ سند معماری)
 * ---------------------------------------------------------------
 * M0: CSP-Report-Only فعال است و مرورگرها تخلف‌ها را اینجا می‌فرستند.
 * M6: با تحلیل این گزارش‌ها، سیاست سخت‌گیرانه nonce-دار ساخته می‌شود.
 *
 * امنیت endpoint:
 * - rate limit ۳۰/IP/دقیقه (مرورگر سالم به این سقف نمی‌خورد)
 * - هیچ ذخیره‌سازی حساسی ندارد؛ فقط لاگ JSON ساخت‌یافته
 * - بدنه هرچه باشد 204 برمی‌گرداند (مرورگر انتظار پاسخ ندارد)
 * - SEC-05 (F-3/51c، F-51B-2/51b): سقف بدنه قبل از خواندن (Content-Length)
 *   و سقف رکورد لاگ بعد از parse (پوشش chunked) — log flooding بسته است
 * - CR-5 (بازبینی 55-c): هدر Content-Length قابل اعتماد نیست (غایب = chunked)
 *  ؛ خواندن از stream با سقف واقعی حافظه انجام می‌شود و در سرریز cancel
 *   می‌شود — بدنهٔ chunked چندصدمگابایتی هرگز کامل در RAM بافر نمی‌شود.
 */
/** سقف بدنهٔ گزارش — گزارش مرورگر سالم چند صد بایت است */
const CSP_MAX_BODY_BYTES = 4 * 1024;
/** سقف رکورد لاگ — بزرگ‌تر از این فقط متادیتا لاگ می‌شود */
const CSP_MAX_LOG_RECORD = 2 * 1024;

/** خواندن bounded بدنه — در سرریز، stream را cancel و متن نمی‌دهد (CR-5) */
async function readBodyCapped(
  request: NextRequest,
  cap: number,
): Promise<{ text: string | null; capped: boolean }> {
  const reader = request.body?.getReader();
  if (!reader) return { text: null, capped: false };

  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > cap) {
      await reader.cancel().catch(() => {});
      return { text: null, capped: true };
    }
    chunks.push(value);
  }

  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { text: new TextDecoder().decode(merged), capped: false };
}

export async function POST(request: NextRequest) {
  // IP فقط از پروکسی معتمد (SEC-02) — هدر جعلی bucket تازه نمی‌سازد
  const ip = extractClientIp(request.headers) ?? "unknown";
  const key = rateKey("csp-report", ip);

  const { ok } = await rateLimiter.hit(key, RATE_RULES.search);
  if (!ok) {
    // حتی در سقف هم 204 — مرورگر را گمراه نکنیم
    return new NextResponse(null, { status: 204 });
  }

  // SEC-05 — مسیر سریع: اگر Content-Length هست و بزرگ است، بدون خواندن رد
  const contentLength = Number(request.headers.get("content-length") ?? "");
  if (Number.isFinite(contentLength) && contentLength > CSP_MAX_BODY_BYTES) {
    return new NextResponse(null, { status: 204 });
  }

  // CR-5 — مسیر chunked/بی‌هدر: خواندن با سقف واقعی حافظه
  // CSP-N1 (فاز ۳) — خطای مسیر reader (قطع اتصال کلاینت و…) 500 نمی‌سازد؛
  // 204 بی‌لاگ مثل بقیهٔ مسیرهای رد.
  let text: string | null;
  let capped: boolean;
  try {
    ({ text, capped } = await readBodyCapped(request, CSP_MAX_BODY_BYTES));
  } catch {
    return new NextResponse(null, { status: 204 });
  }
  if (capped || text === null) {
    // بزرگ‌تر از سقف = هم‌رفتار مسیر Content-Length: بدون لاگ (ضد log flooding)
    return new NextResponse(null, { status: 204 });
  }

  try {
    const report: unknown = JSON.parse(text);
    const payload = JSON.stringify(report);
    if (payload.length > CSP_MAX_LOG_RECORD) {
      // رکورد غیرعادی بزرگ — فقط متادیتا، نه محتوا (ضد log flooding)
      console.log(
        JSON.stringify({
          level: "warn",
          type: "csp_violation_oversized",
          ts: new Date().toISOString(),
          ip,
          size: payload.length,
        }),
      );
      return new NextResponse(null, { status: 204 });
    }
    // لاگ یک‌خطی JSON — در M6 به error tracking می‌رود
    console.log(
      JSON.stringify({
        level: "warn",
        type: "csp_violation",
        ts: new Date().toISOString(),
        ip,
        report,
      }),
    );
  } catch {
    // بدنه خراب = بی‌اهمیت؛ بی‌صدا رد شود
  }

  return new NextResponse(null, { status: 204 });
}
