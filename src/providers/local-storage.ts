/**
 * LocalStorageProvider — پیاده‌سازی M2 قرارداد StorageProvider (بخش ۲۱.۱ سند)
 * ---------------------------------------------------------------
 * - فایل‌ها خارج از دایرکتوری اجرایی در STORAGE_LOCAL_DIR (پیش‌فرض .data/uploads)
 * - key سرورساخته است: uploads/{yyyy}/{mm}/{uuidv7}.{ext} — نام کلاینت هرگز در key نیست
 * - publicUrl از مسیر سروِ امن /api/media/file می‌گذرد (nosniff + Content-Type ثابت)
 * - S3 در M6/production به همین قرارداد وصل می‌شود — هیچ کد بیزنسی تغییر نمی‌کند
 */

import "server-only";
import { mkdir, readFile, unlink, writeFile } from "fs/promises";
import path from "path";
import type { StoragePutResult, StorageProvider } from "./index";

const ROOT = process.env.STORAGE_LOCAL_DIR
  ? path.resolve(process.env.STORAGE_LOCAL_DIR)
  : path.resolve(process.cwd(), ".data", "uploads");

/** مسیر فیزیکی امن — جلوگیری قطعی از path traversal */
function safePath(key: string): string {
  const normalized = path.normalize(key).replace(/^(\.\.(\/|\\|$))+/, "");
  const full = path.join(ROOT, normalized);
  if (!full.startsWith(ROOT)) throw new Error("storage: key نامعتبر است");
  return full;
}

export class LocalStorageProvider implements StorageProvider {
  readonly name = "local";

  async put(key: string, buffer: Buffer, _mime: string): Promise<StoragePutResult> {
    const full = safePath(key);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, buffer);
    return { key, url: this.publicUrl(key) };
  }

  async delete(key: string): Promise<void> {
    await unlink(safePath(key)).catch(() => undefined);
  }

  async read(key: string): Promise<Buffer> {
    return readFile(safePath(key));
  }

  publicUrl(key: string): string {
    return `/api/media/file/${key}`;
  }
}

/** نمونه سرور — انتخاب با env (بخش ۱۹ سند)؛ فعلاً local تنها پیاده‌سازی فعال است */
export const storageProvider: StorageProvider = new LocalStorageProvider();
