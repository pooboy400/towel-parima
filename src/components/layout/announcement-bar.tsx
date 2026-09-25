import { faDigits } from "@/lib/format";

/**
 * Announcement Bar — پرامپت 23: فقط مزیت واقعی، اطلاعات واقعی
 * همهٔ اعداد از Settings دیتابیس می‌آید (سرور → props)؛ هیچ عدد سفت‌شده‌ای نیست.
 */
export function AnnouncementBar({
  freeShippingThreshold,
  currencyLabel,
  exchangeWindowDays,
}: {
  freeShippingThreshold: number;
  currencyLabel: string;
  exchangeWindowDays: number;
}) {
  const threshold = new Intl.NumberFormat("fa-IR").format(
    freeShippingThreshold,
  );
  return (
    <div className="bg-deep text-cream">
      <p className="container-brand py-2 text-center text-xs sm:text-[13px]">
        ارسال رایگان برای سفارش‌های بالای {threshold} {currencyLabel} · ضمانت
        کیفیت و امکان تعویض تا {faDigits(exchangeWindowDays)} روز
      </p>
    </div>
  );
}
