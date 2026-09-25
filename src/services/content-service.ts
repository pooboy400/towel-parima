/**
 * Content Service — ژورنال، FAQ، تستیمونیال‌ها (M1: روی DB)
 */
import "server-only";
import type { FaqItem, JournalPost, Testimonial } from "@/domain/models";
import { CACHE_TAGS } from "@/core/cache";
import { cachedRead } from "@/lib/cache";
import { contentRepository } from "@/lib/repositories/content-repository";

export async function getJournalPosts(limit?: number): Promise<JournalPost[]> {
  // لیست‌های پایدار با tag ژورنال — /shop و جستجو هرگز کش نمی‌شوند (۱۶.۲)
  return cachedRead(
    () => contentRepository.journalList(limit),
    ["journal-list-v1", String(limit ?? "all")],
    [CACHE_TAGS.journal],
  );
}

export async function getJournalPostBySlug(
  slug: string,
): Promise<JournalPost | null> {
  return cachedRead(
    () => contentRepository.journalBySlug(slug),
    ["journal-by-slug-v1", slug],
    [CACHE_TAGS.journalPost(slug), CACHE_TAGS.journal],
  );
}

export async function getAllJournalSlugs(): Promise<string[]> {
  return contentRepository.journalSlugs();
}

export async function getFaq(): Promise<FaqItem[]> {
  return cachedRead(() => contentRepository.faqList(), ["faq-list-v1"], [
    CACHE_TAGS.content,
  ]);
}

/** تستیمونیال‌های صفحه اصلی — از Setting (محتوای مدیریت‌شدنی در M2) */
export async function getTestimonials(): Promise<Testimonial[]> {
  return cachedRead(
    () => contentRepository.getTestimonials(),
    ["testimonials-v1"],
    [CACHE_TAGS.settings, CACHE_TAGS.homepage],
  );
}
