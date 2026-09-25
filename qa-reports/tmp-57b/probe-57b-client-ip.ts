// Task 57-b — پروب استاتیک client-ip.ts بازنویسی‌شده (F55-2/3/4) — فقط import خالص، بدون تغییر env سرور
// اجرا: bun qa-reports/tmp-57b/probe-57b-client-ip.ts
import { extractClientIp } from "../../src/lib/client-ip";

function h(hs: Record<string, string>) {
  return { get: (n: string) => hs[n.toLowerCase()] ?? null };
}
function set(cidr: string | undefined) {
  if (cidr === undefined) delete process.env.TRUSTED_PROXY_CIDR;
  else process.env.TRUSTED_PROXY_CIDR = cidr;
}
function show(label: string, cidr: string | undefined, headers: Record<string, string>, expect: string) {
  set(cidr);
  const out = extractClientIp(h(headers));
  const outStr = out === null ? "null" : JSON.stringify(out);
  const verdict = (expect === "null") === (out === null) ? "✓" : "⚠️";
  console.log(`${verdict} ${label} | CIDR=${cidr ?? "(unset)"} | خروجی=${outStr} | انتظار: ${expect}`);
}

console.log("═══ بخش A — شکل‌های IP مرزی در حالت proxy (CIDR=10.99.0.0/16) ═══");
const C16 = "10.99.0.0/16";
// A1/A2 — IPv4-mapped
show("A1 ::ffff:1.2.3.4 (mapped)", C16, { "x-forwarded-for": "::ffff:1.2.3.4" }, "IP برمی‌گردد (raw)");
show("A2 ::FFFF:c0a8:0101 (mapped upper)", C16, { "x-forwarded-for": "::FFFF:c0a8:0101" }, "IP برمی‌گردد (raw)");
// A3 — zone index
show("A3 fe80::1%eth0 (zone)", C16, { "x-forwarded-for": "fe80::1%eth0" }, "null");
show("A3b fe80::1%25eth0 (zone encoded)", C16, { "x-forwarded-for": "fe80::1%25eth0" }, "null");
// A4 — صفر پیشرو (ریسک octal در بعضی پارسرها)
show("A4 01.2.3.4", C16, { "x-forwarded-for": "01.2.3.4" }, "null");
show("A4b 1.02.3.4", C16, { "x-forwarded-for": "1.02.3.4" }, "null");
show("A4c 001.002.003.004", C16, { "x-forwarded-for": "001.002.003.004" }, "null");
show("A4d ::ffff:01.2.3.4 (mapped با صفر پیشرو)", C16, { "x-forwarded-for": "::ffff:01.2.3.4" }, "؟ (دیدن رفتار)");
// A5 — براکت/پورت
show("A5 [::1]", C16, { "x-forwarded-for": "[::1]" }, "null");
show("A5b 1.2.3.4:8080", C16, { "x-forwarded-for": "1.2.3.4:8080" }, "null");
show("A5c [2001:db8::1]:443", C16, { "x-forwarded-for": "[2001:db8::1]:443" }, "null");
// A6 — بزرگی/کوچکی حروف
show("A6 2001:DB8::1", C16, { "x-forwarded-for": "2001:DB8::1" }, "IP برمی‌گردد (raw uppercase)");
// A7 — فاصله/تب/کنترل
show("A7 x-real-ip با فاصلهٔ انتهایی", C16, { "x-real-ip": "9.9.9.9 " }, "؟ (مقدار خام برگشت می‌خورد؟)");
show("A7b x-real-ip با تب پیشرو", C16, { "x-real-ip": "\t9.9.9.9" }, "؟");
show("A7c XFF با فاصله/تب دور آخرین عضو", C16, { "x-forwarded-for": "1.1.1.1,\t 9.9.9.9  " }, "9.9.9.9 تمیز (trim در split)");
// A8 — حجم/خاص
show("A8 رشتهٔ 5000 کاراکتری", C16, { "x-forwarded-for": "a".repeat(5000) }, "null");
show("A8b :: تنها", C16, { "x-forwarded-for": "::" }, "null (آدرس نامشخص)");
show("A8c 0.0.0.0", C16, { "x-forwarded-for": "0.0.0.0" }, "null (آدرس نامشخص)");
show("A8d 255.255.255.255", C16, { "x-forwarded-for": "255.255.255.255" }, "IP برمی‌گردد (broadcast — شکل معتبر)");
show("A8e 127.0.0.1 (loopback، خارج CIDR)", C16, { "x-forwarded-for": "127.0.0.1" }, "IP برمی‌گردد (شکل معتبر)");

console.log("\n═══ بخش B — زنجیرهٔ XFF و فول‌بک x-real-ip ═══");
show("B1 «1.2.3.4, ,5.6.7.8» (عضو خالی وسط)", C16, { "x-forwarded-for": "1.2.3.4, ,5.6.7.8" }, "5.6.7.8 (عضو خالی حذف)");
show("B2 «1.2.3.4, unknown»", C16, { "x-forwarded-for": "1.2.3.4, unknown" }, "null (آخرین عضو نامعتبر → فول‌بک)");
show("B3 فقط اعضای معتمد «10.99.0.9, 10.99.0.1»", C16, { "x-forwarded-for": "10.99.0.9, 10.99.0.1" }, "null (هاپ واقعی چیزی نمی‌ماند)");
show("B4 XFF خراب + x-real-ip سالم", C16, { "x-forwarded-for": "garbage", "x-real-ip": "8.8.4.4" }, "8.8.4.4");
show("B5 فقط کاما «,,»", C16, { "x-forwarded-for": ",,", }, "null");
show("B6 XFF خالی + real-ip «::»", C16, { "x-real-ip": "::" }, "null");
show("B7 زنجیره با mapped در انتها «10.99.0.9, ::ffff:8.8.8.8»", C16, { "x-forwarded-for": "10.99.0.9, ::ffff:8.8.8.8" }, "::ffff:8.8.8.8 raw");

console.log("\n═══ بخش C — حالت مستقیم (بدون TRUSTED_PROXY_CIDR) — fail-closed ═══");
show("C1 XFF سالم", undefined, { "x-forwarded-for": "8.8.8.8" }, "null");
show("C2 x-real-ip سالم", undefined, { "x-real-ip": "8.8.8.8" }, "null");
show("C3 کمبو XFF+real", undefined, { "x-forwarded-for": "1.2.3.4", "x-real-ip": "5.5.5.5" }, "null");
show("C4 XFF mapped", undefined, { "x-forwarded-for": "::ffff:8.8.8.8" }, "null");

console.log("\n═══ بخش D — لبه‌های CIDR (رفتار trust از زاویهٔ کلاینت) ═══");
// D1 — host-bits روشن
set("10.0.0.1/8");
console.log(`D1 CIDR=10.0.0.1/8 (host-bits روشن) → XFF=10.50.1.1 → ${extractClientIp(h({ "x-forwarded-for": "10.50.1.1" }))} (null=host-bitsmask شد ✓)`);
console.log(`D1b همان → XFF=10.0.0.1 → ${extractClientIp(h({ "x-forwarded-for": "10.0.0.1" }))} (null=شبکهٔ mask‌شده معتمد ✓)`);
console.log(`D1c همان → XFF=11.0.0.1 → ${extractClientIp(h({ "x-forwarded-for": "11.0.0.1" }))} (خارج /8 → client)`);
// D2 — prefixهای خراب
for (const bad of ["10.0.0.0/33", "10.0.0.0/-1", "10.0.0.0/8x", "10.0.0.0//8", "10.0.0.0/8/", "10.0.0.0/0", "10.0.0.1/", "10.0.0.0/", "10.0.0.0/032", "10.0.0.0/999", "::1/129"]) {
  set(bad);
  const r = extractClientIp(h({ "x-forwarded-for": "6.6.6.6" }));
  console.log(`D2 CIDR=${JSON.stringify(bad)} → XFF=6.6.6.6 → ${r === null ? "null (رد/fail-closed ✓)" : JSON.stringify(r) + " ⚠️ CIDR زنده شد"}`);
}
// D3 — چند CIDR با یکی خراب
set("10.0.0.0/8, ::/0, 9.9.9.999/24, 2001:db8::/32");
console.log(`D3 CIDR=list با ۲ عضو خراب → XFF=10.4.4.4 → ${extractClientIp(h({ "x-forwarded-for": "10.4.4.4" }))} (null=عضو سالم زنده ✓)`);
console.log(`D3b همان → XFF=2001:db9::1 → ${extractClientIp(h({ "x-forwarded-for": "2001:db9::1" }))} (خارج db8/32 → client ✓)`);
console.log(`D3c همان → XFF=2001:db8::1234 → ${extractClientIp(h({ "x-forwarded-for": "2001:db8::1234" }))} (null=prefix 32 پذیرفته ✓ — فیکس A-4)`);
// D4 — mapped CIDR در برابر کلاینت v4 خالص
set("::ffff:10.99.0.0/112");
console.log(`D4 CIDR=::ffff:10.99.0.0/112 → XFF=10.99.0.9 (v4 خالص) → ${extractClientIp(h({ "x-forwarded-for": "10.99.0.9" }))} (client=mismatch خانواده — تلهٔ پیکربندی)`);
console.log(`D4b همان → XFF=::ffff:10.99.0.9 → ${extractClientIp(h({ "x-forwarded-for": "::ffff:10.99.0.9" }))} (null=معتمد)`);
// D5 — فیکس A-1 قدیمی: شکل‌های مختلف ::1
set("::1");
console.log(`D5 CIDR=::1 → XFF=0:0:0:0:0:0:0:1 → ${extractClientIp(h({ "x-forwarded-for": "0:0:0:0:0:0:0:1" }))} (null=کانونی‌سازی ✓)`);
console.log(`D5b CIDR=::1 → XFF=::1 → ${extractClientIp(h({ "x-forwarded-for": "::1" }))} (null=خود CIDR)`);
console.log(`D5c CIDR=::1 → XFF=::2 → ${extractClientIp(h({ "x-forwarded-for": "::2" }))} (client ✓)`);

console.log("\n═══ پایان پروب — کنسول باید [client-ip] هشدار برای عضوهای نامعتبر چاپ کرده باشد ═══");
