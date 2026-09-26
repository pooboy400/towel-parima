/**
 * نرمال‌سازی متن فارسی (بخش ۱۷ سند معماری)
 * ---------------------------------------------------------------
 * ⚠️ یک ماژول واحد — هم index-time هم query-time از همین توابع استفاده می‌کنند؛
 * دو مسیر نرمال‌سازی مختلف = جستجوی خراب.
 *
 * پوشش:
 * ۱. عربی→فارسی: ي→ی · ك→ک (+ هشتگ‌های رایج عربی)
 * ۲. ارقام فارسی/عربی → لاتین
 * ۳. نیم‌فاصله (ZWNJ) و نویسه‌های جداساز → فاصله در سطح tokenizing
 * ۴. فشرده‌سازی فاصله‌های تکراری + trim
 * ۵. lowercase لاتین
 */

/** عربی → فارسی — نویسه‌هایی که در فارسی نباید باشند */
const ARABIC_TO_PERSIAN: Record<string, string> = {
  "ي": "ی", // yeh arabi
  "ك": "ک", // kaf arabi
  "ﻻ": "لا", // ligature lam-alef
  "ى": "ی", // alef maksura
  "ٱ": "ا", // alef wasla
  "ؤ": "و",
  "إ": "ا",
  "أ": "ا",
  "آ": "آ", // حفظ مد فارسی
  "ة": "ه",
};

/** ارقام فارسی ۰-۹ و عربی ٠-٩ → لاتین */
const DIGIT_MAP: Record<string, string> = {
  "۰": "0", "۱": "1", "۲": "2", "۳": "3", "۴": "4",
  "۵": "5", "۶": "6", "۷": "7", "۸": "8", "۹": "9",
  "٠": "0", "١": "1", "٢": "2", "٣": "3", "٤": "4",
  "٥": "5", "٦": "6", "٧": "7", "٨": "8", "٩": "9",
};

/** نیم‌فاصله و نویسه‌های عرض-صفر → فاصله (در tokenizing) */
const SEPARATORS = /[\u200C\u200B\u200E\u200F\uFEFF]/g;

/** تمام نویسه‌های قابل نرمال‌سازی در یک RegExp واحد — برای کارایی */
const CHAR_CLASS = new RegExp(
  `[${Object.keys({ ...ARABIC_TO_PERSIAN, ...DIGIT_MAP }).join("")}]`,
  "g",
);

/** ارقام → لاتین + عربی → فارسی، در یک پاس */
function mapChars(input: string): string {
  return input.replace(CHAR_CLASS, (ch) => DIGIT_MAP[ch] ?? ARABIC_TO_PERSIAN[ch] ?? ch);
}

/**
 * نرمال‌سازی کامل برای جستجو — خروجی baseline مقایسه‌هاست.
 * ZWNJ → فاصله: «حوله‌ی» و «حوله ی» یکسان جستجو می‌شوند.
 */
export function normalizePersian(input: string): string {
  return mapChars(input.toLowerCase())
    .replace(SEPARATORS, " ")
    // فاصله‌های تکراری + فاصله‌های یونیکد دیگر
    .replace(/[\s\u00A0\u202F\u2009\u200A\u2028\u2029]+/g, " ")
    .trim();
}

/** فقط ارقام → لاتین (برای تلفن/کدپستی بدون دست‌زدن به حروف) */
export function normalizeFaDigits(input: string): string {
  return input.replace(/[۰-۹٠-٩]/g, (d) => DIGIT_MAP[d] ?? d);
}

/**
 * نسخه جستجو: نرمال‌سازی + شکستن به tokenهای تمیز.
 * برای FTS پیشوندهای «و/در/به/از» حذف نمی‌شوند (اینجا stem ممنوع —
 * پیکربندی فارسی PostgreSQL در M1 این کار را می‌کند).
 */
export function tokenizePersian(input: string): string[] {
  const normalized = normalizePersian(input);
  if (!normalized) return [];
  return normalized.split(" ").filter((t) => t.length > 0);
}

/**
 * ساخت query پیوسته برای مطابقت substring (جستجوی سریع UI فعلی):
 * نیم‌فاصله حذف می‌شود تا «لحاف‌دوزی» با «لحاف دوزی» match شود.
 */
export function buildSearchKey(input: string): string {
  return normalizePersian(input).replace(/ /g, "");
}

/**
 * نرمال‌ساز مشترک کد پستی — BUG-13 (فاز ۳)
 * ارقام فارسی/عربی → لاتین + حذف فاصله/خط‌تیره؛ در هر دو اسکیمای
 * حساب (addressV2) و چک‌اوت (checkoutAddress) استفاده می‌شود تا
 * «۱۲۳۴۵-۶۷۸۹۰» همه‌جا یکسان پذیرفته/رد شود.
 */
export function normalizePostalCode(input: string): string {
  return normalizeFaDigits(normalizePersian(input)).replace(/[\s-]/g, "");
}
