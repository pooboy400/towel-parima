/**
 * M5 verification — وضعیت Outbox/SmsLog/Order/Payment بعد از تست‌ها
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const outbox = await db.outboxEvent.groupBy({
    by: ["status"],
    _count: { _all: true },
  });
  console.log("OUTBOX:", outbox.map((r) => `${r.status}=${r._count._all}`).join(" · "));

  const sms = await db.smsLog.findMany({ orderBy: { createdAt: "desc" }, take: 10 });
  console.log("SMS_LOG (آخرین):");
  for (const s of sms) {
    console.log(`  [${s.status}] ${s.tag} → ${s.to}${s.error ? " ⚠ " + s.error : ""}`);
  }

  const orders = await db.order.findMany({
    orderBy: { createdAt: "desc" },
    take: 5,
    include: { payments: true, refunds: true },
  });
  console.log("ORDERS (آخرین):");
  for (const o of orders) {
    const p = o.payments.map((x) => x.status).join(",") || "-";
    const r = o.refunds.map((x) => x.status).join(",") || "-";
    console.log(`  ${o.code} [${o.status}] pay=${p} refund=${r} total=${o.grandTotal}`);
  }

  const pendingEvents = await db.outboxEvent.findMany({
    where: { status: { in: ["PENDING", "PROCESSING"] } },
    select: { type: true, attempts: true, lastError: true },
  });
  if (pendingEvents.length) {
    console.log("⏳ در صف/در حال پردازش:", JSON.stringify(pendingEvents));
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
