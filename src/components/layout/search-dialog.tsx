"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Search } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { formatPrice } from "@/lib/format";

interface SearchItem {
  name: string;
  slug: string;
  image: string;
  price: number;
  category: string;
}

type SearchStatus = "idle" | "loading" | "done";

/** پیشنهاد پیش‌فرض — فقط وقتی دسته‌بندی زنده‌ای از سرور نرسیده باشد */
const FALLBACK_SUGGESTIONS = ["حوله حمام", "ست", "تن‌پوش", "کودک", "استخری"];

/**
 * Quick Search — پرامپت 45 و 88: سریع، پیشنهاد، Empty state انسانی
 * Stateها از query مشتق می‌شوند تا setState-in-effect نداشته باشیم.
 * پیشنهادهای جستجو از دسته‌بندی‌های زندهٔ دیتابیس می‌آید (سرور → props).
 */
export function SearchDialog({
  open,
  onOpenChange,
  suggestions = FALLBACK_SUGGESTIONS,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  suggestions?: string[];
}) {
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<SearchItem[]>([]);
  const [status, setStatus] = useState<SearchStatus>("idle");
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const trimmed = query.trim();
  const hasQuery = trimmed.length >= 2;

  // Debounce جستجو — setState فقط در callback غیرهمگام (مجاز)
  useEffect(() => {
    const q = trimmed;
    if (q.length < 2) return;
    const t = setTimeout(async () => {
      setStatus("loading");
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        setItems(data.items ?? []);
      } catch {
        setItems([]);
      } finally {
        setStatus("done");
      }
    }, 250);
    return () => clearTimeout(t);
  }, [trimmed]);

  const reset = () => {
    setQuery("");
    setItems([]);
    setStatus("idle");
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const submit = () => {
    if (!hasQuery) return;
    const q = trimmed;
    reset();
    onOpenChange(false);
    router.push(`/shop?query=${encodeURIComponent(q)}`);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="top-24 translate-y-0 gap-0 rounded-lg p-0 sm:max-w-xl">
        <DialogHeader className="sr-only">
          <DialogTitle>جستجو در محصولات</DialogTitle>
          <DialogDescription>
            نام محصول یا دسته مورد نظر را بنویسید
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-3 border-b border-line px-5">
          <Search className="size-5 shrink-0 text-muted-foreground" aria-hidden />
          <input
            ref={inputRef}
            autoFocus
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="دنبال چه حوله‌ای هستید؟"
            aria-label="جستجو"
            className="h-14 w-full bg-transparent text-[15px] outline-none placeholder:text-muted-foreground/70"
          />
        </div>

        <div className="max-h-[50vh] overflow-y-auto p-3">
          {!hasQuery && (
            <div className="px-2 py-6">
              <p className="text-xs font-medium text-muted-foreground">
                جستجوهای پیشنهادی
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setQuery(s)}
                    className="rounded-sm border border-line px-3 py-1.5 text-[13px] transition-colors hover:bg-secondary"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {hasQuery && status !== "done" && (
            <p className="px-2 py-8 text-center text-sm text-muted-foreground">
              در حال جستجو…
            </p>
          )}

          {hasQuery && status === "done" && items.length === 0 && (
            <div className="px-2 py-8 text-center">
              <p className="text-sm font-medium">نتیجه‌ای پیدا نشد</p>
              <p className="mt-1.5 text-[13px] text-muted-foreground">
                محصول یا دسته دیگری را امتحان کنید.
              </p>
            </div>
          )}

          {items.length > 0 && status === "done" && (
            <ul className="flex flex-col gap-1">
              {items.map((item) => (
                <li key={item.slug}>
                  <Link
                    href={`/product/${item.slug}`}
                    onClick={() => handleOpenChange(false)}
                    className="flex items-center gap-3 rounded-md p-2 transition-colors hover:bg-secondary"
                  >
                    <span className="relative size-14 shrink-0 overflow-hidden rounded-sm bg-secondary/50">
                      <Image
                        src={item.image}
                        alt=""
                        fill
                        sizes="56px"
                        className="object-cover"
                      />
                    </span>
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate text-sm font-medium">
                        {item.name}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatPrice(item.price)}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        {hasQuery && (
          <div className="border-t border-line p-3">
            <button
              type="button"
              onClick={submit}
              className="w-full rounded-sm py-2.5 text-sm font-medium text-terracotta-deep transition-colors hover:bg-secondary"
            >
              مشاهده همه نتایج «{trimmed}»
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
