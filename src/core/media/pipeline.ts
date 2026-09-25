/**
 * Media Pipeline — خط لوله امن آپلود (ترتیب اجباری بخش ۲۱.۲ سند)
 * ---------------------------------------------------------------
 * ۱. سقف حجم 5MB و ابعاد 4096×4096
 * ۲. MIME whitelist + بررسی magic bytes (هرگز اعتماد به Content-Type کلاینت)
 * ۳. decode کامل با sharp
 * ۴. key رندوم UUIDv7 — نام فایل کلاینت هیچ‌جا نمی‌نشیند
 * ۵. تبدیل خودکار به WebP (خواسته مالک): webp→مستقیم · png/jpg/gif→تبدیل
 *    + بندانگشتی 640px + آرشیو نسخه اصلی برای تولید نسخه‌های آینده
 * ۶. ثبت MediaObject با sha256 (dedupe) — پردازش خارج از tx
 * ⚠️ SVG در v1 ممنوع (ریسک XSS)
 */

import "server-only";
import { createHash } from "crypto";
import sharp from "sharp";
import { v7 as uuidv7 } from "uuid";
import { storageProvider } from "@/providers/local-storage";
import { db } from "@/lib/db";
import { ALLOWED_INPUT_MIMES, sniffImageMime } from "./sniff";

export const MEDIA_LIMITS = {
  maxBytes: 5 * 1024 * 1024,
  maxPixels: 4096,
  webpQuality: 82,
  thumbWidth: 640,
} as const;


export class MediaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MediaError";
  }
}

/** key سرورساخته — uploads/{yyyy}/{mm}/{uuidv7}.{ext} */
function buildKey(suffix: string, ext: string, now = new Date()): string {
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `uploads/${yyyy}/${mm}/${uuidv7()}${suffix}.${ext}`;
}

export interface ProcessedUpload {
  media: {
    id: string;
    storageKey: string;
    url: string;
    mime: string;
    sizeBytes: number;
    width: number;
    height: number;
    sha256: string;
  };
  deduped: boolean;
}

/**
 * پردازش کامل آپلود — خروجی: رکورد MediaObject + URL عمومی.
 * همه مراحل §21.2 به ترتیب؛ هر تخلف = MediaError با پیام فارسی UI.
 */
export async function processUpload(
  input: Buffer,
  _claimedMime: string,
  uploadedBy: string,
): Promise<ProcessedUpload> {
  // ── ۱. سقف حجم
  if (input.length === 0) throw new MediaError("فایل خالی است.");
  if (input.length > MEDIA_LIMITS.maxBytes)
    throw new MediaError("حجم فایل بیش از ۵ مگابایت است.");

  // ── ۲. whitelist + magic bytes
  const realMime = sniffImageMime(input);
  if (!realMime || !ALLOWED_INPUT_MIMES.has(realMime))
    throw new MediaError("فرمت فایل پشتیبانی نمی‌شود (فقط JPG، PNG، WebP، GIF، AVIF).");

  // ── ۳. decode کامل — فایل قلابی اینجا می‌میرد
  const image = sharp(input, { failOn: "error" });
  let meta;
  try {
    meta = await image.metadata();
  } catch {
    throw new MediaError("فایل تصویر معتبر نیست.");
  }
  if (!meta.width || !meta.height) throw new MediaError("ابعاد تصویر خوانده نشد.");
  if (meta.width > MEDIA_LIMITS.maxPixels || meta.height > MEDIA_LIMITS.maxPixels)
    throw new MediaError(`ابعاد تصویر بیش از ${MEDIA_LIMITS.maxPixels} پیکسل است.`);

  // ── ۴/۵. key رندوم + تبدیل به WebP + بندانگشتی
  const webpBuffer =
    realMime === "image/webp"
      ? input // webp بودن: مستقیم (خواسته صریح مالک) — بدون recode
      : await image.rotate().webp({ quality: MEDIA_LIMITS.webpQuality }).toBuffer();

  const thumbBuffer = await sharp(webpBuffer)
    .resize({ width: MEDIA_LIMITS.thumbWidth, withoutEnlargement: true })
    .webp({ quality: MEDIA_LIMITS.webpQuality })
    .toBuffer();

  const outMeta = await sharp(webpBuffer).metadata();
  const sha256 = createHash("sha256").update(webpBuffer).digest("hex");

  // ── dedupe: همان تصویر قبلاً آپلود شده → رکورد موجود
  const existing = await db.mediaObject.findUnique({ where: { sha256 } });
  if (existing) {
    return {
      deduped: true,
      media: {
        id: existing.id,
        storageKey: existing.storageKey,
        url: storageProvider.publicUrl(existing.storageKey),
        mime: existing.mime,
        sizeBytes: existing.sizeBytes,
        width: existing.width ?? outMeta.width ?? 0,
        height: existing.height ?? outMeta.height ?? 0,
        sha256,
      },
    };
  }

  // ── ذخیره: اصلی (آرشیو) + webp + thumb — خارج از tx (بخش ۲۱.۲)
  // کلیدهای مشتق از یک key پایه — تا نمایش بندانگشتی/حذف قطعی وابسته به DB نباشد
  const mainKey = buildKey("", "webp");
  const base = mainKey.replace(/\.webp$/, "");
  const origExt =
    realMime === "image/jpeg" ? "jpg" : realMime === "image/png" ? "png" : realMime.split("/")[1];
  const origKey = realMime === "image/webp" ? mainKey : `${base}.orig.${origExt}`;
  const thumbKey = `${base}.thumb.webp`;

  await storageProvider.put(mainKey, webpBuffer, "image/webp");
  await storageProvider.put(thumbKey, thumbBuffer, "image/webp");
  if (origKey !== mainKey) await storageProvider.put(origKey, input, realMime);

  // ── ۶. رکورد
  const record = await db.mediaObject.create({
    data: {
      storageKey: mainKey,
      mime: "image/webp",
      sizeBytes: webpBuffer.length,
      width: outMeta.width ?? null,
      height: outMeta.height ?? null,
      sha256,
      uploadedBy,
    },
  });

  return {
    deduped: false,
    media: {
      id: record.id,
      storageKey: record.storageKey,
      url: storageProvider.publicUrl(record.storageKey),
      mime: record.mime,
      sizeBytes: record.sizeBytes,
      width: record.width ?? 0,
      height: record.height ?? 0,
      sha256,
    },
  };
}

/** حذف امن رسانه — فایل‌های مرتبط + رکورد؛ اگر روی محصولی در استفاده باشد خطا می‌دهد */
export async function deleteMedia(id: string): Promise<void> {
  const record = await db.mediaObject.findUnique({ where: { id } });
  if (!record) return;

  const key = record.storageKey;
  const base = key.replace(/\.webp$/, "");
  const usedByProduct = await db.productImage.findFirst({
    where: { storageKey: { endsWith: key } },
  });
  if (usedByProduct) {
    throw new MediaError("این تصویر روی محصولی در حال استفاده است. ابتدا آن را جدا کنید.");
  }

  const candidates = [key, `${base}.thumb.webp`];
  await Promise.all(candidates.map((k) => storageProvider.delete(k)));
  await db.mediaObject.delete({ where: { id } }).catch(() => undefined);
}
