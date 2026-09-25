/**
 * Category / Collection / Content / Settings Repositories (بخش ۷ سند)
 */
import "server-only";
import { db } from "@/lib/db";
import {
  mapCategoryToDomain,
  mapCollectionToDomain,
  mapJournalToDomain,
  type PrismaCategoryLike,
  type PrismaCollectionLike,
} from "./mappers";
import type { Testimonial } from "@/domain/models";

export const categoryRepository = {
  async list(): Promise<ReturnType<typeof mapCategoryToDomain>[]> {
    const rows = (await db.category.findMany({
      where: { deletedAt: null },
      orderBy: [{ sortOrder: "asc" }],
    })) as unknown as PrismaCategoryLike[];
    return rows.map(mapCategoryToDomain);
  },

  async bySlug(slug: string) {
    const row = (await db.category.findFirst({
      where: { slug, deletedAt: null },
    })) as unknown as PrismaCategoryLike | null;
    return row ? mapCategoryToDomain(row) : null;
  },

  async allSlugs(): Promise<string[]> {
    const rows = await db.category.findMany({
      where: { deletedAt: null },
      select: { slug: true },
      orderBy: [{ sortOrder: "asc" }],
    });
    return rows.map((r) => r.slug);
  },
};

export const collectionRepository = {
  async list() {
    const rows = (await db.collection.findMany({
      where: { deletedAt: null },
      orderBy: [{ sortOrder: "asc" }],
    })) as unknown as PrismaCollectionLike[];
    return rows.map(mapCollectionToDomain);
  },

  async bySlug(slug: string) {
    const row = (await db.collection.findFirst({
      where: { slug, deletedAt: null },
    })) as unknown as PrismaCollectionLike | null;
    return row ? mapCollectionToDomain(row) : null;
  },

  async allSlugs(): Promise<string[]> {
    const rows = await db.collection.findMany({
      where: { deletedAt: null },
      select: { slug: true },
      orderBy: [{ sortOrder: "asc" }],
    });
    return rows.map((r) => r.slug);
  },
};

export const contentRepository = {
  async journalList(limit?: number) {
    const rows = await db.journalPost.findMany({
      where: { status: "PUBLISHED", deletedAt: null },
      orderBy: [{ publishedAt: "desc" }],
      ...(limit ? { take: limit } : {}),
    });
    return rows.map(mapJournalToDomain);
  },

  async journalBySlug(slug: string) {
    const row = await db.journalPost.findFirst({
      where: { slug, status: "PUBLISHED", deletedAt: null },
    });
    return row ? mapJournalToDomain(row) : null;
  },

  async journalSlugs(): Promise<string[]> {
    const rows = await db.journalPost.findMany({
      where: { status: "PUBLISHED", deletedAt: null },
      select: { slug: true },
      orderBy: [{ publishedAt: "desc" }],
    });
    return rows.map((r) => r.slug);
  },

  async faqList() {
    return db.faqItem.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }],
      select: { question: true, answer: true },
    });
  },

  /** خواندن تایپ‌شده Setting — مقدار JSON خام هرگز بیرون نمی‌رود */
  async getSetting<T>(key: string): Promise<T | null> {
    const row = await db.setting.findUnique({ where: { key } });
    return row ? (row.value as T) : null;
  },

  async getTestimonials(): Promise<Testimonial[]> {
    return (await this.getSetting<Testimonial[]>("home.testimonials")) ?? [];
  },
};
