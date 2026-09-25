import type { MetadataRoute } from "next";
import { getAllProductSlugs } from "@/services/product-service";
import { getAllCategorySlugs } from "@/services/category-service";
import { getAllJournalSlugs } from "@/services/content-service";

/**
 * Sitemap — پرامپت 21 و 99: ساختار کامل برای موتورهای جستجو
 */
const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://prima-towel.ir";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [productSlugs, categorySlugs, journalSlugs] = await Promise.all([
    getAllProductSlugs(),
    getAllCategorySlugs(),
    getAllJournalSlugs(),
  ]);

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: BASE_URL, changeFrequency: "weekly", priority: 1 },
    { url: `${BASE_URL}/shop`, changeFrequency: "daily", priority: 0.9 },
    { url: `${BASE_URL}/collections`, changeFrequency: "weekly", priority: 0.7 },
    { url: `${BASE_URL}/about`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${BASE_URL}/contact`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${BASE_URL}/faq`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${BASE_URL}/journal`, changeFrequency: "weekly", priority: 0.7 },
    { url: `${BASE_URL}/shipping`, changeFrequency: "monthly", priority: 0.4 },
    { url: `${BASE_URL}/returns`, changeFrequency: "monthly", priority: 0.4 },
  ];

  const categoryRoutes: MetadataRoute.Sitemap = categorySlugs.map((slug) => ({
    url: `${BASE_URL}/shop/${slug}`,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  const productRoutes: MetadataRoute.Sitemap = productSlugs.map((slug) => ({
    url: `${BASE_URL}/product/${slug}`,
    changeFrequency: "weekly",
    priority: 0.9,
  }));

  const journalRoutes: MetadataRoute.Sitemap = journalSlugs.map((slug) => ({
    url: `${BASE_URL}/journal/${slug}`,
    changeFrequency: "monthly",
    priority: 0.6,
  }));

  return [...staticRoutes, ...categoryRoutes, ...productRoutes, ...journalRoutes];
}
