/**
 * QA Live Matrix — چک زنده همه مسیرهای کلیدی + وضعیت‌های مورد انتظار
 * اجرا: bun scripts/qa-live-matrix.ts [base-url]
 */

const BASE = process.argv[2] ?? "http://localhost:3000";

interface Row {
  path: string;
  expect: number;
  label: string;
}

const ROWS: Row[] = [
  { path: "/", expect: 200, label: "خانه" },
  { path: "/shop", expect: 200, label: "فروشگاه" },
  { path: "/collections", expect: 200, label: "کالکشن‌ها" },
  { path: "/product/prima-bath-towel", expect: 200, label: "صفحه محصول" },
  { path: "/product/does-not-exist", expect: 404, label: "محصول ناموجود → 404" },
  { path: "/category/does-not-exist", expect: 404, label: "دسته ناموجود → 404" },
  { path: "/journal", expect: 200, label: "ژورنال" },
  { path: "/faq", expect: 200, label: "سوالات متداول" },
  { path: "/about", expect: 200, label: "داستان پریما" },
  { path: "/contact", expect: 200, label: "تماس" },
  { path: "/cart", expect: 200, label: "سبد خرید" },
  { path: "/checkout", expect: 200, label: "تسویه حساب" },
  { path: "/account", expect: 200, label: "حساب کاربری" },
  { path: "/order-tracking", expect: 200, label: "پیگیری سفارش" },
  { path: "/wishlist", expect: 200, label: "علاقه‌مندی‌ها" },
  { path: "/shipping", expect: 200, label: "ارسال" },
  { path: "/returns", expect: 200, label: "بازگشت" },
  { path: "/privacy", expect: 200, label: "حریم خصوصی" },
  { path: "/terms", expect: 200, label: "قوانین" },
  { path: "/admin/login", expect: 200, label: "ورود ادمین" },
  { path: "/api/health", expect: 200, label: "سلامت API" },
  { path: "/api/search?q=%D8%AD%D9%88%D9%84%D9%87", expect: 200, label: "جستجوی فارسی" },
  { path: "/mock-gateway?authority=x", expect: 200, label: "درگاه mock (dev)" },
];

let pass = 0;
let fail = 0;

for (const row of ROWS) {
  try {
    const res = await fetch(`${BASE}${row.path}`, { redirect: "manual" });
    const ok = res.status === row.expect;
    if (ok) pass++;
    else fail++;
    console.log(`${ok ? "PASS" : "FAIL"} ${res.status}(expect ${row.expect}) ${row.label} ${row.path}`);
  } catch (e) {
    fail++;
    console.log(`FAIL ERROR ${row.label} ${row.path} — ${String(e).slice(0, 80)}`);
  }
}

console.log(`\nنتیجه: ${pass}/${ROWS.length} PASS`);
process.exit(fail > 0 ? 1 : 0);
