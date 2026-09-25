import { Rating } from "@/components/product/rating";
import { getTestimonials } from "@/services/content-service";
import { SectionHeading } from "./section-heading";

/**
 * Reviews — پرامپت 39: فقط نظرات واقعی
 * M1: تستیمونیال‌ها از DB (Setting) — بدون ادعای «خرید تأییدشده» چون فیلد
 * تأیید خرید برای تستیمونیال وجود ندارد؛ ادعای بدون پشتوانه ممنوع است.
 */
export async function ReviewsSection() {
  const testimonials = await getTestimonials();

  return (
    <section aria-labelledby="reviews-title" className="bg-surface py-14 lg:py-20">
      <div className="container-brand">
        <SectionHeading
          overline="نظر مشتریان"
          title="از زبان کسانی که لمس کرده‌اند"
          align="center"
        />

        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {testimonials.map((t) => (
            <figure
              key={t.id}
              className="flex flex-col gap-4 rounded-lg border border-line bg-cream p-6"
            >
              <Rating value={t.rating} />
              <blockquote className="flex-1 text-sm leading-7 text-foreground/90">
                «{t.comment}»
              </blockquote>
              <figcaption className="flex items-center gap-3">
                <span className="flex size-9 items-center justify-center rounded-full bg-sand/40 text-sm font-semibold text-deep">
                  {t.userName.slice(0, 1)}
                </span>
                <span className="flex flex-col">
                  <span className="text-[13px] font-medium">{t.userName}</span>
                  <span className="text-xs text-muted-foreground">{t.city}</span>
                </span>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
