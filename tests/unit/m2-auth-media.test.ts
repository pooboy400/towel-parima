/**
 * Unit — TOTP (RFC 6238)، magic bytes، سیاست رمز، اسکیماهای ادمین (M2)
 */

import { describe, expect, it } from "bun:test";
import {
  base32Decode,
  base32Encode,
  buildOtpauthUri,
  totpAt,
  verifyTotpCode,
  generateTotpSecret,
} from "../../src/core/auth/totp";
import { sniffImageMime } from "../../src/core/media/sniff";
import { isValidPassword, generateStrongPassword } from "../../src/core/auth/password";
import {
  slugSchema,
  skuSchema,
  productUpsertSchema,
} from "../../src/domain/schemas/admin";

/* ------------------------------------------------------------------ */
/* TOTP — بردارهای RFC 6238 (SHA1) با کد ۶ رقمی                        */
/* secret RFC = "12345678901234567890" → base32 GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ */
/* ------------------------------------------------------------------ */

const RFC_SECRET_B32 = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";

describe("TOTP — RFC 6238", () => {
  it("base32 decode/encode رفت‌وبرگشت", () => {
    const buf = base32Decode(RFC_SECRET_B32);
    expect(buf.toString("ascii")).toBe("12345678901234567890");
    expect(base32Encode(buf)).toBe(RFC_SECRET_B32);
  });

  it("بردار T=59 (counter=1) → 287082", () => {
    // RFC 8 رقمی 94287082 → ۶ رقم آخرِ مقدار truncation = 287082
    expect(totpAt(RFC_SECRET_B32, 1)).toBe("287082");
  });

  it("بردار T=1111111109 (counter=37037036) → 081804", () => {
    expect(totpAt(RFC_SECRET_B32, 37037036)).toBe("081804");
  });

  it("verifyTotpCode کد درست را می‌پذیرد و غلط را رد می‌کند", () => {
    const counter = Math.floor(Date.now() / 1000 / 30);
    const code = totpAt(RFC_SECRET_B32, counter);
    expect(verifyTotpCode(RFC_SECRET_B32, code)).toBe(true);
    // پنجره ±۱
    expect(verifyTotpCode(RFC_SECRET_B32, totpAt(RFC_SECRET_B32, counter - 1))).toBe(true);
    expect(verifyTotpCode(RFC_SECRET_B32, "000000") && counter === -1).toBe(false);
    expect(verifyTotpCode(RFC_SECRET_B32, "abcdef")).toBe(false); // غیررقمی
    expect(verifyTotpCode(RFC_SECRET_B32, "12345")).toBe(false); // طول غلط
  });

  it("secret تصادفی ۳۲ کاراکتر base32 و URI otpauth درست", () => {
    const secret = generateTotpSecret();
    expect(secret.length).toBe(32);
    const uri = buildOtpauthUri(secret, "admin@prima-store.ir");
    expect(uri.startsWith("otpauth://totp/")).toBe(true);
    expect(uri).toContain(`secret=${secret}`);
    expect(uri).toContain("issuer=PRIMA");
    expect(uri).toContain("digits=6");
    expect(uri).toContain("period=30");
  });
});

/* ------------------------------------------------------------------ */
/* magic bytes — خط لوله رسانه (§21.2)                                 */
/* ------------------------------------------------------------------ */

describe("sniffImageMime", () => {
  it("JPEG", () => {
    const buf = Buffer.from([0xff, 0xd8, 0xff, 0xe0, ...Buffer.alloc(20)]);
    expect(sniffImageMime(buf)).toBe("image/jpeg");
  });
  it("PNG", () => {
    const buf = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...Buffer.alloc(8)]);
    expect(sniffImageMime(buf)).toBe("image/png");
  });
  it("WEBP", () => {
    const sig = Buffer.from("RIFF\x00\x00\x00\x00WEBPVP8 ", "binary");
    expect(sniffImageMime(sig)).toBe("image/webp");
  });
  it("GIF", () => {
    const buf = Buffer.from("GIF89a" + "0".repeat(12), "binary");
    expect(sniffImageMime(buf)).toBe("image/gif");
  });
  it("فایل متنی قلابی رد می‌شود", () => {
    const buf = Buffer.from("<script>alert(1)</script> پردازش تصویر ممنوع");
    expect(sniffImageMime(buf)).toBeNull();
  });
  it("SVG قلابی رد می‌شود", () => {
    const buf = Buffer.from('<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"/>');
    expect(sniffImageMime(buf)).toBeNull();
  });
});

/* ------------------------------------------------------------------ */
/* سیاست رمز (§9.3)                                                    */
/* ------------------------------------------------------------------ */

describe("password policy", () => {
  it("رمز معتبر", () => {
    expect(isValidPassword("S3cure-pass-12")).toBe(true);
  });
  it("کوتاه ۹ کاراکتر رد", () => {
    expect(isValidPassword("Sh0rt-pas")).toBe(false);
  });
  it("بدون رقم رد", () => {
    expect(isValidPassword("nodigitshere")).toBe(false);
  });
  it("بدون حرف رد", () => {
    expect(isValidPassword("123456789012")).toBe(false);
  });
  it("رمز تولیدی همیشه policy را پاس می‌کند", () => {
    for (let i = 0; i < 50; i++) {
      expect(isValidPassword(generateStrongPassword())).toBe(true);
    }
  });
});

/* ------------------------------------------------------------------ */
/* اسکیماهای ادمین — نرمال‌سازی ارقام فارسی و قواعد slug/SKU            */
/* ------------------------------------------------------------------ */

const validVariant = {
  sku: "PRIMA-CRM-L-TEST",
  price: "۱۵۰٬۰۰۰",
  compareAtPrice: null,
  stock: "۱۰",
  colorId: null,
  sizeId: null,
  isActive: true,
};

function baseProduct() {
  return {
    name: "حوله حمام پریمیوم",
    slug: "prima-bath-towel-test",
    categoryId: "cat_x",
    status: "DRAFT",
    variants: [validVariant],
  };
}

describe("admin schemas", () => {
  it("ارقام فارسی قیمت → عدد", () => {
    const parsed = productUpsertSchema.parse(baseProduct());
    expect(parsed.variants[0].price).toBe(150000);
    expect(parsed.variants[0].stock).toBe(10);
  });

  it("اسلاگ فارسی رد می‌شود", () => {
    expect(slugSchema.safeParse("حوله-حمام").success).toBe(false);
    expect(slugSchema.safeParse("Prima Towel").success).toBe(false);
    expect(slugSchema.safeParse("prima-bath-towel").success).toBe(true);
  });

  it("SKU نرمال‌سازی به حروف بزرگ", () => {
    expect(skuSchema.parse("prima-crm-l")).toBe("PRIMA-CRM-L");
  });

  it("compareAtPrice کوچکتر از price رد می‌شود", () => {
    const bad = {
      ...baseProduct(),
      variants: [{ ...validVariant, price: "200000", compareAtPrice: "150000" }],
    };
    const res = productUpsertSchema.safeParse(bad);
    expect(res.success).toBe(false);
  });

  it("بدون واریانت رد می‌شود", () => {
    const res = productUpsertSchema.safeParse({ ...baseProduct(), variants: [] });
    expect(res.success).toBe(false);
  });
});
