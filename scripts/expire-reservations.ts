/**
 * Expire Reservations — Worker انقضای رزرو (بخش ۱۳ سند)
 * اجرا: هر ۵ دقیقه (cron/لوب سندباکس) — bun scripts/expire-reservations.ts
 * رزروهای ACTIVE منقضی → EXPIRED + آزادسازی موجودی.
 */

import { db } from "../src/lib/db";
import { expireStaleReservations } from "../src/core/commerce/inventory-service";

async function main() {
  const expired = await expireStaleReservations();
  const active = await db.inventoryReservation.count({ where: { status: "ACTIVE" } });
  console.log(
    JSON.stringify({
      level: "info",
      worker: "expire-reservations",
      expired,
      stillActive: active,
      at: new Date().toISOString(),
    }),
  );
}

main()
  .catch((e) => {
    console.error(JSON.stringify({ level: "error", worker: "expire-reservations", error: String(e) }));
    process.exit(1);
  })
  .finally(() => process.exit(0));
