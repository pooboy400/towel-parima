// ISR — بازتولید دوره‌ای صفحه در سرور؛ در فاز ۲ با تغییر داده بک‌اند، صفحه خودکار تازه می‌شود
export const revalidate = 3600;

import { Hero } from "@/components/sections/hero";
import { CategoriesSection } from "@/components/sections/categories-section";
import { BestSellersSection } from "@/components/sections/best-sellers";
import { BrandStorySection } from "@/components/sections/brand-story";
import { FeaturedCollectionSection } from "@/components/sections/featured-collection";
import { BenefitsSection } from "@/components/sections/benefits";
import { ReviewsSection } from "@/components/sections/reviews-section";
import { JournalSection } from "@/components/sections/journal-section";
import { NewsletterSection } from "@/components/sections/newsletter";

/**
 * Homepage — پرامپت 24: ساختار استاندارد
 * AnnouncementBar → Header → Hero → Categories → Best Sellers →
 * Brand Story → Featured Collection → Benefits → Reviews → Journal →
 * Newsletter → Footer
 */
export default function HomePage() {
  return (
    <>
      <Hero />
      <CategoriesSection />
      <BestSellersSection />
      <BrandStorySection />
      <FeaturedCollectionSection />
      <BenefitsSection />
      <ReviewsSection />
      <JournalSection />
      <NewsletterSection />
    </>
  );
}
