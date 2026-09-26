import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Droplets, Leaf, ShieldCheck } from "lucide-react";
import { Breadcrumb } from "@/components/navigation/breadcrumb";
import { SectionHeading } from "@/components/sections/section-heading";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "داستان پریما",
  description:
    "پریما از یک ناراحتی ساده شروع شد: چرا چیزی که هر روز لمس می‌کنیم، این‌قدر بی‌کیفیت ساخته می‌شود؟ داستان برند، فلسفه و تعهد ما به کیفیت.",
};

const values = [
  {
    title: "پنبه شانه‌شده",
    image: "/images/lifestyle-shelf.jpg",
    alt: "حوله‌های رنگی پنبه‌ای مرتب روی قفسه چوبی در نور طبیعی",
    text: "قبل از بافت، الیاف پنبه از شانه‌های مکانیکی عبور می‌کنند تا الیاف کوتاه و شکننده جدا شوند. نتیجه، نخی صاف‌تر و مقاوم‌تر است که کمتر پرز می‌دهد و سال‌ها نرمی‌اش را نگه می‌دارد.",
  },
  {
    title: "بافت حلقه‌ای متراکم",
    image: "/images/lifestyle-wood.jpg",
    alt: "بافت حلقه‌ای حوله از نمای نزدیک روی سطح چوبی",
    text: "حلقه‌های بلند و متراکم بافت، آب را مثل صدها دکل کوچک جذب می‌کنند. همین ساختار است که تفاوت «خیس شدن» و «خشک شدن واقعی» را می‌سازد؛ حوله‌ای که آب را می‌گیرد و خودش هم زود می‌خشکد.",
  },
  {
    title: "دوسوزنه مقاوم",
    image: "/images/lifestyle-spa.jpg",
    alt: "لبه دوخته‌شده حوله در فضای آرام اسپا",
    text: "لبه‌ی حوله، جایی است که معمولاً اول از همه از هم می‌پاشد. دوخت دوسوزنه با فاصله‌ی دقیق، لبه‌ها را قفل می‌کند تا بعد از صدها بار شست‌وشو، هنوز صاف و هم‌شکل بماند.",
  },
];

const commitments = [
  {
    icon: Leaf,
    title: "پنبه‌ی صددرصد طبیعی",
    text: "هیچ الیاف مصنوعی‌ای در نخ‌های ما نیست؛ پوست با چیزی که می‌شناسد راحت است، نه با چیزی که فقط شبیه آن است.",
  },
  {
    icon: Droplets,
    title: "جذب واقعی، خشک‌شدن سریع",
    text: "وزن هر مدل برای جای استفاده‌اش انتخاب شده است؛ نه برای سنگین‌تر به نظر رسیدن. حوله‌ای که آب را می‌گیرد باید خودش هم زود آماده‌ی بار بعد باشد.",
  },
  {
    icon: ShieldCheck,
    title: "ضمانت کیفیت",
    text: "اگر در استفاده‌ی درست، ایراد دوخت یا رنگ‌دهی ببینید، تکه را عوض می‌کنیم. بدون استدلال، بدون فرم طولانی.",
  },
];

export default function AboutPage() {
  return (
    <div className="container-brand py-8 lg:py-10">
      <Breadcrumb
        items={[{ label: "خانه", href: "/" }, { label: "داستان پریما" }]}
      />

      {/* Hero — ساده و داستانی */}
      <header className="mt-6 grid items-center gap-8 lg:mt-10 lg:grid-cols-2 lg:gap-14">
        <div className="flex flex-col items-start gap-5">
          <span className="text-xs font-medium tracking-wide text-terracotta-deep">
            داستان ما
          </span>
          <h1 className="text-3xl font-bold leading-[1.5] sm:text-4xl lg:text-[42px]">
            حوله چیزی است که
            <br />
            هر روز لمس می‌کنید
          </h1>
          <p className="max-w-md text-[15px] leading-8 text-muted-foreground">
            و همین «هر روز» بود که ما را جدی کرد. ما در پریما حوله‌هایی
            می‌سازیم که بعد از صدمین بار شست‌وشو هم به آغوش‌شان خوش بیایید.
          </p>
        </div>
        <div className="relative aspect-[4/5] overflow-hidden rounded-lg sm:aspect-[16/9] lg:aspect-[16/10]">
          <Image
            src="/images/lifestyle-warm.jpg"
            alt="حوله‌های کرم و بژ پریما در نور گرم صبحگاهی کنار پنجره"
            fill
            priority
            sizes="(min-width: 1024px) 576px, 100vw"
            className="object-cover"
          />
        </div>
      </header>

      {/* چرا پریما — داستان برند */}
      <section className="py-14 lg:py-20" aria-labelledby="why-prima">
        <SectionHeading
          overline="چرا پریما؟"
          title="از یک ناراحتی ساده شروع شد"
        />
        <div className="mt-8 grid max-w-3xl gap-6 text-[15px] leading-9 text-foreground/85 lg:mt-10">
          <p>
            چند سال پیش، برای خانه‌ی تازه‌ای حوله خریدیم؛ رنگ‌ها جذاب بودند و
            قیمت‌ها هم. اما بعد از چند بار شست‌وشو، نرمی رفت، پرزها ماند و لبه‌ها
            کج شد. پرسش ساده‌ای شکل شد: چرا چیزی که هر روز با پوست‌مان تماس
            دارد، این‌قدر بی‌کیفیت ساخته می‌شود؟
          </p>
          <p>
            در جست‌وجوی جواب، سراغ کارگاه‌هایی رفتیم که سال‌ها برای برندهای
            بزرگ دنیا بافته بودند اما هیچ‌وقت اسمی نداشتند. تصمیم‌مان ساده بود:
            به‌جای صد مدل متوسط، چند مدل بی‌نقص. کمتر، اما بهتر. هر تکه‌ای که به
            فروشگاه راه پیدا می‌کند، اول چند ماه در خانه‌های خودمان، زیر دوش،
            کنار استخر و دست کودکان تست می‌شود؛ چیزی که خوب از آب درنیاید اصلاً
            عرضه نمی‌شود، حتی اگر زیبا باشد.
          </p>
          <p>
            این وسواس جزئیات کوچکی دارد: پنبه‌ای که قبل از بافت شانه می‌شود تا
            الیاف کوتاهش جدا شوند؛ وزنی که نه سبک باشد نه خفه؛ دوخت دوسوزنه‌ای
            که لبه‌ها را سال‌ها صاف نگه می‌دارد؛ و رنگ‌هایی که با پالت خانه‌های
            ایرانی هماهنگ‌اند، نه با ویترین فروشگاه. ما حوله نمی‌فروشیم؛ چیزی
            می‌سازیم که هر روز لمسش می‌کنید و هر بار، کمی راحت‌تر نفس می‌کشید.
          </p>
        </div>
      </section>

      {/* ارزش‌ها — چیدمان ادیتوریال */}
      <section className="pb-14 lg:pb-20" aria-labelledby="craft">
        <SectionHeading
          overline="جزئیاتی که حس می‌شوند"
          title="سه چیز که در هر تکه پریما تکرار می‌شود"
        />
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:mt-12 lg:grid-cols-3 lg:gap-8">
          {values.map((value, i) => (
            <article
              key={value.title}
              className={`overflow-hidden rounded-lg border border-line bg-surface ${
                i === 1 ? "lg:mt-10" : ""
              }`}
            >
              <div className="relative aspect-[4/3]">
                <Image
                  src={value.image}
                  alt={value.alt}
                  fill
                  sizes="(min-width: 1024px) 384px, (min-width: 640px) 50vw, 100vw"
                  className="object-cover"
                />
              </div>
              <div className="flex flex-col gap-2.5 p-6">
                <h3 className="text-lg font-bold">{value.title}</h3>
                <p className="text-sm leading-7 text-muted-foreground">
                  {value.text}
                </p>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* تعهد ما */}
      <section
        className="rounded-lg bg-deep px-6 py-10 text-cream sm:px-10 lg:py-14"
        aria-labelledby="commitment"
      >
        <div className="grid gap-8 lg:grid-cols-[1fr_1.3fr] lg:gap-14">
          <div className="flex flex-col items-start gap-4">
            {/* 67-fe: روی bg-deep فقط tint روشن ≥۴.۵:۱ است */}
            <span className="text-xs font-medium tracking-wide text-terracotta-light">
              تعهد ما
            </span>
            <h2
              id="commitment"
              className="text-2xl font-bold leading-snug sm:text-[28px]"
            >
              مشت‌های ما در بافت
            </h2>
            <p className="max-w-sm text-sm leading-8 text-cream/70">
              هر حوله‌ای که از کارگاه ما بیرون می‌آید، امضای کسی را دارد که
              آن را بافته و بررسی کرده. این سه سطر، قرارداد ما با شماست؛
              روی کاغذ نیست، در الیاف است.
            </p>
          </div>
          <ul className="flex flex-col gap-6">
            {commitments.map((item) => (
              <li key={item.title} className="flex items-start gap-4">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-md bg-cream/10">
                  <item.icon className="size-5 text-terracotta" aria-hidden />
                </span>
                <div className="flex flex-col gap-1.5">
                  <h3 className="font-semibold">{item.title}</h3>
                  <p className="text-sm leading-7 text-cream/70">{item.text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* CTA پایانی */}
      <section className="flex flex-col items-center gap-4 py-14 text-center lg:py-20">
        <h2 className="text-2xl font-bold sm:text-[28px]">
          آماده‌ی لمس کردن تفاوت هستید؟
        </h2>
        <p className="max-w-md text-sm leading-7 text-muted-foreground">
          مجموعه‌ی کامل حوله‌های حمام، دست و صورت، استخری و ست‌های هدیه را
          ببینید و همان‌طور که می‌خواستید انتخاب کنید.
        </p>
        <Button size="lg" variant="terracotta" asChild className="mt-2">
          <Link href="/shop">
            مشاهده محصولات
            <ArrowLeft aria-hidden />
          </Link>
        </Button>
      </section>
    </div>
  );
}
