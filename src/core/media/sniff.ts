/**
 * Magic Bytes Sniffer — تشخیص فرمت واقعی فایل (§21.2 — مرحله ۲)
 * pure و بدون server-only — در تست unit هم قابل استفاده.
 */

/** MIMEهای مجاز ورودی — بعد از تبدیل، همه image/webp ذخیره می‌شوند */
export const ALLOWED_INPUT_MIMES: ReadonlySet<string> = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
]);

/** بررسی magic bytes — امضای واقعی فایل، نه ادعای Content-Type کلاینت */
export function sniffImageMime(buf: Buffer): string | null {
  if (buf.length < 12) return null;
  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "image/png";
  // GIF: GIF8
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) return "image/gif";
  // WEBP: RIFF....WEBP
  if (buf.slice(0, 4).toString("ascii") === "RIFF" && buf.slice(8, 12).toString("ascii") === "WEBP")
    return "image/webp";
  // AVIF/HEIC: ....ftyp
  if (buf.slice(4, 8).toString("ascii") === "ftyp") return "image/avif";
  return null;
}
