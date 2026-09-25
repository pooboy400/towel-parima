// ISR — بازتولید دوره‌ای در سرور (فاز ۲: همگام با بک‌اند)
export const revalidate = 3600;

import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Clock } from "lucide-react";
import { getJournalPosts } from "@/services/content-service";
import { Breadcrumb } from "@/components/navigation/breadcrumb";
import { formatDate, faDigits } from "@/lib/format";

export const metadata: Metadata = {
  title: "ژورنال پریما",
  description:
    "راهنماهای خرید، نگهداری و دانش حوله؛ مقالاتی کمک‌به‌تصمیم تا حوله‌ی درست را انتخاب و سال‌ها نگه دارید.",
};

export default async function JournalPage() {
  const posts = await getJournalPosts();
  const [featured, ...rest] = posts;

  return (
    <div className="container-brand py-8 lg:py-10">
      <Breadcrumb
        items={[{ label: "خانه", href: "/" }, { label: "ژورنال" }]}
      />

      <header className="mt-6 max-w-xl">
        <h1 className="text-2xl font-bold sm:text-3xl">ژورنال پریما</h1>
        <p className="mt-3 text-sm leading-7 text-muted-foreground">
          جایی که قبل از خرید، حرفه‌ای‌ها می‌خوانند. راهنمای انتخاب، شست‌وشو و
          همه‌ی چیزهایی که حوله‌ی شما را سال‌ها خوب نگه می‌دارد.
        </p>
      </header>

      {featured && (
        /* مقاله شاخص — چیدمان افقی در دسکتاپ */
        <article className="mt-8 lg:mt-10">
          <Link
            href={`/journal/${featured.slug}`}
            className="group grid items-center gap-6 rounded-lg lg:grid-cols-2 lg:gap-10"
          >
            <div className="relative aspect-[16/10] overflow-hidden rounded-lg">
              <Image
                src={featured.image}
                alt={`تصویر مقاله: ${featured.title}`}
                fill
                priority
                sizes="(min-width: 1024px) 576px, 100vw"
                className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
              />
            </div>
            <div className="flex flex-col items-start gap-3 lg:pe-6">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span className="font-medium text-terracotta-deep">
                  {featured.category}
                </span>
                <span aria-hidden>·</span>
                <time dateTime={featured.date}>{formatDate(featured.date)}</time>
                <span aria-hidden>·</span>
                <span className="inline-flex items-center gap-1">
                  <Clock className="size-3.5" aria-hidden />
                  {faDigits(featured.readingTime)} دقیقه مطالعه
                </span>
              </div>
              <h2 className="text-2xl font-bold leading-snug transition-colors group-hover:text-terracotta-deep sm:text-[28px]">
                {featured.title}
              </h2>
              <p className="max-w-xl text-sm leading-7 text-muted-foreground">
                {featured.excerpt}
              </p>
              <span className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-foreground/80 transition-colors group-hover:text-foreground">
                خواندن مقاله
                <ArrowLeft
                  className="size-4 transition-transform duration-200 group-hover:-translate-x-1"
                  aria-hidden
                />
              </span>
            </div>
          </Link>
        </article>
      )}

      <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:mt-14 lg:gap-8">
        {rest.map((post) => (
          <article key={post.id}>
            <Link
              href={`/journal/${post.slug}`}
              className="group flex h-full flex-col gap-4"
            >
              <div className="relative aspect-[16/10] overflow-hidden rounded-lg">
                <Image
                  src={post.image}
                  alt={`تصویر مقاله: ${post.title}`}
                  fill
                  sizes="(min-width: 1024px) 576px, (min-width: 640px) 50vw, 100vw"
                  className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                />
              </div>
              <div className="flex flex-1 flex-col items-start gap-2.5">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span className="font-medium text-terracotta-deep">
                    {post.category}
                  </span>
                  <span aria-hidden>·</span>
                  <time dateTime={post.date}>{formatDate(post.date)}</time>
                  <span aria-hidden>·</span>
                  <span className="inline-flex items-center gap-1">
                    <Clock className="size-3.5" aria-hidden />
                    {faDigits(post.readingTime)} دقیقه مطالعه
                  </span>
                </div>
                <h2 className="text-xl font-bold leading-snug transition-colors group-hover:text-terracotta-deep">
                  {post.title}
                </h2>
                <p className="line-clamp-2 text-sm leading-7 text-muted-foreground">
                  {post.excerpt}
                </p>
              </div>
            </Link>
          </article>
        ))}
      </div>
    </div>
  );
}
