// اثبات تحلیلی ادعاها روی extractClientIp (بدون تغییر کد/محیط — فقط import خالص)
import { extractClientIp } from "../../src/lib/client-ip";

function h(hs: Record<string, string>) {
  return { get: (n: string) => hs[n.toLowerCase()] ?? hs[n] ?? null };
}
// شبیه‌سازی حالت proxy با CIDR شامل IPv6 — با تزریق env در همین پروسه
process.env.TRUSTED_PROXY_CIDR = "::1";
console.log("1) CIDR=::1 ، XFF=0:0:0:0:0:0:0:1 →", extractClientIp(h({ "x-forwarded-for": "0:0:0:0:0:0:0:1" })), "(منتظر null؛ اگر IP برگشت = فرار)");
console.log("2) CIDR=::1 ، XFF=garbage::zz →", extractClientIp(h({ "x-forwarded-for": "garbage::zz" })), "(باید null باشد ولی رشتهٔ حاوی ':' به‌عنوان IPv6 قبول می‌شود)");
console.log("3) CIDR=::1 ، XFF=9.9.9.9 →", extractClientIp(h({ "x-forwarded-for": "9.9.9.9" })));
process.env.TRUSTED_PROXY_CIDR = "10.99.0.0/16";
console.log("4) CIDR=10.99.0.0/16 ، XFF=10.99.0.9,8.8.8.8 →", extractClientIp(h({ "x-forwarded-for": "10.99.0.9,8.8.8.8" })));
console.log("5) CIDR=10.99.0.0/16 ، XFF فقط 10.99.0.9 →", extractClientIp(h({ "x-forwarded-for": "10.99.0.9" })), "(null=درست)");
process.env.TRUSTED_PROXY_CIDR = "10.99.0.0/0";
console.log("6) CIDR=10.99.0.0/0 (تایپو) ، XFF=6.6.6.6 →", extractClientIp(h({ "x-forwarded-for": "6.6.6.6" })), "(null یعنی /0 همه‌چیز را معتمد کرد)");
process.env.TRUSTED_PROXY_CIDR = "2001:db8::/32";
console.log("7) CIDR=2001:db8::/32 ، XFF=9.9.9.9 →", extractClientIp(h({ "x-forwarded-for": "9.9.9.9" })), "(null=کل env دور ریخته شد → bucket مشترک)");
process.env.TRUSTED_PROXY_CIDR = "10.0.0.1/";
console.log("8) CIDR=10.0.0.1/ (اسلش انتهایی) ، XFF=6.6.6.6 →", extractClientIp(h({ "x-forwarded-for": "6.6.6.6" })), "(null یعنی trailing-slash = /0)");
