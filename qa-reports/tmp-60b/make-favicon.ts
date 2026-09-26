/**
 * tmp-60b/make-favicon.ts — UX-11 (فاز ۴)
 * ساخت favicon.ico (PNG-embedded ICO) + icon.svg از public/logo.svg
 * اجرا: bun qa-reports/tmp-60b/make-favicon.ts
 */
import sharp from "sharp";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const svg = readFileSync("public/logo.svg");

async function png(size: number): Promise<Buffer> {
  return sharp(svg, { density: 512 })
    .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
}

function icoFromPngs(pngs: { size: number; data: Buffer }[]): Buffer {
  // ICO header: 6 bytes + 16 bytes per entry
  const count = pngs.length;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type = icon
  header.writeUInt16LE(count, 4);
  const entries: Buffer[] = [];
  let offset = 6 + 16 * count;
  for (const { size, data } of pngs) {
    const e = Buffer.alloc(16);
    e.writeUInt8(size >= 256 ? 0 : size, 0); // width (0 = 256)
    e.writeUInt8(size >= 256 ? 0 : size, 1);
    e.writeUInt8(0, 2); // palette
    e.writeUInt8(0, 3);
    e.writeUInt16LE(1, 4); // planes
    e.writeUInt16LE(32, 6); // bpp
    e.writeUInt32LE(data.length, 8);
    e.writeUInt32LE(offset, 12);
    offset += data.length;
    entries.push(e);
  }
  return Buffer.concat([header, ...entries, ...pngs.map((p) => p.data)]);
}

const png16 = await png(16);
const png32 = await png(32);
const png48 = await png(48);
const ico = icoFromPngs([
  { size: 16, data: png16 },
  { size: 32, data: png32 },
  { size: 48, data: png48 },
]);

mkdirSync("src/app", { recursive: true });
writeFileSync("src/app/favicon.ico", ico);
writeFileSync("src/app/icon.svg", svg); // قرارداد Next — مرورگرهای مدرن
writeFileSync("src/app/apple-icon.png", await png(180));
console.log(
  "favicon.ico:",
  ico.length,
  "bytes · icon.svg + apple-icon.png ساخته شد ✓",
);
