import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { formatPrice, faDigits } from "@/lib/format";
import { getStoreConfig } from "@/services/settings-service";
import { storeConfig as fallbackConfig } from "@/lib/config";
import { PrintButton } from "./print-button";

export const dynamic = "force-dynamic";

/**
 * Invoice — فاکتور چاپی سفارش. همه مبالغ snapshot رکورد Order هستند (§14)؛
 * قیمت فعلی محصول هرگز در فاکتور ظاهر نمی‌شود.
 */
export default async function InvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const order = await db.order.findUnique({
    where: { id },
    include: { items: true, payments: { orderBy: { createdAt: "desc" }, take: 1 } },
  });
  if (!order) notFound();

  const address = order.shippingAddress as {
    fullName: string;
    province: string;
    city: string;
    line: string;
    postalCode: string;
  };

  const payment = order.payments[0];

  // برند فاکتور از تنظیمات دیتابیس — نه اسم ثابت در کد
  const brandName = await getStoreConfig()
    .then((c) => c.brandName)
    .catch(() => fallbackConfig.brandName);

  return (
    <div className="mx-auto max-w-3xl p-8 print:p-0" dir="rtl">
      <PrintButton />

      <header className="mt-6 flex items-start justify-between border-b-2 border-foreground pb-4">
        <div>
          <h1 className="text-2xl font-black">{brandName}</h1>
          <p className="text-sm text-muted-foreground">فروشگاه حوله‌های پریمیوم</p>
        </div>
        <div className="text-end text-sm">
          <p className="font-semibold">فاکتور فروش</p>
          <p dir="ltr">کد سفارش: {faDigits(order.code)}</p>
          <p className="text-muted-foreground">
            {faDigits(order.placedAt.toLocaleDateString("fa-IR"))}
          </p>
        </div>
      </header>

      <section className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-md border p-4 text-[13px] leading-6">
          <p className="mb-1 font-semibold">گیرنده</p>
          <p>{address.fullName}</p>
          <p dir="ltr" className="text-muted-foreground">{faDigits(order.phone)}</p>
          <p className="text-muted-foreground">
            {address.province}، {address.city}، {address.line}
          </p>
          <p className="text-muted-foreground" dir="ltr">کد پستی: {faDigits(address.postalCode)}</p>
        </div>
        <div className="rounded-md border p-4 text-[13px] leading-6">
          <p className="mb-1 font-semibold">پرداخت</p>
          <p>
            وضعیت:{" "}
            {payment?.status === "PAID"
              ? "پرداخت شده"
              : payment?.status === "FAILED"
                ? "ناموفق"
                : "در انتظار"}
          </p>
          {payment?.transactionId && (
            <p dir="ltr" className="break-all text-muted-foreground">
              شماره پیگیری: {payment.transactionId}
            </p>
          )}
          <p className="text-muted-foreground">واحد پول: تومان</p>
        </div>
      </section>

      <table className="mt-6 w-full text-[13px]" dir="rtl">
        <thead>
          <tr className="border-b border-foreground/40">
            <th className="py-2 text-start font-semibold">کالا</th>
            <th className="py-2 text-start font-semibold">کد SKU</th>
            <th className="py-2 text-start font-semibold">تعداد</th>
            <th className="py-2 text-start font-semibold">قیمت واحد</th>
            <th className="py-2 text-start font-semibold">جمع</th>
          </tr>
        </thead>
        <tbody>
          {order.items.map((item) => (
            <tr key={item.id} className="border-b border-line/70">
              <td className="py-2.5">
                {item.productNameSnapshot}
                {item.variantNameSnapshot && (
                  <span className="text-muted-foreground"> — {item.variantNameSnapshot}</span>
                )}
              </td>
              <td className="py-2.5 font-mono text-xs" dir="ltr">{item.skuSnapshot}</td>
              <td className="py-2.5">{faDigits(item.quantity)}</td>
              <td className="py-2.5">{formatPrice(item.unitPrice, false)}</td>
              <td className="py-2.5 font-medium">{formatPrice(item.total, false)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <section className="mt-4 flex justify-end">
        <dl className="w-64 text-[13px]">
          <div className="flex justify-between py-1">
            <dt className="text-muted-foreground">جمع کالاها</dt>
            <dd>{formatPrice(order.subtotal, false)}</dd>
          </div>
          {order.discountTotal > 0 && (
            <div className="flex justify-between py-1 text-sage">
              <dt>تخفیف {order.couponCodeSnapshot ? `(${order.couponCodeSnapshot})` : ""}</dt>
              <dd>−{formatPrice(order.discountTotal, false)}</dd>
            </div>
          )}
          <div className="flex justify-between py-1">
            <dt className="text-muted-foreground">ارسال</dt>
            <dd>{order.shippingTotal === 0 ? "رایگان" : formatPrice(order.shippingTotal, false)}</dd>
          </div>
          <div className="flex justify-between border-t border-foreground/40 py-2 text-base font-bold">
            <dt>مبلغ نهایی</dt>
            <dd>{formatPrice(order.grandTotal, false)}</dd>
          </div>
        </dl>
      </section>

      <footer className="mt-8 border-t border-line pt-4 text-center text-xs text-muted-foreground">
        این فاکتور به‌صورت الکترونیکی صادر شده است · فروشگاه {brandName}
      </footer>
    </div>
  );
}
