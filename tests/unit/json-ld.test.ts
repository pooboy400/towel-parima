import { describe, expect, it } from "bun:test";
import { safeJsonForScript } from "../../src/components/seo/json-ld";

/**
 * رگرسیون XSS از JSON-LD (گزارش 47-c MEDIUM):
 * JSON.stringify خام «</script>» را escape نمی‌کند → خروج از بلوک اسکریپت در
 * مرورگر؛ نسخهٔ امن باید همه توکن‌های خطرناک را escape و JSON را معتبر نگه دارد.
 */
describe("JsonLd — escape امن اسکریپت (گزارش 47-c)", () => {
  it("توکن خروج از اسکریپت escape می‌شود — </script> در خروجی خام وجود ندارد", () => {
    const out = safeJsonForScript({
      description: 'محصول تست <script>alert("xss")</script> پایان',
    });
    expect(out).not.toContain("</script>");
    expect(out).not.toContain("<script");
    expect(out).toContain("\\u003c");
    // تگ بسته‌شدن به شکل escape شده — برای مرورگر فقط متن است
    expect(out).toContain("\\u003c/script\\u003e");
  });

  it("JSON پس از escape همچنان معتبر است و داده اصلی برمی‌گردد (round-trip)", () => {
    const data = {
      name: "حوله",
      description: "شامل <b>تگ</b>، & و «</script>» و نقل‌قول \"داخل\"",
      price: 745_000,
    };
    const parsed = JSON.parse(safeJsonForScript(data)) as typeof data;
    expect(parsed.name).toBe("حوله");
    expect(parsed.description).toBe(data.description);
    expect(parsed.price).toBe(745_000);
  });

  it("جداکننده‌های خط یونیکد (U+2028/U+2029) هم امن می‌شوند", () => {
    const out = safeJsonForScript({ description: "خط\u2028دوم\u2029سوم" });
    expect(out).not.toContain("\u2028");
    expect(out).not.toContain("\u2029");
    expect(JSON.parse(out).description).toBe("خط\u2028دوم\u2029سوم");
  });
});
