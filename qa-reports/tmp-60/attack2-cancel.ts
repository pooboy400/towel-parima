/**
 * حملهٔ ۲ (redteam 60) — بازیگر دوم: cancelOrder سرویس‌لول، همزمان با flood
 */
import { PrismaClient } from "@prisma/client";
import { cancelOrder } from "../../src/core/commerce/order-service";

const db = new PrismaClient();
const f = await Bun.file(new URL("./attack2-fixture.json", import.meta.url)).json();
await new Promise((r) => setTimeout(r, 40)); // هم‌زمانی با شروع flood
const t0 = Date.now();
try {
  await cancelOrder(f.orderId, { reason: "redteam-60 انصراف همزمان", actorId: null, actor: "customer" });
  console.log("CANCEL: OK in", Date.now() - t0, "ms");
} catch (e) {
  console.log("CANCEL: REJECTED", (e as { code?: string }).code ?? String(e), "in", Date.now() - t0, "ms");
}
await db.$disconnect();
