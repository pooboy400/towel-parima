// ISR — بازتولید دوره‌ای در سرور (فاز ۲: همگام با بک‌اند)
export const revalidate = 3600;

import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, BookOpen, Clock } from "lucide-react";
import {
  getAllJournalSlugs,
  getJournalPostBySlug,
  getJournalPosts,
} from "@/services/content-service";
import { Breadcrumb } from "@/components/navigation/breadcrumb";
import { Button } from "@/components/ui/button";
import { formatDate, faDigits } from "@/lib/format";

/**
 * /journal/[slug] — جزئیات مقاله با SSG (پرامپت 89)
 */
export async function generateStaticParams() {
  const slugs = await getAllJournalSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await getJournalPostBySlug(slug);
  if (!post) return { title: "مقاله پیدا نشد" };
  return { title: post.title, description: post.excerpt };
}

export default async function JournalPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await getJournalPostBySlug(slug);
  if (!post) notFound();

  // ناوبری قبلی/بعدی — لیست به‌ترتیب تاریخ نزولی است
  const posts = await getJournalPosts();
  const index = posts.findIndex((p) => p.slug === post.slug);
  const newer = index > 0 ? posts[index - 1] : null;
  const older = index >= 0 && index < posts.length - 1 ? posts[index + 1] : null;

  return (
    <div className="container-brand py-8 lg:py-10">
      <Breadcrumb
        items={[
          { label: "خانه", href: "/" },
          { label: "ژورنال", href: "/journal" },
          { label: post.title },
        ]}
      />

      <article className="mt-6 lg:mt-8">
        {/* سربرگ مقاله */}
        <header className="mx-auto flex max-w-3xl flex-col items-start gap-4">
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
          <h1 className="text-3xl font-bold leading-[1.5] sm:text-4xl">
            {post.title}
          </h1>
          <p className="text-sm leading-7 text-muted-foreground">
            {post.excerpt}
          </p>
        </header>

        {/* تصویر شاخص */}
        <figure className="relative mx-auto mt-8 aspect-[16/9] max-w-3xl overflow-hidden rounded-lg lg:mt-10">
          <Image
            src={post.image}
            alt={`تصویر مقاله: ${post.title}`}
            fill
            priority
            sizes="(min-width: 768px) 768px, 100vw"
            className="object-cover"
          />
        </figure>

        {/* بدنه مقاله */}
        <div className="mx-auto mt-8 flex max-w-2xl flex-col gap-6 lg:mt-10">
          {post.content.map((paragraph, i) => (
            <p
              key={i}
              className="text-[15px] leading-9 text-foreground/85"
            >
              {paragraph}
            </p>
          ))}
        </div>

        {/* CTA راهنمای خرید */}
        <aside className="mx-auto mt-10 flex max-w-2xl flex-col items-start gap-4 rounded-lg bg-secondary p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
          <div className="flex items-start gap-4">
            <span className="hidden size-11 shrink-0 items-center justify-center rounded-md bg-surface sm:flex">
              <BookOpen className="size-5 text-terracotta-deep" aria-hidden />
            </span>
            <div className="flex flex-col gap-1">
              <h2 className="text-base font-bold">راهنمای خرید حوله</h2>
              <p className="text-sm leading-7 text-foreground/75">
                حالا که خواندید، مجموعه‌ی پریما را ببینید و با خیال راحت
                انتخاب کنید.
              </p>
            </div>
          </div>
          <Button variant="terracotta" asChild className="shrink-0">
            <Link href="/shop">
              مشاهده محصولات
              <ArrowLeft aria-hidden />
            </Link>
          </Button>
        </aside>

        {/* ناوبری مقاله قبلی/بعدی */}
        {(older || newer) && (
          <nav
            aria-label="ناوبری مقالات"
            className="mx-auto mt-10 flex max-w-2xl flex-col gap-4 border-t border-line pt-8 sm:flex-row sm:items-stretch sm:justify-between sm:gap-8"
          >
            <div className="sm:w-1/2">
              {older && (
                <Link
                  href={`/journal/${older.slug}`}
                  className="group flex h-full flex-col items-start gap-1.5 rounded-lg p-3 transition-colors hover:bg-secondary sm:items-end sm:text-right"
                >
                  <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                    <ArrowRight
                      className="size-3.5 transition-transform group-hover:translate-x-1"
                      aria-hidden
                    />
                    مقاله قبلی
                  </span>
                  <span className="text-sm font-semibold leading-7 transition-colors group-hover:text-terracotta-deep">
                    {older.title}
                  </span>
                </Link>
              )}
            </div>
            <div className="sm:w-1/2">
              {newer && (
                <Link
                  href={`/journal/${newer.slug}`}
                  className="group flex h-full flex-col items-start gap-1.5 rounded-lg p-3 transition-colors hover:bg-secondary"
                >
                  <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                    مقاله بعدی
                    <ArrowLeft
                      className="size-3.5 transition-transform group-hover:-translate-x-1"
                      aria-hidden
                    />
                  </span>
                  <span className="text-sm font-semibold leading-7 transition-colors group-hover:text-terracotta-deep">
                    {newer.title}
                  </span>
                </Link>
              )}
            </div>
          </nav>
        )}
      </article>
    </div>
  );
}
