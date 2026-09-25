/**
 * backfill-media-library.ts — یک‌بار: تصاویر استاتیک سایت (public/images) را
 * از همان pipeline امن آپلود عبور می‌دهد تا در کتابخانه رسانه ادمین دیده شوند
 * (رفع یافتهٔ 47-f MEDIUM: کتابخانه خالی با وجود ۲۸ تصویر سایت).
 * idempotent — sha256 dedupe خود pipeline از دوباره‌ثبتی جلوگیری می‌کند.
 * اجرا: bun --preload ./tests/helpers/server-only-stub.ts scripts/backfill-media-library.ts
 */
import { readdir, readFile } from "fs/promises";
import path from "path";
import { processUpload } from "../src/core/media/pipeline";

const IMG_DIR = path.resolve(process.cwd(), "public", "images");

async function main() {
  const files = (await readdir(IMG_DIR)).filter((f) =>
    /\.(jpe?g|png|webp)$/i.test(f),
  );
  let added = 0;
  let deduped = 0;
  const failed: string[] = [];

  for (const f of files) {
    try {
      const buf = await readFile(path.join(IMG_DIR, f));
      const res = await processUpload(buf, "", null as unknown as string);
      if (res.deduped) deduped += 1;
      else added += 1;
    } catch (e) {
      failed.push(`${f}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  console.log(
    `کتابخانه رسانه: ${added} تصویر جدید · ${deduped} تکراری از ${files.length} فایل`,
  );
  if (failed.length > 0) {
    console.error("شکست‌خورده‌ها:");
    for (const f of failed) console.error(`  - ${f}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
