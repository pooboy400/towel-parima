/**
 * Seed — M1 Data Layer (DoD بخش ۲۷: «داده = داده فعلی mock»)
 * ---------------------------------------------------------------
 * منبع: prisma/seed-data (انتقال‌یافته از src/data — که حذف شده است)
 * اجرا: bun scripts/seed.ts   (یا: bunx prisma db seed)
 *
 * نکات نگاشت طبق ERD:
 *  - واریانت = ضرب دکارتی رنگ×سایز هر محصول؛ موجودی محصول mock بین
 *    واریانت‌ها تقسیم می‌شود (مجموع = موجودی mock؛ برای UI یکسان)
 *  - واریانت اصلی sku عین mock را می‌گیرد؛ بقیه پسوند -V{n}
 *  - rating/reviewCount mock روی Product (نمایشی؛ بازمحاسبه در M3)
 *  - ژورنال: پاراگراف‌ها با \n\n به bodyMarkdown؛ مپر به شکل content[] برمی‌گرداند
 *  - Setting: store.config / store.shipping / home.testimonials
 */
import { PrismaClient } from "@prisma/client";
import { ROLE_DEFINITIONS } from "@/core/auth/roles";
import { buildProductSearchKey } from "@/lib/repositories/mappers";
import { categories, collections, colors, sizes } from "../prisma/seed-data/categories";
import { products } from "../prisma/seed-data/products";
import { reviews, testimonials } from "../prisma/seed-data/reviews";
import { faqItems, journalPosts } from "../prisma/seed-data/content";
import { storeConfig, shippingInfo, DEFAULT_FEATURED_COLLECTION_SLUG, DEFAULT_BADGE_RULES } from "@/lib/config";

if (!process.env.DATABASE_URL?.startsWith("postgresql")) {
  console.error(
    "خطا: DATABASE_URL باید postgresql باشد. scripts/pg.sh start را اجرا کنید.",
  );
  process.exit(1);
}

const db = new PrismaClient({ log: ["error"] });

async function main() {
  console.log("شروع seed...");

  /* ---------- ۱) نقش‌های سیستمی RBAC ---------- */
  for (const role of ROLE_DEFINITIONS) {
    await db.role.upsert({
      where: { name: role.name },
      update: { title: role.title, permissions: [...role.permissions], isSystem: true },
      create: {
        name: role.name,
        title: role.title,
        permissions: [...role.permissions],
        isSystem: true,
      },
    });
  }
  console.log(`نقش‌ها: ${ROLE_DEFINITIONS.length}`);

  /* ---------- ۲) پاکسازی محتوای قابل reseed (ترتیب FK-امن) ---------- */
  await db.review.deleteMany();
  await db.collectionProduct.deleteMany();
  await db.productImage.deleteMany();
  await db.variant.deleteMany();
  await db.product.deleteMany();
  await db.collection.deleteMany();
  await db.category.deleteMany();
  await db.journalPost.deleteMany();
  await db.faqItem.deleteMany();

  /* ---------- ۳) رنگ‌ها و سایزهای مرجع (+ inline محصولات مثل سایز تن‌پوش) ---------- */
  const colorById = new Map<string, { id: string; name: string; hex: string }>();
  for (const c of Object.values(colors)) colorById.set(c.id, { id: c.id, name: c.name, hex: c.hex });
  const sizeById = new Map<
    string,
    { id: string; name: string; sortOrder: number; dimensions: string | null; gsm: number | null }
  >();
  Object.values(sizes).forEach((s, i) =>
    sizeById.set(s.id, { id: s.id, name: s.label, sortOrder: i, dimensions: s.dimensions, gsm: s.gsm ?? null }),
  );
  // سایز/رنگ‌های inline تعریف‌شده در خود محصولات (مثلاً M/L/XL تن‌پوش)
  for (const p of products) {
    for (const c of p.colors) {
      if (!colorById.has(c.id)) colorById.set(c.id, { id: c.id, name: c.name, hex: c.hex });
    }
    for (const s of p.sizes) {
      if (!sizeById.has(s.id)) {
        sizeById.set(s.id, {
          id: s.id,
          name: s.label,
          sortOrder: sizeById.size,
          dimensions: s.dimensions,
          gsm: s.gsm ?? null,
        });
      }
    }
  }
  await db.color.createMany({ data: [...colorById.values()], skipDuplicates: true });
  await db.size.createMany({ data: [...sizeById.values()], skipDuplicates: true });

  /* ---------- ۴) دسته‌ها و کالکشن‌ها ---------- */
  await db.category.createMany({
    data: categories.map((c, i) => ({
      id: c.id,
      slug: c.slug,
      name: c.name,
      description: c.description,
      imageKey: c.image,
      seoText: c.seoText ?? null,
      sortOrder: i,
    })),
  });
  await db.collection.createMany({
    data: collections.map((c, i) => ({
      id: c.id,
      slug: c.slug,
      name: c.name,
      description: c.description,
      imageKey: c.image,
      sortOrder: i,
    })),
  });

  /* ---------- ۵) محصولات + واریانت + تصاویر + پیوند کالکشن ---------- */
  let variantCount = 0;
  for (const p of products) {
    const product = await db.product.create({
      data: {
        id: p.id,
        slug: p.slug,
        name: p.name,
        shortDescription: p.shortDescription,
        description: p.description,
        status: p.status === "ACTIVE" ? "ACTIVE" : "DRAFT",
        categoryId: (await db.category.findUnique({ where: { slug: p.categorySlug } }))!.id,
        // تاریخ افزودن نسبی — قوانین برچسب «جدید» (ADR 011) روی دموی واقعی کار می‌کند
        createdAt: new Date(Date.now() - p.daysAgo * 24 * 60 * 60 * 1000),
        specs: p.specs,
        care: p.care,
        suitableFor: p.suitableFor,
        features: p.features,
        rating: p.rating,
        reviewCount: p.reviewCount,
        sortOrder: p.order,
        searchKey: buildProductSearchKey(
          p.name,
          p.shortDescription,
          p.description,
          p.categorySlug,
        ),
      },
    });

    // پیوند کالکشن‌ها
    for (const colSlug of p.collectionSlugs) {
      const col = await db.collection.findUnique({ where: { slug: colSlug } });
      if (col) {
        await db.collectionProduct.create({
          data: { collectionId: col.id, productId: product.id },
        });
      }
    }

    // واریانت‌ها: ضرب دکارتی رنگ×سایز — همان رنگ‌ها/سایزهای نمایشی mock
    const combos: { colorId?: string; sizeId?: string }[] = [];
    for (const c of p.colors) {
      for (const s of p.sizes) {
        combos.push({ colorId: c.id, sizeId: s.id });
      }
    }
    if (combos.length === 0) combos.push({});

    // تقسیم موجودی mock بین واریانت‌ها (مجموع دقیقاً = stock)
    const base = Math.floor(p.stock / combos.length);
    let remainder = p.stock % combos.length;

    for (let i = 0; i < combos.length; i++) {
      const qty = base + (remainder > 0 ? 1 : 0);
      remainder = Math.max(0, remainder - 1);
      const isFirst = i === 0;
      await db.variant.create({
        data: {
          productId: product.id,
          colorId: combos[i].colorId ?? null,
          sizeId: combos[i].sizeId ?? null,
          sku: isFirst ? p.sku : `${p.sku}-V${i + 1}`,
          price: p.price,
          compareAtPrice: p.compareAtPrice ?? null,
          stock: qty,
          reserved: 0,
          sortOrder: i, // واریانت اصلی = 0
        },
      });
      variantCount++;
    }

    // تصاویر
    await db.productImage.createMany({
      data: p.images.map((img, i) => ({
        productId: product.id,
        storageKey: img,
        alt: p.name,
        sortOrder: i,
      })),
    });
  }
  console.log(`محصولات: ${products.length} · واریانت‌ها: ${variantCount}`);

  /* ---------- ۶) نظرات (تأییدشده) ---------- */
  const productBySlug = new Map(
    (await db.product.findMany({ select: { id: true, slug: true } })).map((p) => [
      p.slug,
      p.id,
    ]),
  );
  for (const r of reviews) {
    const productId = productBySlug.get(r.productSlug);
    if (!productId) continue;
    await db.review.create({
      data: {
        productId,
        authorName: r.userName,
        rating: r.rating,
        body: r.comment,
        status: "APPROVED",
        publishedAt: new Date(r.date),
        verifiedPurchase: r.verifiedPurchase,
      },
    });
  }
  console.log(`نظرات: ${reviews.length}`);

  /* ---------- ۷) ژورنال + FAQ ---------- */
  for (const j of journalPosts) {
    await db.journalPost.create({
      data: {
        slug: j.slug,
        title: j.title,
        excerpt: j.excerpt,
        bodyMarkdown: j.content.join("\n\n"),
        coverKey: j.image,
        topic: j.category,
        readingMinutes: j.readingTime,
        status: "PUBLISHED",
        publishedAt: new Date(j.date),
      },
    });
  }
  await db.faqItem.createMany({
    data: faqItems.map((f, i) => ({
      question: f.question,
      answer: f.answer,
      sortOrder: i,
    })),
  });
  console.log(`ژورنال: ${journalPosts.length} · FAQ: ${faqItems.length}`);

  /* ---------- ۸) Settings (بخش ۱۸ سند) ---------- */
  const settings = [
    { key: "store.config", value: storeConfig },
    { key: "store.shipping", value: shippingInfo },
    { key: "home.testimonials", value: testimonials },
    {
      key: "home.featured",
      value: {
        featuredCollectionSlug: DEFAULT_FEATURED_COLLECTION_SLUG,
        headline: "حس اسپا، در خانه خودتان",
      },
    },
    // ADR 011 — قوانین برچسب‌های خودکار؛ از ابتدا در دیتابیس باشد تا
    // خواندن‌های storefront هیچ‌وقت به مسیر «پیدا نشد» نیفتند
    { key: "store.badgeRules", value: DEFAULT_BADGE_RULES },
  ] as const;
  for (const s of settings) {
    await db.setting.upsert({
      where: { key: s.key },
      update: { value: s.value as object },
      create: { key: s.key, value: s.value as object },
    });
  }
  console.log(`Settings: ${settings.length}`);

  console.log("Seed کامل شد ✓");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
