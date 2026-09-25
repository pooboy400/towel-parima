/**
 * Category & Collection Service — همان قرارداد فاز ۱، اکنون روی DB (M1)
 */
import "server-only";
import type { Category, Collection } from "@/domain/models";
import { CACHE_TAGS } from "@/core/cache";
import { cachedRead } from "@/lib/cache";
import {
  categoryRepository,
  collectionRepository,
} from "@/lib/repositories/content-repository";

export async function getCategories(): Promise<Category[]> {
  return cachedRead(() => categoryRepository.list(), ["categories-list-v1"], [
    CACHE_TAGS.products,
  ]);
}

export async function getCategoryBySlug(slug: string): Promise<Category | null> {
  // کش per-slug با tag دسته — revalidateTag(`category:${slug}`) در M2
  return cachedRead(
    () => categoryRepository.bySlug(slug),
    ["category-by-slug-v1", slug],
    [CACHE_TAGS.category(slug), CACHE_TAGS.products],
  );
}

export async function getAllCategorySlugs(): Promise<string[]> {
  return categoryRepository.allSlugs();
}

export async function getCollections(): Promise<Collection[]> {
  return cachedRead(() => collectionRepository.list(), ["collections-list-v1"], [
    CACHE_TAGS.products,
  ]);
}

export async function getCollectionBySlug(
  slug: string,
): Promise<Collection | null> {
  return cachedRead(
    () => collectionRepository.bySlug(slug),
    ["collection-by-slug-v1", slug],
    [CACHE_TAGS.collection(slug), CACHE_TAGS.products],
  );
}

export async function getAllCollectionSlugs(): Promise<string[]> {
  return collectionRepository.allSlugs();
}
