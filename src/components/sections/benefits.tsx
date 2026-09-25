import { Leaf, Droplets, Truck, RefreshCcw, ShieldCheck, Headset } from "lucide-react";
import { getStoreSettingsSafe } from "@/services/settings-service";
import { faDigits } from "@/lib/format";

const benefits = [
  {
    icon: Droplets,
    title: "جذب بالا",
    description: "بافت حلقه‌ای متراکم که آب را سریع جمع می‌کند.",
  },
  {
    icon: Leaf,
    title: "پنبه طبیعی",
    description: "الیاف صددرصد پنبه شانه‌شده، لطیف روی پوست.",
  },
  {
    icon: Truck,
    title: "ارسال سریع",
    description: "آماده‌سازی یک روزه و ارسال به سراسر کشور.",
  },
  {
    icon: RefreshCcw,
    title: "تعویض آسان",
    description: "تا {exchangeWindowDays} روز فرصت تعویض بدون سؤال اضافه.",
  },
  {
    icon: ShieldCheck,
    title: "ضمانت کیفیت",
    description: "اگر راضی نبودید، مشکل را درست می‌کنیم.",
  },
  {
    icon: Headset,
    title: "پشتیبانی واقعی",
    description: "پاسخ‌گویی انسانی در روزهای کاری.",
  },
];

/**
 * Benefits / Trust — پرامپت 38: فقط ادعاهای واقعی
 * بازهٔ تعویض از Settings دیتابیس می‌آید — عدد ثابت «۱۴ روز» نیست.
 */
export async function BenefitsSection() {
  const { shipping } = await getStoreSettingsSafe();

  return (
    <section aria-label="مزایای خرید از پریما" className="py-14 lg:py-20">
      <div className="container-brand">
        <div className="grid grid-cols-2 gap-x-6 gap-y-9 sm:grid-cols-3 lg:grid-cols-6">
          {benefits.map((b) => (
            <div key={b.title} className="flex flex-col items-start gap-3">
              <span className="flex size-11 items-center justify-center rounded-full bg-secondary text-deep">
                <b.icon className="size-5" aria-hidden />
              </span>
              <div>
                <h3 className="text-sm font-semibold">{b.title}</h3>
                <p className="mt-1 text-xs leading-6 text-muted-foreground">
                  {b.description.replace("{exchangeWindowDays}", faDigits(shipping.exchangeWindowDays))}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
