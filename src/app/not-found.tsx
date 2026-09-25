import Link from "next/link";
import { Button } from "@/components/ui/button";

/**
 * 404 — Empty state انسانی، پرامپت 78 و 46
 */
export default function NotFound() {
  return (
    <div className="container-brand flex flex-col items-center py-20 text-center lg:py-28">
      <p className="text-6xl font-bold text-sand">۴۰۴</p>
      <h1 className="mt-4 text-xl font-bold sm:text-2xl">
        این صفحه پیدا نشد
      </h1>
      <p className="mt-3 max-w-md text-sm leading-7 text-muted-foreground">
        ممکن است آدرس تغییر کرده باشد یا محصول از فروشگاه حذف شده باشد.
        از فروشگاه، محصولات ما را ببینید.
      </p>
      <div className="mt-7 flex flex-wrap justify-center gap-2.5">
        <Button asChild>
          <Link href="/shop">مشاهده محصولات</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/">صفحه اصلی</Link>
        </Button>
      </div>
    </div>
  );
}
