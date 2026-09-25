import type { Metadata } from "next";
import { Clock, Instagram, Mail, MapPin, Phone } from "lucide-react";
import { Breadcrumb } from "@/components/navigation/breadcrumb";
import { getStoreSettingsSafe } from "@/services/settings-service";
import { toLatinDigits } from "@/lib/format";
import { ContactForm } from "./contact-form";

export const metadata: Metadata = {
  title: "تماس با ما",
  description:
    "راه‌های ارتباط با پریما: تلفن، ایمیل، آدرس و ساعات پاسخ‌گویی. فرم تماس برای سؤال، پیشنهاد یا پیگیری سفارش.",
};

export default async function ContactPage() {
  // اطلاعات تماس از Settings دیتابیس — ویرایش ادمین بلافاصله اینجا هم دیده می‌شود
  const { config } = await getStoreSettingsSafe();

  // tel: باید با ارقام لاتین باشد تا در دیالر موبایل درست کار کند
  const telHref = `tel:${toLatinDigits(config.contact.phone)}`;

  // هندل اینستاگرام از URL تنظیمات استخراج می‌شود (نه متن ثابت)
  const instagramHandle = `@${config.contact.instagram
    .replace(/\/+$/, "")
    .split(/[\\/]/)
    .pop()}`;

  const contactMethods = [
    {
      icon: Phone,
      label: "تلفن پشتیبانی",
      value: config.contact.phone,
      href: telHref,
    },
    {
      icon: Mail,
      label: "ایمیل",
      value: config.contact.email,
      href: `mailto:${config.contact.email}`,
    },
    {
      icon: MapPin,
      label: "آدرس",
      value: config.contact.address,
    },
    {
      icon: Clock,
      label: "ساعات پاسخ‌گویی",
      value: config.contact.workingHours,
    },
  ];

  return (
    <div className="container-brand py-8 lg:py-10">
      <Breadcrumb
        items={[{ label: "خانه", href: "/" }, { label: "تماس با ما" }]}
      />

      <header className="mt-6 max-w-xl">
        <h1 className="text-2xl font-bold sm:text-3xl">تماس با ما</h1>
        <p className="mt-3 text-sm leading-7 text-muted-foreground">
          سؤالی درباره‌ی محصولات، سفارش‌تان یا پیشنهادی برای ما دارید؟ از هر
          مسیری که راحت‌ترید حرف بزنید؛ معمولاً در کمتر از یک روز کاری پاسخ
          می‌دهیم.
        </p>
      </header>

      <div className="mt-8 grid items-start gap-8 lg:mt-10 lg:grid-cols-[380px_1fr] lg:gap-12">
        {/* اطلاعات تماس */}
        <aside className="flex flex-col gap-3">
          <ul className="flex flex-col divide-y divide-line rounded-lg border border-line bg-surface">
            {contactMethods.map((method) => (
              <li key={method.label} className="flex items-start gap-4 p-5">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-secondary">
                  <method.icon className="size-4.5 text-terracotta-deep" aria-hidden />
                </span>
                <div className="flex min-w-0 flex-col gap-1">
                  <span className="text-xs text-muted-foreground">
                    {method.label}
                  </span>
                  {method.href ? (
                    <a
                      href={method.href}
                      className="break-words text-sm font-medium transition-colors hover:text-terracotta-deep"
                    >
                      {method.value}
                    </a>
                  ) : (
                    <span className="break-words text-sm font-medium leading-6">
                      {method.value}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>

          <a
            href={config.contact.instagram}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-4 rounded-lg border border-line bg-surface p-5 transition-colors hover:bg-secondary"
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-secondary">
              <Instagram className="size-4.5 text-terracotta-deep" aria-hidden />
            </span>
            <span className="flex min-w-0 flex-col gap-1">
              <span className="text-xs text-muted-foreground">اینستاگرام</span>
              <span className="text-sm font-medium" dir="ltr">
                {instagramHandle}
              </span>
            </span>
          </a>
        </aside>

        {/* فرم تماس */}
        <section
          aria-labelledby="contact-form-title"
          className="rounded-lg border border-line bg-surface p-6 sm:p-8"
        >
          <h2 id="contact-form-title" className="text-lg font-bold">
            فرم تماس
          </h2>
          <p className="mt-2 text-sm leading-7 text-muted-foreground">
            پیام‌تان را همین‌جا بنویسید؛ پاسخ به ایمیل ثبت‌شده ارسال می‌شود.
          </p>
          <ContactForm />
        </section>
      </div>
    </div>
  );
}
