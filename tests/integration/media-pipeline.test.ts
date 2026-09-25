/**
 * Integration — خط لوله رسانه واقعی (sharp + DB + فایل‌سیستم) — §21.2
 * آپلود JPG → تبدیل WebP + بندانگشتی + dedupe + رکورد MediaObject
 */

import { describe, expect, it, beforeAll, afterAll } from "bun:test";
import sharp from "sharp";
import { PrismaClient } from "@prisma/client";
import { processUpload, deleteMedia, MEDIA_LIMITS } from "../../src/core/media/pipeline";
import { storageProvider } from "../../src/providers/local-storage";

const DATABASE_URL =
  process.env.DATABASE_URL ?? "postgresql://prima:prima_dev_only@127.0.0.1:5432/prima?schema=public";
const db = new PrismaClient({ datasources: { db: { url: DATABASE_URL } } });

let TEST_USER = "";
const createdIds: string[] = [];

async function makeJpeg(width = 800, height = 600): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 3, background: { r: 200, g: 143, b: 114 } },
  })
    .jpeg({ quality: 80 })
    .toBuffer();
}

beforeAll(async () => {
  // کاربر تست واقعی برای FK MediaObject.uploadedBy
  const user = await db.user.upsert({
    where: { email: "media-test+rbactest@prima.test" },
    update: { isActive: true, deletedAt: null },
    create: {
      email: "media-test+rbactest@prima.test",
      phone: "09120001234",
      name: "تست رسانه",
      isActive: true,
    },
  });
  TEST_USER = user.id;
});

afterAll(async () => {
  await db.user.deleteMany({ where: { email: "media-test+rbactest@prima.test" } });
  // پاکسازی رکوردها و فایل‌های تست
  for (const id of createdIds) {
    await deleteMedia(id).catch(() => undefined);
  }
  await db.$disconnect();
});

describe("media pipeline — WebP تبدیل خودکار", () => {
  it(
    "JPG آپلودی → WebP ذخیره می‌شود + thumb + رکورد",
    async () => {
      const jpg = await makeJpeg();
      const result = await processUpload(jpg, "image/jpeg", TEST_USER);
      createdIds.push(result.media.id);

      expect(result.deduped).toBe(false);
      expect(result.media.mime).toBe("image/webp");
      expect(result.media.width).toBe(800);
      expect(result.media.height).toBe(600);
      expect(result.media.url.startsWith("/api/media/file/uploads/")).toBe(true);

      const onDisk = await storageProvider.read(result.media.storageKey);
      const meta = await sharp(onDisk).metadata();
      expect(meta.format).toBe("webp");

      // بندانگشتی هم webp است
      const thumbKey = result.media.storageKey.replace(/\.webp$/, ".thumb.webp");
      const thumb = await storageProvider.read(thumbKey);
      const thumbMeta = await sharp(thumb).metadata();
      expect(thumbMeta.format).toBe("webp");
      expect(thumbMeta.width).toBeLessThanOrEqual(MEDIA_LIMITS.thumbWidth);

      // رکورد دیتابیس
      const row = await db.mediaObject.findUnique({ where: { id: result.media.id } });
      expect(row?.mime).toBe("image/webp");
      expect(row?.sha256.length).toBe(64);
    },
    30_000,
  );

  it(
    "PNG با شفافیت → WebP شفاف",
    async () => {
      const png = await sharp({
        create: { width: 300, height: 300, channels: 4, background: { r: 255, g: 0, b: 0, alpha: 0.5 } },
      })
        .png()
        .toBuffer();
      const result = await processUpload(png, "image/png", TEST_USER);
      createdIds.push(result.media.id);
      expect(result.media.mime).toBe("image/webp");
      const onDisk = await storageProvider.read(result.media.storageKey);
      const meta = await sharp(onDisk).metadata();
      expect(meta.format).toBe("webp");
      expect(meta.hasAlpha).toBe(true);
    },
    30_000,
  );

  it(
    "WebP ورودی → بدون recode مستقیم ذخیره (خواسته مالک)",
    async () => {
      const webp = await sharp({
        create: { width: 200, height: 200, channels: 3, background: { r: 0, g: 128, b: 96 } },
      })
        .webp({ quality: 60 })
        .toBuffer();
      const result = await processUpload(webp, "image/webp", TEST_USER);
      createdIds.push(result.media.id);
      // بایت‌ها بدون تغییر — همان sha256 ورودی
      const { createHash } = await import("crypto");
      const inputSha = createHash("sha256").update(webp).digest("hex");
      expect(result.media.sha256).toBe(inputSha);
    },
    30_000,
  );

  it(
    "dedupe: آپلود دوباره همان فایل → همان رکورد",
    async () => {
      const jpg = await makeJpeg(640, 480);
      const first = await processUpload(jpg, "image/jpeg", TEST_USER);
      createdIds.push(first.media.id);
      const second = await processUpload(jpg, "image/jpeg", TEST_USER);
      expect(second.deduped).toBe(true);
      expect(second.media.id).toBe(first.media.id);
    },
    30_000,
  );

  it(
    "حجم بیش از ۵MB و SVG رد می‌شوند",
    async () => {
      const big = Buffer.alloc(MEDIA_LIMITS.maxBytes + 10, 0xff);
      expect(big.length).toBeGreaterThan(MEDIA_LIMITS.maxBytes);
      let threw1 = false;
      try {
        await processUpload(big, "image/jpeg", TEST_USER);
      } catch {
        threw1 = true;
      }
      expect(threw1).toBe(true);

      const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10"/></svg>');
      let threw2 = false;
      try {
        await processUpload(svg, "image/svg+xml", TEST_USER);
      } catch {
        threw2 = true;
      }
      expect(threw2).toBe(true);
    },
    30_000,
  );
});
