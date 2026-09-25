import { db } from "@/lib/db";
import { paymentProvider } from "@/providers/payment";
import { allowMocksInProduction } from "@/core/env";

export const dynamic = "force-dynamic";

/**
 * Mock Gateway — شبیه‌ساز درگاه پرداخت (فقط dev)
 * Route Handler — HTML مستقل با دکمه‌های «پرداخت موفق/ناموفق».
 * در production هرگز در دسترس نیست (گارد دوبل: provider + این route).
 */

export async function GET(request: Request) {
  if (
    (process.env.NODE_ENV === "production" && !allowMocksInProduction()) ||
    paymentProvider.name !== "mock"
  ) {
    return new Response("Not Found", { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const authority = searchParams.get("authority") ?? "";

  // اعتبار ابتدایی — authority باید متعلق به یک Payment PENDING باشد
  const payment = authority
    ? await db.payment.findUnique({
        where: { authority },
        select: { status: true, amount: true, order: { select: { code: true } } },
      })
    : null;

  const html = `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>درگاه پرداخت آزمایشی</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: system-ui, -apple-system, "Segoe UI", Tahoma, sans-serif;
    background: #f5f1ea; min-height: 100vh; display: flex; align-items: center;
    justify-content: center; padding: 16px; }
  .card { background: #fff; border-radius: 12px; box-shadow: 0 10px 40px rgba(0,0,0,.08);
    max-width: 420px; width: 100%; padding: 32px; text-align: center; }
  .badge { display: inline-block; background: #eee; border-radius: 999px;
    padding: 6px 14px; font-size: 12px; color: #666; margin-bottom: 16px; }
  h1 { font-size: 20px; margin-bottom: 8px; }
  .amount { font-size: 28px; font-weight: 700; margin: 16px 0 4px; }
  .meta { color: #888; font-size: 13px; margin-bottom: 24px; }
  .btns { display: flex; flex-direction: column; gap: 10px; }
  a.btn { display: block; padding: 14px; border-radius: 8px; text-decoration: none;
    font-weight: 600; font-size: 15px; transition: opacity .15s; }
  a.btn:hover { opacity: .85; }
  .pay { background: #2e7d32; color: #fff; }
  .cancel { background: #c62828; color: #fff; }
  .note { margin-top: 20px; font-size: 12px; color: #aaa; line-height: 1.8; }
</style>
</head>
<body>
  <div class="card">
    <span class="badge">درگاه آزمایشی — بدون انتقال پول واقعی</span>
    ${
      payment && payment.status === "PENDING"
        ? `
    <h1>پرداخت سفارش</h1>
    <div class="amount">${payment.amount.toLocaleString("fa-IR")} تومان</div>
    <div class="meta">کد سفارش: ${payment.order.code}</div>
    <div class="btns">
      <a class="btn pay" href="/checkout/callback?authority=${encodeURIComponent(authority)}&status=OK">پرداخت موفق (آزمایش)</a>
      <a class="btn cancel" href="/checkout/callback?authority=${encodeURIComponent(authority)}&status=NOK">انصراف / پرداخت ناموفق</a>
    </div>`
        : `
    <h1>تراکنش یافت نشد</h1>
    <div class="meta">این authority معتبر نیست یا قبلاً مصرف شده است.</div>`
    }
    <p class="note">این صفحه شبیه‌ساز داخلی درگاه برای توسعه است.<br/>درگاه واقعی (زرین‌پال) در مرحله M5 وصل می‌شود.</p>
  </div>
</body>
</html>`;

  return new Response(html, {
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}
