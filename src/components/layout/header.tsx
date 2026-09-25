"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Heart, Menu, Search, ShoppingBag, User, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "./logo";
import { SearchDialog } from "./search-dialog";
import { useCartStore } from "@/store/cart-store";
import { useWishlistStore } from "@/store/wishlist-store";
import { getCartCount } from "@/lib/cart-logic";
import { useMounted } from "@/hooks/use-mounted";
import type { Category, Collection } from "@/types";

const navLinks = [
  { label: "فروشگاه", href: "/shop" },
  { label: "کالکشن‌ها", href: "/collections" },
  { label: "داستان پریما", href: "/about" },
  { label: "ژورنال", href: "/journal" },
];

/**
 * Header — پرامپت 22
 * Desktop: Logo | Shop · Collections · About · Journal | Search · Wishlist · Cart · Account
 * Mobile: Menu | Logo | Search · Cart
 * داده‌های ناوبری و پیشنهادهای جستجو از Server Component والد (site-header) تزریق می‌شود.
 */
export function Header({
  categories,
  collections,
  searchSuggestions,
}: {
  categories: Category[];
  collections: Collection[];
  searchSuggestions?: string[];
}) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const mounted = useMounted();
  const rawCartCount = useCartStore((s) => getCartCount(s.lines));
  const cartCount = mounted ? rawCartCount : 0;
  const openCart = useCartStore((s) => s.open);
  const rawWishlistCount = useWishlistStore((s) => s.items.length);
  const wishlistCount = mounted ? rawWishlistCount : 0;
  const pathname = usePathname();

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      <header
        className={cn(
          "sticky top-0 z-40 bg-cream/95 backdrop-blur transition-shadow duration-200",
          isScrolled && "shadow-sm",
        )}
      >
        <div className="container-brand">
          <div className="flex h-16 items-center justify-between gap-4 lg:h-20">
            {/* موبایل: منو */}
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-label="باز کردن منو"
              className="flex size-10 items-center justify-center rounded-sm transition-colors hover:bg-secondary lg:hidden"
            >
              <Menu className="size-5" aria-hidden />
            </button>

            <Logo />

            {/* ناوبری دسکتاپ */}
            <nav aria-label="ناوبری اصلی" className="hidden lg:block">
              <ul className="flex items-center gap-7">
                {navLinks.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className={cn(
                        "text-[15px] text-foreground/85 transition-colors hover:text-foreground",
                        pathname.startsWith(link.href) && "font-medium text-foreground",
                      )}
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>

            {/* اکشن‌ها */}
            <div className="flex items-center gap-1 sm:gap-1.5">
              <button
                type="button"
                onClick={() => setSearchOpen(true)}
                aria-label="جستجو"
                className="flex size-10 items-center justify-center rounded-sm transition-colors hover:bg-secondary"
              >
                <Search className="size-5" aria-hidden />
              </button>

              <Link
                href="/wishlist"
                aria-label={`علاقه‌مندی‌ها${wishlistCount ? ` (${wishlistCount} محصول)` : ""}`}
                className="relative hidden size-10 items-center justify-center rounded-sm transition-colors hover:bg-secondary sm:flex"
              >
                <Heart className="size-5" aria-hidden />
                {wishlistCount > 0 && (
                  <span className="absolute -top-0.5 -end-0.5 flex size-4.5 min-w-4.5 items-center justify-center rounded-full bg-terracotta px-1 text-[10px] font-semibold text-white">
                    {wishlistCount}
                  </span>
                )}
              </Link>

              <button
                type="button"
                onClick={openCart}
                aria-label={`سبد خرید${cartCount ? ` (${cartCount} محصول)` : ""}`}
                className="relative flex size-10 items-center justify-center rounded-sm transition-colors hover:bg-secondary"
              >
                <ShoppingBag className="size-5" aria-hidden />
                {cartCount > 0 && (
                  <span className="absolute -top-0.5 -end-0.5 flex size-4.5 min-w-4.5 items-center justify-center rounded-full bg-terracotta px-1 text-[10px] font-semibold text-white">
                    {cartCount}
                  </span>
                )}
              </button>

              <Link
                href="/account"
                aria-label="حساب کاربری"
                className="hidden size-10 items-center justify-center rounded-sm transition-colors hover:bg-secondary sm:flex"
              >
                <User className="size-5" aria-hidden />
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* منوی موبایل */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
          <div
            className="absolute inset-0 bg-deep/40 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
            aria-hidden
          />
          <div className="absolute inset-y-0 start-0 flex w-[85%] max-w-sm flex-col bg-cream shadow-md">
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <Logo />
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                aria-label="بستن منو"
                className="flex size-10 items-center justify-center rounded-sm hover:bg-secondary"
              >
                <X className="size-5" aria-hidden />
              </button>
            </div>

            <nav aria-label="ناوبری موبایل" className="flex-1 overflow-y-auto p-5">
              <ul className="flex flex-col gap-1">
                {navLinks.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      onClick={() => setMobileOpen(false)}
                      className="block rounded-md px-3 py-3 text-[15px] font-medium transition-colors hover:bg-secondary"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>

              <p className="mt-6 px-3 text-xs font-medium text-muted-foreground">
                دسته‌بندی‌ها
              </p>
              <ul className="mt-2 flex flex-col gap-1">
                {categories.map((c) => (
                  <li key={c.slug}>
                    <Link
                      href={`/shop/${c.slug}`}
                      onClick={() => setMobileOpen(false)}
                      className="block rounded-md px-3 py-2.5 text-sm text-foreground/85 transition-colors hover:bg-secondary"
                    >
                      {c.name}
                    </Link>
                  </li>
                ))}
              </ul>

              <p className="mt-6 px-3 text-xs font-medium text-muted-foreground">
                کالکشن‌ها
              </p>
              <ul className="mt-2 flex flex-col gap-1">
                {collections.map((c) => (
                  <li key={c.slug}>
                    <Link
                      href={`/collections/${c.slug}`}
                      onClick={() => setMobileOpen(false)}
                      className="block rounded-md px-3 py-2.5 text-sm text-foreground/85 transition-colors hover:bg-secondary"
                    >
                      {c.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>

            <div className="border-t border-line p-5">
              <Link
                href="/account"
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors hover:bg-secondary"
              >
                <User className="size-4.5" aria-hidden />
                حساب کاربری
              </Link>
            </div>
          </div>
        </div>
      )}

      <SearchDialog
        open={searchOpen}
        onOpenChange={setSearchOpen}
        suggestions={searchSuggestions}
      />
    </>
  );
}
