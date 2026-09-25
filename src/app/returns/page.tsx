import type { Metadata } from "next";
import { Breadcrumb } from "@/components/navigation/breadcrumb";
import { getStoreSettingsSafe } from "@/services/settings-service";
import { faDigits } from "@/lib/format";

export const metadata: Metadata = {
  title: "مرجوعی و تعویض",
  description:
    "شرایط مرجوعی ۷ روزه و تعویض ۱۴ روزه در پریما؛ مراحل ثبت درخواست و نکاتی که باید بدانید.",
};

const steps = [
  {
    title: "درخواست را ثبت کنید",
    text: "از طریق فرم تماس یا شماره پشتیبانی، شماره سفارش و دلیل مرجوعی یا تعویض را اعلام کنید. حداکثر یک روز کاری پاسخ می‌گیرید.",
  },
  {
    title: "بسته را آماده کنید",
    text: "محصول را همان‌طور که رسیده بسته‌بندی کنید؛ با برچسب و بسته‌بندی سالم. پیک ما در تهران و مرسوله‌ی پستی در سایر شهرها آن را دریافت می‌کند.",
  },
  {
    title: "بازگشت وجه یا تعویض",
    text: "پس از بررسی و تأیید کارشناس، مبلغ حداکثر تا سه روز کاری به حساب‌تان برمی‌گردد یا کالای تعویضی ارسال می‌شود؛ هر چه انتخاب کنید.",
  },
];

export default async function ReturnsPage() {
  const { shipping: shippingInfo } = await getStoreSettingsSafe();

  return (
    <div className="container-brand py-8 lg:py-10">
      <Breadcrumb
        items={[{ label: "خانه", href: "/" }, { label: "مرجوعی و تعویض" }]}
      />

      <article className="mt-6 max-w-2xl lg:mt-10">
        <h1 className="text-2xl font-bold sm:text-3xl">مرجوعی و تعویض</h1>

        <p className="mt-6 text-[15px] leading-9 text-foreground/85">
          می‌دانیم انتخاب حوله بدون لمس کردن سخت است؛ برای همین تصمیم گرفتیم
          ریسک انتخاب را از دوش شما برداریم. تا{" "}
          {faDigits(shippingInfo.returnWindowDays)} روز پس از دریافت، فرصت دارید
          سفارش را بدون دلیل مرجوع کنید و تا{" "}
          {faDigits(shippingInfo.exchangeWindowDays)} روز امکان تعویض رنگ یا
          سایز وجود دارد.
        </p>

        <h2 className="mt-10 text-lg font-bold">شرایط پذیرش</h2>
        <p className="mt-3 text-[15px] leading-9 text-foreground/85">
          محصول باید استفاده نشده باشد؛ برچسب‌ها و بسته‌بندی اصلی سالم و پیوست
          باشند. حوله‌ای که شسته شده یا بوی شوینده گرفته، قابل پذیرش نیست؛ چون
          بهداشت مشتری بعدی برای ما خط قرمز است. برای ست‌های هدیه، سالم بودن
          جعبه کافی است و کاغذ داخل آن نیازی به دست‌نخورده بودن ندارد.
        </p>

        <h2 className="mt-10 text-lg font-bold">مراحل درخواست</h2>
        <ol className="mt-4 flex flex-col gap-4">
          {steps.map((step, i) => (
            <li
              key={step.title}
              className="flex items-start gap-4 rounded-lg border border-line bg-surface p-5"
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-secondary text-sm font-bold text-terracotta-deep">
                {faDigits(i + 1)}
              </span>
              <div className="flex flex-col gap-1">
                <h3 className="text-[15px] font-semibold">{step.title}</h3>
                <p className="text-sm leading-7 text-muted-foreground">
                  {step.text}
                </p>
              </div>
            </li>
          ))}
        </ol>

        <h2 className="mt-10 text-lg font-bold">یک استثنا</h2>
        <p className="mt-3 text-[15px] leading-9 text-foreground/85">
          اگر محصول ایراد دوخت یا رنگ‌دهی داشته باشد، خارج از این بازه‌ها هم
          ضمانت کیفیت پریما شامل حال‌تان می‌شود؛ کافی است عکس مشکل را برای
          پشتیبانی بفرستید تا تعویض انجام شود. هزینه‌ی ارسال در این حالت با ما
          است.
        </p>
      </article>
    </div>
  );
}
