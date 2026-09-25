/** راستی‌آزمایی دستی ریاضی بایت — کانونی‌سازی BigInt (فقط-خواندنی) */
import { ipv6ToBigInt } from "../../src/lib/client-ip";
const show = (s: string, expect?: string) => {
  const v = ipv6ToBigInt(s);
  console.log(`${s.padEnd(22)} → ${v === null ? "null" : v.toString(16).padStart(32, "0")}${expect ? `  (انتظار: ${expect})` : ""}`);
};
show("2001:db8::1", "20010db8000000000000000000000001");
show("::ffff:1.2.3.4", "0000...ffff01020304 (mapped)");
show("0:0:0:0:0:0:0:1", "1 = ::1");
show("::1", "1");
show("fe80::1%eth0", "null (zone رد)");
show("[::1]", "null (براکت رد)");
show("::", "0 (نامشخص — بالادست رد می‌کند)");
show("1:2:3:4:5:6:7:8:9", "null (9 گروه)");
show("1::2::3", "null (دو ::)");
show("12345::", "null (گروه 5 رقمی)");
show("::ffff:01.2.3.4", "null (صفر پیشرو در دم v4)");
