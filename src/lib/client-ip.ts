/**
 * منبع IP معتبر — SEC-02 (F-2 گزارش 51c / F-1 گزارش 51d)
 * ---------------------------------------------------------------
 * مشکل: همهٔ سایت‌های قبلی اولین عضو `X-Forwarded-For` را بدون هیچ لیست سفیدی
 * برمی‌داشتند — با هدر جعلی، هر درخواست bucket تازهٔ rate-limit می‌گرفت
 * (اثبات زنده: 30×200 سپس 429 → با XFF جعلی 200).
 *
 * طراحی:
 * - `TRUSTED_PROXY_CIDR` تنظیم‌نشده (دسترسی مستقیم به سرور) → **هیچ هدری
 *   معتبر نیست**؛ null برمی‌گردد و کلیدها روی bucket اشتراکی "unknown"
 *   می‌افتند (fail-closed). سقف‌های per-phone/per-email/per-user مستقل از IP
 *   همچنان granular کار می‌کنند.
 * - `TRUSTED_PROXY_CIDR` تنظیم‌شده (پروکسی معتمد مثل Caddy جلوی اپ):
 *   از XFF **آخرین عضو** گرفته می‌شود (هاپ نزدیک‌ترین به ما که پروکسی معتمد
 *   دیده — هم با semantics جایگزینی Caddy درست است هم append معمول)؛ عضو
 *   باید IP معتبر و خارج از CIDR معتمد باشد. نبود XFF → `x-real-ip` با همین
 *   قواعد.
 *
 * ⚠️ پیش‌نیاز دیپلوی: در حالت proxy، پورت اپ باید فقط از پروکسی معتمد
 * در دسترس باشد (firewall/bind localhost) — وگرنه هدر از مسیر مستقیم قابل
 * جعل است (این محدودیت ذاتی اپ‌روترهای بدون دسترسی سوکت است).
 *
 * IPv6 (سخت‌سازی Task 56 — CR-2/CR-3/CR-4 بازبینی 55-c):
 * - اعتبارسنجی واقعی شکل با `net.isIP` — رشته‌های جعلی مثل `garbage::zz` یا
 *   `1.2.3.4:80` یا `[::1]` دیگر «IP معقول» حساب نمی‌شوند.
 * - تطبیق CIDR باینری با BigInt (نه مقایسهٔ رشته‌ای) — شکل‌های متفاوتِ همان
 *   آدرس (`0:0:0:0:0:0:0:1` و `::1`) معادل‌اند؛ prefix کامل 1-128 پشتیبانی
 *   می‌شود (دیگر CIDRهای IPv6 غیر /128 دور ریخته نمی‌شوند).
 * - رد صریح پیش‌وند صفر «/0» و اسلش انتهایی («10.0.0.1/») — هیچ‌وقت تنظیم
 *   عمدی نیستند؛ عضو نامعتبر با هشدار بلند نادیده گرفته می‌شود (سکوت ممنوع).
 * - رد آدرس نامشخص («::» و «0.0.0.0») به‌عنوان IP کلاینت.
 */

import { isIP } from "node:net";

/** رابط حداقلی — با NextHeaders و Headers سازگار است */
export interface HeaderLike {
  get(name: string): string | null;
}

/** CIDR معتبرِ parse‌شده — مقایسهٔ باینری BigInt (هر دو خانواده) */
interface TrustedCidr {
  raw: string;
  family: 4 | 6;
  /** آدرس شبکه نرمال‌شده با ماسک اعمال‌شده */
  net: bigint;
  mask: bigint;
}

const IPV4_RE = /^(\d{1,3})(\.(\d{1,3})){3}$/;

function isIPv4(value: string): boolean {
  if (!IPV4_RE.test(value)) return false;
  return value.split(".").every((oct) => {
    const n = Number(oct);
    return Number.isInteger(n) && n >= 0 && n <= 255;
  });
}

function ipv4ToBigInt(value: string): bigint | null {
  if (!isIPv4(value)) return null;
  const [a, b, c, d] = value.split(".").map(Number);
  return (
    (BigInt(a) << BigInt(24)) | (BigInt(b) << BigInt(16)) | (BigInt(c) << BigInt(8)) | BigInt(d)
  );
}

/**
 * IPv6 به BigInt (128 بیتی) — پارس واقعی؛ شکل‌های جعلی/براکت‌دار/zone-دار → null.
 * دمِ IPv4-embedded (`::ffff:1.2.3.4`) هم پشتیبانی می‌شود.
 */
export function ipv6ToBigInt(value: string): bigint | null {
  let v = value;
  if (v.startsWith("[") || v.endsWith("]") || v.includes("%")) return null;

  const lastColon = v.lastIndexOf(":");
  if (lastColon === -1) return null;
  const tail = v.slice(lastColon + 1);
  if (tail.includes(".")) {
    const tailNum = ipv4ToBigInt(tail);
    if (tailNum === null) return null;
    const hi = (tailNum >> BigInt(16)) & BigInt(0xffff);
    const lo = tailNum & BigInt(0xffff);
    v = v.slice(0, lastColon + 1) + hi.toString(16) + ":" + lo.toString(16);
  }

  const dbl = v.split("::");
  if (dbl.length > 2) return null;
  const head = dbl[0] === "" ? [] : dbl[0].split(":");
  const rear = dbl.length === 2 ? (dbl[1] === "" ? [] : dbl[1].split(":")) : [];
  const fill = 8 - head.length - rear.length;
  if (fill < 0 || (dbl.length === 1 && fill !== 0)) return null;
  const groups = [...head, ...Array<string>(fill).fill("0"), ...rear];
  if (groups.length !== 8) return null;

  let out = BigInt(0);
  for (const g of groups) {
    if (!/^[0-9a-fA-F]{1,4}$/.test(g)) return null;
    out = (out << BigInt(16)) | BigInt(parseInt(g, 16));
  }
  return out;
}

/** parse یک CIDR — نامعتبر → null (عضو با هشدار نادیده می‌شود) */
function parseCidr(entry: string): TrustedCidr | null {
  const raw = entry.trim();
  if (!raw) return null;

  const slash = raw.indexOf("/");
  const ipPart = slash === -1 ? raw : raw.slice(0, slash);
  const prefixPart = slash === -1 ? null : raw.slice(slash + 1);

  // CR-2 — فقط شکل واقعی IP (نه «:»-دارِ دلخواه، نه عدد پورت‌دار)
  const family = isIP(ipPart);
  if (family !== 4 && family !== 6) return null;

  // CR-4 — prefix باید عدد صحیح بدون علامت باشد؛ «» (اسلش انتهایی) و
  // اعشاری/منفی/خراب همین‌جا رد می‌شوند
  let prefix: number;
  if (prefixPart === null) {
    prefix = family === 4 ? 32 : 128;
  } else {
    if (!/^\d{1,3}$/.test(prefixPart)) return null;
    prefix = Number(prefixPart);
  }
  const maxBits = family === 4 ? 32 : 128;
  // prefix صفر («/0») عمداً رد می‌شود — هیچ پروکسی‌ای با /0 معنا ندارد و
  // سکوت در برابر این تایپِ رایج یعنی trust-all بی‌صدا
  if (!Number.isInteger(prefix) || prefix < 1 || prefix > maxBits) return null;

  const ipBig = family === 4 ? ipv4ToBigInt(ipPart) : ipv6ToBigInt(ipPart);
  if (ipBig === null) return null;

  const mask =
    ((BigInt(1) << BigInt(prefix)) - BigInt(1)) << BigInt(maxBits - prefix);
  return { raw, family, net: ipBig & mask, mask };
}

/** parse کل مقدار env — عضو نامعتبر با هشدار بلند نادیده می‌شود (CR-4) */
function parseTrustedCidrs(raw: string | undefined): TrustedCidr[] {
  if (!raw || !raw.trim()) return [];
  const out: TrustedCidr[] = [];
  let dropped = 0;
  for (const entry of raw.split(",")) {
    if (!entry.trim()) continue;
    const cidr = parseCidr(entry);
    if (cidr) out.push(cidr);
    else dropped++;
  }
  if (dropped > 0) {
    console.error(
      `[client-ip] ⚠️ ${dropped} عضو نامعتبر در TRUSTED_PROXY_CIDR نادیده گرفته شد — ` +
        `پیش‌وند صفر («/0»)، اسلش انتهایی و شکل‌های خراب پذیرفته نمی‌شوند (IPv4: 1-32، IPv6: 1-128). ` +
        `پیکربندی را اصلاح کنید؛ تا آن‌موقع رفتار fail-closed حفظ می‌شود.`,
    );
  }
  return out;
}

let cachedRaw: string | undefined;
let cachedCidrs: TrustedCidr[] | null = null;

/** CIDRهای معتمد — بر اساس مقدار env کش می‌شود (تغییر env = بازپارس) */
function trustedCidrs(): TrustedCidr[] {
  const raw = process.env.TRUSTED_PROXY_CIDR;
  if (cachedCidrs === null || cachedRaw !== raw) {
    cachedRaw = raw;
    cachedCidrs = parseTrustedCidrs(raw);
  }
  return cachedCidrs;
}

function isTrusted(ip: string): boolean {
  const family = isIP(ip);
  if (family !== 4 && family !== 6) return false;
  const ipBig = family === 4 ? ipv4ToBigInt(ip) : ipv6ToBigInt(ip);
  if (ipBig === null) return false;
  return trustedCidrs().some(
    (c) => c.family === family && (ipBig & c.mask) === c.net,
  );
}

/** IP معتبر (شکل واقعی، غیر نامشخص) و خارج از CIDR معتمد؟ */
function isPlausibleClientIp(value: string): boolean {
  const v = value.trim();
  if (!v) return false;
  const family = isIP(v);
  if (family !== 4 && family !== 6) return false; // CR-2 — نه IPv4 نه IPv6 واقعی
  const ipBig = family === 4 ? ipv4ToBigInt(v) : ipv6ToBigInt(v);
  if (ipBig === null || ipBig === BigInt(0)) return false; // آدرس نامشخص (:: / 0.0.0.0)
  return !isTrusted(v);
}

/**
 * استخراج IP کلاینت از هدرها — تنها منبع مجاز IP برای rate-limit و audit.
 * خروجی null = «هدر معتبری در دسترس نیست» → فراخواننده باید bucket اشتراکی
 * ("unknown") بسازد، هرگز هدر را مستقیم معتبر نگیرد.
 */
/**
 * CLIENT-IP-T1 (فاز ۳) — شکل کانونی خروجی: v6 فشرده/کوچک (RFC 5952)، v4 دست‌نخورده.
 * نتیجه: شکل‌های هم‌ارز همان آدرس (::1 و 0:0:0:0:0:0:0:1) یک bucket می‌گیرند.
 */
function canonicalIp(value: string): string | null {
  if (isIPv4(value)) return value;
  const v6 = ipv6ToBigInt(value);
  if (v6 === null) return null;
  const groups = Array.from({ length: 8 }, (_, i) => (v6 >> BigInt(16 * (7 - i))) & BigInt(0xffff));
  let bestStart = -1;
  let bestLen = 0;
  let curStart = -1;
  let curLen = 0;
  groups.forEach((g, i) => {
    if (g === BigInt(0)) {
      if (curStart === -1) {
        curStart = i;
        curLen = 1;
      } else {
        curLen += 1;
      }
      if (curLen > bestLen) {
        bestLen = curLen;
        bestStart = curStart;
      }
    } else {
      curStart = -1;
      curLen = 0;
    }
  });
  const hex = groups.map((g) => g.toString(16));
  if (bestLen > 1) {
    const head = hex.slice(0, bestStart).join(":");
    const rear = hex.slice(bestStart + bestLen).join(":");
    return `${head}::${rear}`;
  }
  return hex.join(":");
}

export function extractClientIp(h: HeaderLike): string | null {
  const cidrs = trustedCidrs();
  if (cidrs.length === 0) return null; // حالت دست‌رسی مستقیم — fail-closed

  const xff = h.get("x-forwarded-for");
  if (xff) {
    const entries = xff.split(",").map((e) => e.trim()).filter(Boolean);
    const last = entries[entries.length - 1];
    if (last && isPlausibleClientIp(last)) return canonicalIp(last);
  }

  // CLIENT-IP-T1 — trim اینجا هم باشد (XFF در بالا trim می‌شود؛ نامتقارن بود)
  const real = h.get("x-real-ip")?.trim();
  if (real && isPlausibleClientIp(real)) return canonicalIp(real);

  return null;
}

/**
 * نسخهٔ async برای Server Actions — جایگزین همهٔ خواندن‌های مستقیم XFF.
 * (dynamic import تا فایل برای تست‌های unit بدون ران‌تایم Next سبز بماند)
 */
export async function getClientIp(): Promise<string | null> {
  const { headers } = await import("next/headers");
  return extractClientIp(await headers());
}

/** bucket اشتراکی برای حالت «IP معتبر در دسترس نیست» */
export const DIRECT_IP_BUCKET = "unknown";
