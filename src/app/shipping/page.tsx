import type { Metadata } from "next";
import { Breadcrumb } from "@/components/navigation/breadcrumb";
import { getStoreSettingsSafe } from "@/services/settings-service";
import { formatPrice } from "@/lib/format";

export const metadata: Metadata = {
  title: "ارسال و تحویل",
  description:
    "جزئیات ارسال سفارش‌های پریما: زمان آماده‌سازی، هزینه ارسال عادی و اکسپرس، آستانه ارسال رایگان و مناطق تحت پوشش.",
};

export default async function ShippingPage() {
  // اعداد این صفحه از Settings دیتابیس — ویرایش ادمین بلافاصله اینجا هم دیده می‌شود
  const { config, shipping: shippingInfo } = await getStoreSettingsSafe();

  return (
    <div className="container-brand py-8 lg:py-10">
      <Breadcrumb
        items={[{ label: "خانه", href: "/" }, { label: "ارسال و تحویل" }]}
      />

      <article className="mt-6 max-w-2xl lg:mt-10">
        <h1 className="text-2xl font-bold sm:text-3xl">ارسال و تحویل</h1>

        <p className="mt-6 text-[15px] leading-9 text-foreground/85">
          هر سفارش در پریما حداکثر طی {shippingInfo.preparationDays} پس از ثبت،
          بسته‌بندی و به پست تحویل می‌شود. حوله‌ها در پک حمایتی ارسال می‌شوند تا
          حین حمل فرم‌شان حفظ شود و به دست‌تان برسند همان‌طور که از کارگاه
          بیرون آمده‌اند.
        </p>

        <h2 className="mt-10 text-lg font-bold">زمان تحویل</h2>
        <p className="mt-3 text-[15px] leading-9 text-foreground/85">
          ارسال عادی بین {shippingInfo.standardDays} طول می‌کشد و ارسال اکسپرس،
          سفارش را {shippingInfo.expressDays} به دست‌تان می‌رساند. زمان تحویل از
          لحظه‌ی تحویل مرسوله به شرکت حمل محاسبه می‌شود؛ روزهای تعطیل رسمی در آن
          حساب نمی‌شوند.
        </p>

        <h2 className="mt-10 text-lg font-bold">هزینه‌ی ارسال</h2>
        <p className="mt-3 text-[15px] leading-9 text-foreground/85">
          برای سفارش‌های بالای{" "}
          {formatPrice(config.freeShippingThreshold)}، ارسال به هر نقطه‌ی
          ایران رایگان است. زیر این مبلغ، هزینه‌ی ارسال عادی{" "}
          {formatPrice(config.standardShippingCost)} و ارسال اکسپرس{" "}
          {formatPrice(config.expressShippingCost)} است؛ مبلغ دقیق در
          مرحله‌ی پرداخت پیش از تأیید نهایی نمایش داده می‌شود.
        </p>

        <h2 className="mt-10 text-lg font-bold">مناطق تحت پوشش</h2>
        <p className="mt-3 text-[15px] leading-9 text-foreground/85">
          سفارش‌ها به سراسر کشور ارسال می‌شود. تهران و کلان‌شهرها با پیک و
          سرویس‌های سریع، سایر شهرها با پست پیشتاز. ارسال به مناطق مرکزی و
          مرزی ممکن است چند روز بیشتر زمان ببرد؛ در این مورد پیش از خرید می‌توانید
          با پشتیبانی هماهنگ کنید.
        </p>

        <h2 className="mt-10 text-lg font-bold">پیگیری سفارش</h2>
        <p className="mt-3 text-[15px] leading-9 text-foreground/85">
          بعد از تحویل مرسوله به شرکت حمل، کد رهگیری برای‌تان پیامک می‌شود.
          وضعیت لحظه‌ای سفارش را می‌توانید از صفحه‌ی «پیگیری سفارش» دنبال کنید
          یا هر سؤالی داشتید، با پشتیبانی در{" "}
          {config.contact.workingHours} تماس بگیرید.
        </p>
      </article>
    </div>
  );
}
