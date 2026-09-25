import { db } from "@/lib/db";
import { PageHeader } from "@/components/admin/page-header";
import { SettingsForms } from "./settings-forms";
import { DEFAULT_STORE_CONFIG } from "./defaults";
import { DEFAULT_BADGE_RULES } from "@/lib/config";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const [configSetting, shippingSetting, testimonialsSetting, homeFeatured, badgeRulesSetting] = await Promise.all([
    db.setting.findUnique({ where: { key: "store.config" } }),
    db.setting.findUnique({ where: { key: "store.shipping" } }),
    db.setting.findUnique({ where: { key: "home.testimonials" } }),
    db.setting.findUnique({ where: { key: "home.featured" } }),
    db.setting.findUnique({ where: { key: "store.badgeRules" } }),
  ]);

  const config = (configSetting?.value as unknown) ?? DEFAULT_STORE_CONFIG;

  // کالکشن‌های فعال برای دراپ‌داون «کالکشن ویژهٔ صفحهٔ اصلی»
  const collections = await db.collection.findMany({
    where: { deletedAt: null },
    select: { slug: true, name: true },
    orderBy: [{ sortOrder: "asc" }],
  });

  const featured = (homeFeatured?.value as {
    featuredCollectionSlug?: string;
    headline?: string;
  } | null) ?? {
    featuredCollectionSlug: "spa",
    headline: "حس اسپا، در خانه خودتان",
  };

  const featuredSafe = {
    featuredCollectionSlug: featured.featuredCollectionSlug ?? "spa",
    headline: featured.headline,
  };

  // قوانین برچسب‌های خودکار — با پیش‌فرض‌ها پر می‌شود اگر Setting نباشد
  const rawRules = (badgeRulesSetting?.value as Record<string, unknown> | null) ?? {};
  const badgeRules = {
    newDays: Number(rawRules.newDays) || DEFAULT_BADGE_RULES.newDays,
    bestsellerMinSales: Number(rawRules.bestsellerMinSales) || DEFAULT_BADGE_RULES.bestsellerMinSales,
    bestsellerWindowDays: Number(rawRules.bestsellerWindowDays) || DEFAULT_BADGE_RULES.bestsellerWindowDays,
    limitedMaxStock: Number(rawRules.limitedMaxStock) || DEFAULT_BADGE_RULES.limitedMaxStock,
  };

  return (
    <div>
      <PageHeader
        title="تنظیمات فروشگاه"
        description="این مقادیر در سراسر سایت (فاکتور، ارسال، تماس) استفاده می‌شوند"
      />
      <SettingsForms
        config={config as Parameters<typeof SettingsForms>[0]["config"]}
        shippingJson={(shippingSetting?.value as Record<string, unknown>) ?? null}
        testimonialsJson={(testimonialsSetting?.value as Record<string, unknown>) ?? null}
        collections={collections}
        featured={featuredSafe}
        badgeRules={badgeRules}
      />
    </div>
  );
}
