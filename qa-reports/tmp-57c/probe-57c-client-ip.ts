/** پروب فقط-خواندنی 57-c — در پروسهٔ جداگانه bun؛ env سرور دست نمی‌خورد */
import { extractClientIp } from "../../src/lib/client-ip";

function h(map: Record<string, string>) {
  return { get: (n: string) => map[n.toLowerCase()] ?? null };
}
const cases: Array<{ cidr: string; headers: Record<string, string>; label: string }> = [
  { cidr: "10.0.0.0/8", headers: { "x-real-ip": "9.9.9.9 " }, label: "A7c: x-real-ip با فاصلهٔ انتهایی → خروجی خام؟" },
  { cidr: "10.0.0.0/8", headers: { "x-real-ip": "\t9.9.9.9" }, label: "A7d: x-real-ip با تب پیشرو" },
  { cidr: "10.0.0.0/8", headers: { "x-forwarded-for": "2001:DB8::1" }, label: "B1: IPv6 با حروف بزرگ → خروجی raw (کلید غیرکانونی)؟" },
  { cidr: "2001:db8::/32", headers: { "x-forwarded-for": "2001:DB8::99" }, label: "B2: بزرگ/کوچک در تطبیق معتمد (باید null=معتمد باشد)" },
  { cidr: "10.0.0.1/8", headers: { "x-forwarded-for": "10.50.1.1" }, label: "C1: CIDR با host-bits روشن (10.0.0.1/8) → mask؟ (null=معتمد)" },
  { cidr: "10.0.0.0/032", headers: { "x-forwarded-for": "1.2.3.4" }, label: "C2: /032 صفر پیشرو در prefix → پذیرفته؟ (null=معتمد یعنی بله)" },
  { cidr: "::ffff:10.99.0.0/112", headers: { "x-forwarded-for": "10.99.0.9" }, label: "D4: v4 خالص در برابر CIDR mapped → untrusted (باید IP برگردد)" },
  { cidr: "::ffff:10.99.0.0/112", headers: { "x-forwarded-for": "::ffff:10.99.0.9" }, label: "D4b: همان کلاینت با شکل mapped → معتمد (null)" },
  { cidr: "10.0.0.0/8", headers: { "x-forwarded-for": "  1.2.3.4  , 9.9.9.9" }, label: "E1: XFF با فاصله → عضو آخر trim‌شده؟" },
];
for (const c of cases) {
  process.env.TRUSTED_PROXY_CIDR = c.cidr;
  const out = extractClientIp(h(c.headers));
  console.log(`${c.label} → ${JSON.stringify(out)}`);
}
process.env.TRUSTED_PROXY_CIDR = "";
console.log("F1: بدون CIDR + XFF سالم →", JSON.stringify(extractClientIp(h({ "x-forwarded-for": "1.2.3.4" }))));
