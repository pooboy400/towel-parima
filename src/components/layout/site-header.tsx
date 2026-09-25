import { AnnouncementBar } from "./announcement-bar";
import { Header } from "./header";
import { getCategories, getCollections } from "@/services/category-service";
import { getStoreSettingsSafe } from "@/services/settings-service";

/**
 * Site Header (Server) — داده ناوبری و تنظیمات را از لایه سرویس می‌خواند
 * و به Header کلاینتی تزریق می‌کند. در فاز 2 فقط اینجا عوض می‌شود.
 */
export async function SiteHeader() {
  const [categories, collections, { config, shipping }] = await Promise.all([
    getCategories(),
    getCollections(),
    getStoreSettingsSafe(),
  ]);

  return (
    <>
      <AnnouncementBar
        freeShippingThreshold={config.freeShippingThreshold}
        currencyLabel={config.currencyLabel}
        exchangeWindowDays={shipping.exchangeWindowDays}
      />
      <Header
        categories={categories}
        collections={collections}
        searchSuggestions={categories.slice(0, 5).map((c) => c.name)}
      />
    </>
  );
}
