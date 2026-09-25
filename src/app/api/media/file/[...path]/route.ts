/**
 * GET /api/media/file/[...path] — سرو امن فایل‌های آپلودی (بخش ۲۱.۲ سند)
 * ---------------------------------------------------------------
 * - Content-Type ثابت بر اساس پسوند سرور (اعتماد به کلاینت ممنوع)
 * - X-Content-Type-Options: nosniff
 * - Cache immutable — key تصادفی است، محتوا هرگز عوض نمی‌شود
 * - traversal-proof: فقط مسیرهای زیر ریشه مجاز
 */

import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";

const ROOT = process.env.STORAGE_LOCAL_DIR
  ? path.resolve(process.env.STORAGE_LOCAL_DIR)
  : path.resolve(process.cwd(), ".data", "uploads");

const EXT_MIME: Record<string, string> = {
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
};

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path: segments } = await params;
  if (!segments?.length) return new NextResponse("Not found", { status: 404 });

  const rel = segments.map((s) => decodeURIComponent(s)).join("/");
  const full = path.resolve(ROOT, rel);
  if (!full.startsWith(ROOT + path.sep)) {
    return new NextResponse("Not found", { status: 404 });
  }

  const mime = EXT_MIME[path.extname(full).toLowerCase()];
  if (!mime) return new NextResponse("Not found", { status: 404 });

  try {
    const data = await readFile(full);
    return new NextResponse(new Uint8Array(data), {
      status: 200,
      headers: {
        "Content-Type": mime,
        "Content-Length": String(data.length),
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
