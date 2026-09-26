/**
 * Media Admin Actions — آپلود/حذف رسانه (بخش ۲۱.۲ سند + خواسته مالک)
 * ---------------------------------------------------------------
 * آپلود: pipeline کامل core/media (سقف حجم، magic bytes، sharp، WebP، dedupe)
 *        + audit media.upload
 * حذف: audit media.delete + جلوگیری از حذف در حال استفاده
 */

"use server";

import { db } from "@/lib/db";
import { safeAudit } from "@/core/audit";
import { CACHE_TAGS, revalidateEntityTag } from "@/core/cache";
import { DomainError } from "@/core/errors";
import { PERMISSIONS } from "@/core/auth/permissions";
import { MediaError, MEDIA_LIMITS, processUpload, deleteMedia } from "@/core/media/pipeline";
import { withAdminAction, requestMeta, type ActionResult } from "@/lib/admin/action-helpers";

export interface UploadedMedia {
  id: string;
  url: string;
  width: number;
  height: number;
  sizeBytes: number;
  deduped: boolean;
}

export async function uploadMediaAction(
  formData: FormData,
): Promise<ActionResult<UploadedMedia>> {
  return withAdminAction(PERMISSIONS.mediaUpload, async (ctx) => {
    const file = formData.get("file");
    if (!(file instanceof File)) {
      throw new DomainError("VALIDATION_ERROR", "فایلی انتخاب نشده است.");
    }

    // SEC-14 (فاز ۳) — چک حجم قبل از arrayBuffer تا فایل بزرگ هرگز وارد RAM نشود
    if (file.size > MEDIA_LIMITS.maxBytes) {
      throw new MediaError("حجم فایل بیش از ۵ مگابایت است.");
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    let media;
    let deduped = false;
    try {
      const result = await processUpload(buffer, file.type || "application/octet-stream", ctx.actor.userId);
      media = result.media;
      deduped = result.deduped;
    } catch (e) {
      if (e instanceof MediaError) {
        throw new DomainError("VALIDATION_ERROR", e.message);
      }
      throw e;
    }

    const meta = await requestMeta();
    await safeAudit({
      actorId: ctx.actor.userId,
      action: "media.upload",
      entityType: "media",
      entityId: media.id,
      after: { storageKey: media.storageKey, sizeBytes: media.sizeBytes, deduped },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    // تغییر تصویر محصول/کالکشن = تازه‌کردن کاتالوگ (کش لیست‌ها)
    revalidateEntityTag(CACHE_TAGS.products);

    return {
      id: media.id,
      url: media.url,
      width: media.width,
      height: media.height,
      sizeBytes: media.sizeBytes,
      deduped,
    };
  });
}

export async function deleteMediaAction(input: { id: string }): Promise<ActionResult<{ id: string }>> {
  return withAdminAction(PERMISSIONS.mediaDelete, async (ctx) => {
    try {
      await deleteMedia(input.id);
    } catch (e) {
      if (e instanceof MediaError) {
        throw new DomainError("CONFLICT", e.message);
      }
      throw e;
    }
    const meta = await requestMeta();
    await safeAudit({
      actorId: ctx.actor.userId,
      action: "media.delete",
      entityType: "media",
      entityId: input.id,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    revalidateEntityTag(CACHE_TAGS.products);
    return { id: input.id };
  });
}
