import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";

const storyPoints = [
  {
    title: "پنبه شانه‌شده",
    description: "الیاف بلند و صاف‌شده که لطافت را سال‌ها حفظ می‌کند.",
  },
  {
    title: "بافت حلقه‌ای متراکم",
    description: "جذب آب چند برابر وزن؛ بدون ریزش و سفت‌شدن پس از شست‌وشو.",
  },
  {
    title: "دوسوزنه مقاوم",
    description: "لبه‌های دوتایی که درز حوله را در استفاده طولانی نگه می‌دارد.",
  },
];

/**
 * Brand Story — پرامپت 56: Photography + Typography + Short Copy ادیتوریال
 */
export function BrandStorySection() {
  return (
    <section aria-labelledby="story-title" className="py-14 lg:py-20">
      <div className="container-brand">
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
          {/* تصویر ادیتوریال */}
          <div className="relative order-2 lg:order-1">
            <div className="relative aspect-[4/5] overflow-hidden rounded-lg sm:aspect-[4/4]">
              <Image
                src="/images/lifestyle-warm.jpg"
                alt="حمامی مینیمال با حوله‌های کرم پریما و نور طبیعی"
                fill
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="object-cover"
              />
            </div>
            <div className="absolute -bottom-5 -end-3 hidden aspect-square w-44 overflow-hidden rounded-lg border-4 border-cream sm:block lg:w-52">
              <Image
                src="/images/lifestyle-shelf.jpg"
                alt="حوله‌های تاشده مرتب روی قفسه چوبی"
                fill
                sizes="200px"
                className="object-cover"
              />
            </div>
          </div>

          {/* متن */}
          <div className="order-1 flex flex-col gap-6 lg:order-2">
            <div className="flex flex-col gap-3">
              <span className="text-xs font-medium tracking-wide text-terracotta-deep">
                داستان پریما
              </span>
              <h2
                id="story-title"
                className="max-w-lg text-2xl font-bold leading-snug sm:text-[30px]"
              >
                حوله چیزی است که هر روز لمس می‌کنید؛ پس باید واقعاً خوب باشد.
              </h2>
              <p className="max-w-lg text-[15px] leading-8 text-muted-foreground">
                پریما از یک سؤال ساده شروع شد: چرا انتخاب حوله خوب این‌قدر سخت
                است؟ ما تصمیم گرفتیم محصولی بسازیم که لازم نباشد درباره‌اش فکر
                کنید — فقط استفاده‌اش کنید و حس نرمی‌اش را به یاد داشته باشید.
              </p>
            </div>

            <ul className="flex flex-col gap-5">
              {storyPoints.map((point, i) => (
                <li key={point.title} className="flex gap-4">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-[13px] font-semibold text-deep">
                    {["۱", "۲", "۳"][i]}
                  </span>
                  <div>
                    <h3 className="text-[15px] font-semibold">{point.title}</h3>
                    <p className="mt-1 text-[13px] leading-6 text-muted-foreground">
                      {point.description}
                    </p>
                  </div>
                </li>
              ))}
            </ul>

            <div>
              <Button variant="outline" asChild>
                <Link href="/about">بیشتر درباره پریما</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
