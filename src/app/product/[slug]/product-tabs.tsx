import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Rating } from "@/components/product/rating";
import { formatNumber, formatDate } from "@/lib/format";
import type { Product, Review } from "@/types";

/**
 * Tabs مشخصات / نگهداری / نظرات — پرامپت 34، 35، 39
 */
export function ProductTabs({
  product,
  reviews,
}: {
  product: Product;
  reviews: Review[];
}) {
  return (
    <Tabs defaultValue="specs" className="mt-14">
      <TabsList className="h-auto w-full justify-start gap-1 rounded-none border-b border-line bg-transparent p-0">
        <TabsTrigger
          value="specs"
          className="rounded-none border-0 border-b-2 border-transparent px-4 py-3 text-sm data-[state=active]:border-deep data-[state=active]:bg-transparent data-[state=active]:shadow-none"
        >
          مشخصات
        </TabsTrigger>
        <TabsTrigger
          value="care"
          className="rounded-none border-0 border-b-2 border-transparent px-4 py-3 text-sm data-[state=active]:border-deep data-[state=active]:bg-transparent data-[state=active]:shadow-none"
        >
          نگهداری
        </TabsTrigger>
        <TabsTrigger
          value="reviews"
          className="rounded-none border-0 border-b-2 border-transparent px-4 py-3 text-sm data-[state=active]:border-deep data-[state=active]:bg-transparent data-[state=active]:shadow-none"
        >
          نظرات ({formatNumber(product.reviewCount)})
        </TabsTrigger>
      </TabsList>

      <TabsContent value="specs" className="pt-7">
        <div className="grid gap-x-10 gap-y-0 sm:grid-cols-2">
          {product.specs.map((spec) => (
            <div
              key={spec.label}
              className="flex items-center justify-between border-b border-line/70 py-3.5 text-sm"
            >
              <span className="text-muted-foreground">{spec.label}</span>
              <span className="font-medium">{spec.value}</span>
            </div>
          ))}
        </div>

        {/* ویژگی‌ها */}
        <div className="mt-8 flex flex-wrap gap-2">
          {product.features.map((f) => (
            <span
              key={f}
              className="rounded-sm bg-secondary px-3 py-1.5 text-xs font-medium text-deep"
            >
              {f}
            </span>
          ))}
        </div>
      </TabsContent>

      <TabsContent value="care" className="pt-7">
        <h3 className="text-[15px] font-semibold">راهنمای نگهداری</h3>
        <ul className="mt-4 flex flex-col gap-3">
          {product.care.map((c, i) => (
            <li key={i} className="flex gap-3 text-sm leading-7 text-muted-foreground">
              <span className="mt-2.5 size-1.5 shrink-0 rounded-full bg-terracotta" aria-hidden />
              {c}
            </li>
          ))}
        </ul>
      </TabsContent>

      <TabsContent value="reviews" className="pt-7">
        <ReviewSummary product={product} reviews={reviews} />
        <div className="mt-8 flex flex-col gap-6">
          {reviews.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              هنوز نظری برای این محصول ثبت نشده است. اولین نفر باشید.
            </p>
          ) : (
            reviews.map((r) => (
              <article
                key={r.id}
                className="flex flex-col gap-2.5 border-b border-line/70 pb-6 last:border-0"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <span className="flex size-9 items-center justify-center rounded-full bg-sand/40 text-sm font-semibold text-deep">
                      {r.userName.slice(0, 1)}
                    </span>
                    <span className="flex flex-col">
                      <span className="text-sm font-medium">{r.userName}</span>
                      {r.verifiedPurchase && (
                        <span className="text-[11px] text-sage">
                          خرید تأییدشده
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Rating value={r.rating} />
                    <time className="text-xs text-muted-foreground" dateTime={r.date}>
                      {formatDate(r.date)}
                    </time>
                  </div>
                </div>
                <p className="text-sm leading-7 text-foreground/90">{r.comment}</p>
              </article>
            ))
          )}
        </div>
      </TabsContent>
    </Tabs>
  );
}

function ReviewSummary({ product, reviews }: { product: Product; reviews: Review[] }) {
  // توزیع امتیاز از داده واقعی reviews محاسبه می‌شود
  const buckets = [5, 4, 3, 2, 1].map((star) => ({
    star,
    count: reviews.filter((r) => Math.round(r.rating) === star).length,
  }));
  const max = Math.max(1, ...buckets.map((b) => b.count));

  return (
    <div className="grid gap-8 rounded-lg border border-line bg-surface p-6 sm:grid-cols-[auto_1fr] sm:gap-12">
      <div className="flex flex-col items-center justify-center gap-1.5">
        <span className="text-4xl font-bold">{formatNumber(product.rating)}</span>
        <Rating value={product.rating} />
        <span className="text-xs text-muted-foreground">
          از {formatNumber(product.reviewCount)} نظر
        </span>
      </div>
      <div className="flex flex-col justify-center gap-2">
        {buckets.map((b) => (
          <div key={b.star} className="flex items-center gap-3 text-xs">
            <span className="w-8 text-muted-foreground">{formatNumber(b.star)} ★</span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full rounded-full bg-sand"
                style={{ width: `${(b.count / max) * 100}%` }}
              />
            </div>
            <span className="w-6 text-left text-muted-foreground">
              {formatNumber(b.count)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
