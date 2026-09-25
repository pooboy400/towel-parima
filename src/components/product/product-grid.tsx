import { ProductCard } from "./product-card";
import type { Product } from "@/types";
import { cn } from "@/lib/utils";

/**
 * Product Grid — پرامپت 15: Desktop 4 / Tablet 3 / Mobile 2 ستون
 */
export function ProductGrid({
  products,
  className,
}: {
  products: Product[];
  className?: string;
}) {
  if (products.length === 0) {
    return (
      <div className="py-16 text-center">
        <p className="text-lg font-medium">محصولی پیدا نشد</p>
        <p className="mt-2 text-sm text-muted-foreground">
          فیلترها را تغییر دهید یا دسته دیگری را امتحان کنید.
        </p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-x-4 gap-y-8 sm:gap-x-6 lg:grid-cols-3 xl:grid-cols-4",
        className,
      )}
    >
      {products.map((p, i) => (
        <ProductCard key={p.id} product={p} priority={i < 4} />
      ))}
    </div>
  );
}
