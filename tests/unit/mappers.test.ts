import { describe, expect, test } from "bun:test";
import {
  buildProductSearchKey,
  buildTsQueryString,
  mapJournalToDomain,
  mapProductToDomain,
  mapReviewToDomain,
  type PrismaProductLike,
} from "@/lib/repositories/mappers";

/** فکتوری محصول Prisma-مانند برای تست pure نگاشت */
function makeProduct(overrides: Partial<PrismaProductLike> = {}): PrismaProductLike {
  return {
    id: "p1",
    slug: "test-towel",
    name: "حوله تست",
    shortDescription: "توضیح کوتاه",
    description: "توضیح کامل",
    status: "ACTIVE",
    categoryId: "cat1",
    badges: ["bestseller"],
    deletedAt: null,
    createdAt: new Date("2025-03-12T00:00:00Z"),
    specs: [{ label: "جنس", value: "پنبه" }],
    care: ["شست‌وشو سرد"],
    suitableFor: ["روزمره"],
    features: ["جذب بالا"],
    rating: 4.5,
    reviewCount: 10,
    sortOrder: 3,
    variants: [],
    images: [],
    collections: [],
    category: {
      id: "cat1",
      slug: "bath-towels",
      name: "حوله حمام",
      description: null,
      imageKey: null,
      sortOrder: 0,
      deletedAt: null,
      seoText: null,
    },
    ...overrides,
  };
}

describe("mapProductToDomain — تجمیع Product+Variant", () => {
  test("قیمت = حداقل قیمت واریانت‌ها و sku = واریانت اصلی", () => {
    // ورودی همان ترتیبی است که repository برمی‌گرداند (orderBy sortOrder,id)
    const p = mapProductToDomain(
      makeProduct({
        variants: [
          { id: "v1", productId: "p1", colorId: "white", sizeId: "bath", sku: "SKU-1", price: 745_000, compareAtPrice: 900_000, stock: 10, reserved: 2, isActive: true, deletedAt: null } as never,
          { id: "v2", productId: "p1", colorId: "cream", sizeId: "bath", sku: "SKU-2", price: 800_000, compareAtPrice: null, stock: 5, reserved: 0, isActive: true, deletedAt: null } as never,
        ],
      }),
    );
    expect(p.price).toBe(745_000);
    expect(p.sku).toBe("SKU-1"); // واریانت اصلی = اولین (کم‌ترین sortOrder)
    expect(p.compareAtPrice).toBe(900_000);
  });

  test("موجودی = Σ(stock − reserved) و رزرو منفی نمی‌شود", () => {
    const p = mapProductToDomain(
      makeProduct({
        variants: [
          { id: "v1", productId: "p1", colorId: null, sizeId: null, sku: "A", price: 100, compareAtPrice: null, stock: 10, reserved: 3, isActive: true, deletedAt: null },
          { id: "v2", productId: "p1", colorId: null, sizeId: null, sku: "B", price: 100, compareAtPrice: null, stock: 5, reserved: 5, isActive: true, deletedAt: null },
        ],
      }),
    );
    expect(p.stock).toBe(7); // (10-3) + (5-5)
  });

  test("واریانت غیرفعال/حذف‌شده از محاسبات خارج می‌شود", () => {
    const p = mapProductToDomain(
      makeProduct({
        variants: [
          { id: "v1", productId: "p1", colorId: null, sizeId: null, sku: "A", price: 100, compareAtPrice: null, stock: 10, reserved: 0, isActive: true, deletedAt: null },
          { id: "v2", productId: "p1", colorId: null, sizeId: null, sku: "B", price: 1, compareAtPrice: null, stock: 999, reserved: 0, isActive: false, deletedAt: null },
          { id: "v3", productId: "p1", colorId: null, sizeId: null, sku: "C", price: 1, compareAtPrice: null, stock: 999, reserved: 0, isActive: true, deletedAt: new Date() },
        ],
      }),
    );
    expect(p.price).toBe(100);
    expect(p.stock).toBe(10);
  });

  test("رنگ‌ها/سایزها متمایز و با حفظ ترتیب واریانت‌ها", () => {
    const p = mapProductToDomain(
      makeProduct({
        variants: [
          { id: "v1", productId: "p1", colorId: "cream", sizeId: "bath", sku: "A", price: 1, compareAtPrice: null, stock: 1, reserved: 0, isActive: true, deletedAt: null, color: { id: "cream", name: "کرم", hex: "#FFF" }, size: { id: "bath", name: "حمام", sortOrder: 0, dimensions: "70 × 140", gsm: 550 } },
          { id: "v2", productId: "p1", colorId: "white", sizeId: "bath", sku: "B", price: 1, compareAtPrice: null, stock: 1, reserved: 0, isActive: true, deletedAt: null, color: { id: "white", name: "سفید", hex: "#EEE" }, size: { id: "bath", name: "حمام", sortOrder: 0, dimensions: "70 × 140", gsm: 550 } },
          { id: "v3", productId: "p1", colorId: "cream", sizeId: "hand", sku: "C", price: 1, compareAtPrice: null, stock: 1, reserved: 0, isActive: true, deletedAt: null, color: { id: "cream", name: "کرم", hex: "#FFF" }, size: { id: "hand", name: "دست", sortOrder: 1, dimensions: "35 × 75", gsm: 500 } },
        ],
      }),
    );
    expect(p.colors.map((c) => c.id)).toEqual(["cream", "white"]);
    expect(p.sizes.map((s) => s.id)).toEqual(["bath", "hand"]);
    expect(p.sizes[0]?.dimensions).toBe("70 × 140");
  });

  test("تصاویر با sortOrder مرتب می‌شوند و کالکشن‌ها به slug نگاشت می‌شوند", () => {
    const p = mapProductToDomain(
      makeProduct({
        images: [
          { id: "i2", productId: "p1", storageKey: "/b.jpg", alt: null, sortOrder: 2 },
          { id: "i1", productId: "p1", storageKey: "/a.jpg", alt: null, sortOrder: 1 },
        ],
        collections: [
          { collection: { id: "c1", slug: "spa", name: "اسپا", description: null, imageKey: null, sortOrder: 0, deletedAt: null } },
          { collection: { id: "c2", slug: "gift", name: "هدیه", description: null, imageKey: null, sortOrder: 1, deletedAt: null } },
        ],
      }),
    );
    expect(p.images).toEqual(["/a.jpg", "/b.jpg"]);
    expect(p.collectionSlugs).toEqual(["spa", "gift"]);
    expect(p.categorySlug).toBe("bath-towels");
  });

  test("بدون واریانت: مقادیر پیش‌فرض امن (کاتالوگ خراب نمی‌کند)", () => {
    const p = mapProductToDomain(makeProduct({ variants: [] }));
    expect(p.price).toBe(0);
    expect(p.stock).toBe(0);
    expect(p.sku).toBe("");
    expect(p.colors).toEqual([]);
  });
});

describe("buildProductSearchKey — نرمال‌سازی index-time (بخش ۱۷ سند)", () => {
  test("ي عربی→ی، ك→ک، ارقام فارسی→لاتین، فاصله‌های تکراری فشرده", () => {
    const key = buildProductSearchKey("حوله يك", "۵۵۰ گرم", "توضيح", "bath-towels");
    expect(key).toBe("حوله یک 550 گرم توضیح bath-towels");
  });

  test("trim و فشرده‌سازی فاصله", () => {
    expect(buildProductSearchKey("  حوله   حمام  ", "", "", "x")).toBe("حوله حمام x");
  });
});

describe("buildTsQueryString — tsquery امن با prefix", () => {
  test("توکن‌ها OR می‌شوند با :*", () => {
    expect(buildTsQueryString("حوله حمام")).toBe("حوله:* | حمام:*");
  });

  test("کاراکترهای خاص حذف می‌شوند (ضد SQL/ tsquery injection)", () => {
    expect(buildTsQueryString("حوله' ; DROP")).toBe("حوله:* | DROP:*");
  });

  test("خالی → null و سقف ۸ توکن", () => {
    expect(buildTsQueryString("   ")).toBeNull();
    expect(buildTsQueryString("a b c d e f g h i j")).toBe("a:* | b:* | c:* | d:* | e:* | f:* | g:* | h:*");
  });
});

describe("mapJournalToDomain و mapReviewToDomain", () => {
  test("پاراگراف‌ها با \n\n جدا می‌شوند", () => {
    const j = mapJournalToDomain({
      id: "j1",
      slug: "s",
      title: "t",
      excerpt: "e",
      bodyMarkdown: "پاراگراف یک\n\nپاراگراف دو\n\n\n\nپاراگراف سه",
      coverKey: "/img.jpg",
      topic: "راهنما",
      readingMinutes: 5,
      publishedAt: new Date("2025-07-15T00:00:00Z"),
    });
    expect(j.content).toEqual(["پاراگراف یک", "پاراگراف دو", "پاراگراف سه"]);
    expect(j.date).toBe("2025-07-15");
    expect(j.readingTime).toBe(5);
  });

  test("نظر: تاریخ منتشرشده و وضعیت خرید تاییدشده", () => {
    const r = mapReviewToDomain({
      id: "r1",
      authorName: "نگار م.",
      rating: 5,
      body: "عالی",
      publishedAt: new Date("2025-07-02T00:00:00Z"),
      verifiedPurchase: true,
      product: { slug: "test-towel" },
    });
    expect(r.userName).toBe("نگار م.");
    expect(r.productSlug).toBe("test-towel");
    expect(r.date).toBe("2025-07-02");
    expect(r.verifiedPurchase).toBe(true);
  });
});
