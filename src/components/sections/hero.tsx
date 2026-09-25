import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";

/**
 * Hero — پرامپت 25: ساده و حسی، متن کم، یک CTA، تصویر Lifestyle Editorial
 */
export function Hero() {
  return (
    <section aria-labelledby="hero-title" className="bg-cream">
      <div className="container-brand">
        <div className="grid items-center gap-8 py-10 lg:grid-cols-2 lg:gap-14 lg:py-16">
          {/* متن */}
          <div className="flex flex-col items-start gap-5 lg:py-10">
            <p className="text-[13px] font-medium tracking-wide text-terracotta-deep">
              حوله‌های پریما
            </p>
            <h1
              id="hero-title"
              className="text-[34px] font-bold leading-[1.25] sm:text-5xl sm:leading-[1.2]"
            >
              یک حس نرم‌تر
              <br />
              برای هر روز
            </h1>
            <p className="max-w-md text-[15px] leading-8 text-muted-foreground sm:text-base">
              حوله‌هایی با تمرکز بر کیفیت، نرمی و تجربه‌ای که هر روز لمس
              می‌کنید؛ از پنبه شانه‌شده و بافت حلقه‌ای متراکم.
            </p>
            <Button size="lg" asChild className="mt-2">
              <Link href="/shop">مشاهده محصولات</Link>
            </Button>
          </div>

          {/* تصویر */}
          <div className="relative">
            <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg sm:aspect-[16/11]">
              <Image
                src="/images/hero-main.jpg"
                alt="حوله‌های کرم و بژ آویزان در حمامی مینیمال با نور طبیعی"
                fill
                priority
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="object-cover"
              />
            </div>
            {/* نشان کیفیت — ادیتوریال، نه بنر تخفیفی */}
            <div className="absolute -bottom-4 start-5 hidden rounded-lg border border-line bg-surface px-5 py-3.5 shadow-sm sm:block">
              <p className="text-sm font-semibold">۱۰۰٪ پنبه شانه‌شده</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                بافت حلقه‌ای · جذب بالا · بدون ریزش
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
