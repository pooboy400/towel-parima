import Image from "next/image";
import Link from "next/link";
import { SectionHeading } from "./section-heading";
import { getJournalPosts } from "@/services/content-service";
import { formatDate } from "@/lib/format";

/**
 * Journal — پرامپت 57 و 89: محتوای کمک‌به‌تصمیم
 */
export async function JournalSection() {
  const posts = await getJournalPosts(3);

  return (
    <section aria-labelledby="journal-title" className="py-14 lg:py-20">
      <div className="container-brand">
        <SectionHeading
          overline="ژورنال"
          title="راهنمای انتخاب و نگهداری"
          description="هر چه لازم است قبل از خرید و بعد از خرید درباره حوله بدانید."
          linkHref="/journal"
        />

        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((post) => (
            <article key={post.id} className="group flex flex-col">
              <Link
                href={`/journal/${post.slug}`}
                className="relative aspect-[16/10] overflow-hidden rounded-lg"
              >
                <Image
                  src={post.image}
                  alt={post.title}
                  fill
                  sizes="(max-width: 768px) 100vw, 33vw"
                  className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                />
              </Link>
              <div className="flex flex-1 flex-col gap-2 pt-4">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="rounded-sm bg-secondary px-2 py-0.5 font-medium text-deep">
                    {post.category}
                  </span>
                  <time dateTime={post.date}>{formatDate(post.date)}</time>
                  <span aria-hidden>·</span>
                  <span>{post.readingTime} دقیقه مطالعه</span>
                </div>
                <h3 className="text-[17px] font-semibold leading-7">
                  <Link
                    href={`/journal/${post.slug}`}
                    className="transition-colors hover:text-terracotta-deep"
                  >
                    {post.title}
                  </Link>
                </h3>
                <p className="line-clamp-2 text-[13px] leading-6 text-muted-foreground">
                  {post.excerpt}
                </p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
