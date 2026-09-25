import type { Metadata } from "next";
import { getProducts } from "@/services/product-service";
import { WishlistView } from "./wishlist-view";

export const metadata = {
  title: "علاقه‌مندی‌ها",
  description: "محصولات ذخیره‌شده شما در پریما",
  robots: { index: false },
};

/**
 * Wishlist — Server wrapper: داده از لایه سرویس، state از localStorage
 */
export default async function WishlistPage() {
  const { items } = await getProducts({});
  return <WishlistView products={items} />;
}
