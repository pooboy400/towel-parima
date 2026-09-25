/**
 * Unit — extractClientIp (SEC-02)
 * جعل X-Forwarded-For نباید bucket تازه بسازد؛ فقط XFFِ پروکسی معتمد معتبر است.
 */
import { describe, expect, it, afterEach } from "bun:test";
import { extractClientIp, DIRECT_IP_BUCKET } from "../../src/lib/client-ip";

type HeadersMap = Record<string, string>;

function makeHeaders(map: HeadersMap) {
  return {
    get(name: string): string | null {
      return map[name.toLowerCase()] ?? null;
    },
  };
}

const ENV_KEY = "TRUSTED_PROXY_CIDR";

afterEach(() => {
  delete process.env[ENV_KEY];
});

describe("extractClientIp — حالت دسترسی مستقیم (بدون TRUSTED_PROXY_CIDR)", () => {
  it("هیچ هدری معتبر نیست — حتی XFF و x-real-ip جعلی", () => {
    delete process.env[ENV_KEY];
    expect(extractClientIp(makeHeaders({ "x-forwarded-for": "1.2.3.4" }))).toBeNull();
    expect(extractClientIp(makeHeaders({ "x-real-ip": "5.6.7.8" }))).toBeNull();
    expect(
      extractClientIp(
        makeHeaders({ "x-forwarded-for": "9.9.9.9, 1.1.1.1", "x-real-ip": "2.2.2.2" }),
      ),
    ).toBeNull();
    expect(extractClientIp(makeHeaders({}))).toBeNull();
  });

  it("bucket اشتراکی ثابت است (DIRECT_IP_BUCKET)", () => {
    expect(DIRECT_IP_BUCKET).toBe("unknown");
  });
});

describe("extractClientIp — حالت پروکسی معتمد", () => {
  it("CIDR تنظیم‌شده + XFF تک‌عضوی (semantics جایگزینی Caddy) → واقعی کلاینت", () => {
    process.env[ENV_KEY] = "10.0.0.0/8";
    expect(extractClientIp(makeHeaders({ "x-forwarded-for": "1.2.3.4" }))).toBe("1.2.3.4");
  });

  it("XFF چندعضوی → آخرین هاپ (نزدیک‌ترین به ما، پروکسی معتمد دیده)", () => {
    process.env[ENV_KEY] = "10.0.0.0/8";
    expect(
      extractClientIp(makeHeaders({ "x-forwarded-for": "1.2.3.4, 9.9.9.9, 8.8.4.4" })),
    ).toBe("8.8.4.4");
  });

  it("عضو آخر داخل CIDR معتمد → رد؛ سپس x-real-ip معتبر → پذیرش", () => {
    process.env[ENV_KEY] = "10.0.0.0/8";
    expect(extractClientIp(makeHeaders({ "x-forwarded-for": "10.1.2.3" }))).toBeNull();
    expect(
      extractClientIp(
        makeHeaders({ "x-forwarded-for": "10.1.2.3", "x-real-ip": "5.6.7.8" }),
      ),
    ).toBe("5.6.7.8");
    expect(extractClientIp(makeHeaders({ "x-real-ip": "5.6.7.8" }))).toBe("5.6.7.8");
  });

  it("ورودی غیر-IP → null (بدون کرش)", () => {
    process.env[ENV_KEY] = "10.0.0.0/8";
    expect(extractClientIp(makeHeaders({ "x-forwarded-for": "not-an-ip" }))).toBeNull();
    expect(extractClientIp(makeHeaders({ "x-forwarded-for": "999.1.1.1" }))).toBeNull();
    expect(extractClientIp(makeHeaders({ "x-forwarded-for": "" }))).toBeNull();
  });

  it("CIDR /32 — تطبیق دقیق IPv4", () => {
    process.env[ENV_KEY] = "127.0.0.1/32";
    expect(extractClientIp(makeHeaders({ "x-forwarded-for": "127.0.0.1" }))).toBeNull();
    expect(extractClientIp(makeHeaders({ "x-forwarded-for": "127.0.0.2" }))).toBe("127.0.0.2");
  });

  it("چند CIDR با فاصله — همگی parse می‌شوند", () => {
    process.env[ENV_KEY] = " 10.0.0.0/8 , 192.168.0.0/16 ";
    expect(extractClientIp(makeHeaders({ "x-forwarded-for": "192.168.3.9" }))).toBeNull();
    expect(extractClientIp(makeHeaders({ "x-forwarded-for": "192.169.3.9" }))).toBe("192.169.3.9");
    expect(extractClientIp(makeHeaders({ "x-forwarded-for": "10.200.1.1" }))).toBeNull();
    expect(extractClientIp(makeHeaders({ "x-forwarded-for": "11.0.0.1" }))).toBe("11.0.0.1");
  });

  it("CIDR نامعتبر عضو حذف می‌شود — بقیه معتبر می‌مانند", () => {
    process.env[ENV_KEY] = "nonsense, 10.0.0.0/8";
    expect(extractClientIp(makeHeaders({ "x-forwarded-for": "10.5.5.5" }))).toBeNull();
    expect(extractClientIp(makeHeaders({ "x-forwarded-for": "1.1.1.1" }))).toBe("1.1.1.1");
  });

  it("0.0.0.0/0 تنظیم منگن است — همه IPها «معتمد» و هیچ کلاینتی پذیرفته نمی‌شود (fail-closed)", () => {
    process.env[ENV_KEY] = "0.0.0.0/0";
    expect(extractClientIp(makeHeaders({ "x-forwarded-for": "1.2.3.4" }))).toBeNull();
  });

  it("IPv6 — تطبیق دقیق رشته", () => {
    process.env[ENV_KEY] = "::1/128";
    expect(extractClientIp(makeHeaders({ "x-forwarded-for": "::1" }))).toBeNull();
    expect(extractClientIp(makeHeaders({ "x-forwarded-for": "::2" }))).toBe("::2");
  });
});

describe("extractClientIp — سخت‌سازی CR-2/CR-3/CR-4 (بازبینی 55-c / Task 56)", () => {
  it("شکل‌های جعلی IPv6/پورت‌دار/براکت‌دار/نامشخص IP حساب نمی‌شوند (CR-2)", () => {
    process.env[ENV_KEY] = "10.0.0.0/8";
    expect(extractClientIp(makeHeaders({ "x-forwarded-for": "garbage::zz" }))).toBeNull();
    expect(extractClientIp(makeHeaders({ "x-forwarded-for": "1.2.3.4:80" }))).toBeNull();
    expect(extractClientIp(makeHeaders({ "x-forwarded-for": "[::1]" }))).toBeNull();
    expect(extractClientIp(makeHeaders({ "x-forwarded-for": "::" }))).toBeNull(); // آدرس نامشخص
    expect(extractClientIp(makeHeaders({ "x-forwarded-for": "0.0.0.0" }))).toBeNull(); // نامشخص
  });

  it("کانونی‌سازی باینری IPv6 — شکل متفاوتِ همان آدرس معتمد است (CR-3)", () => {
    process.env[ENV_KEY] = "::1/128";
    // با مقایسهٔ رشته‌ای قبلی، این شکل «خارج از معتمد» تشخیص داده می‌شد
    expect(extractClientIp(makeHeaders({ "x-forwarded-for": "0:0:0:0:0:0:0:1" }))).toBeNull();
    expect(extractClientIp(makeHeaders({ "x-forwarded-for": "::0:1" }))).toBeNull();
  });

  it("prefix کامل IPv6 پشتیبانی می‌شود — دیگر فقط /128 نیست (CR-3/CR-4)", () => {
    process.env[ENV_KEY] = "2001:db8::/32";
    expect(extractClientIp(makeHeaders({ "x-forwarded-for": "2001:db8::1234" }))).toBeNull();
    expect(extractClientIp(makeHeaders({ "x-forwarded-for": "2001:db9::1" }))).toBe("2001:db9::1");
  });

  it("پیش‌وند صفر و اسلش انتهایی رد می‌شوند — بدون trust-all و بدون سکوت (CR-4)", () => {
    process.env[ENV_KEY] = "10.0.0.1/"; // اسلش انتهایی = تایپ رایج
    expect(extractClientIp(makeHeaders({ "x-forwarded-for": "1.2.3.4" }))).toBeNull();
    process.env[ENV_KEY] = "10.99.0.0/0"; // هیچ پروکسی‌ای /0 نیست
    expect(extractClientIp(makeHeaders({ "x-forwarded-for": "1.2.3.4" }))).toBeNull();
    process.env[ENV_KEY] = "10.99.0.0/8/x"; // زبالهٔ بعد از prefix
    expect(extractClientIp(makeHeaders({ "x-forwarded-for": "1.2.3.4" }))).toBeNull();
  });

  it("عضو خراب بین عضوهای سالم — بقیه همچنان کار می‌کنند", () => {
    process.env[ENV_KEY] = "garbage::zz, 10.0.0.0/8";
    expect(extractClientIp(makeHeaders({ "x-forwarded-for": "10.5.5.5" }))).toBeNull();
    expect(extractClientIp(makeHeaders({ "x-forwarded-for": "1.1.1.1" }))).toBe("1.1.1.1");
  });
});
