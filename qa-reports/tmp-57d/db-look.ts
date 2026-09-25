/**
 * Task 57-d — بازرسی فقط‌خواندنی بهداشت DB (هیچ write ای انجام نمی‌دهد)
 * اجرا: DATABASE_URL=... bun qa-reports/tmp-57d/db-look.ts
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main(): Promise<void> {
  const out: Record<string, unknown> = {};

  // ── stock/reserved ──
  out.variantTotal = await db.variant.count();
  out.variantsReservedPositive = await db.variant.count({
    where: { reserved: { gt: 0 } },
  });
  out.variantsStockNegative = await db.variant.count({
    where: { stock: { lt: 0 } },
  });

  // ── رزرو ACTIVE بی‌سفارش ──
  const active = await db.inventoryReservation.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, orderId: true },
  });
  out.activeReservationsTotal = active.length;
  const liveOrders = await db.order.findMany({
    where: {
      id: {
        in: [
          ...new Set(
            active.map((r) => r.orderId).filter((id): id is string => id !== null),
          ),
        ],
      },
    },
    select: { id: true },
  });
  const liveIds = new Set(
    liveOrders.map((o) => o.id).filter((id): id is string => id !== null),
  );
  out.activeReservationsWithoutOrder = active.filter(
    (r) => r.orderId !== null && !liveIds.has(r.orderId),
  ).length;

  // ── کاربر/نشست/نقش mint باقی‌مانده از 56/57a/57b ──
  out.mintedUsers = await db.user.count({
    where: {
      OR: [
        { email: { endsWith: "+rbactest@prima.test" } },
        { email: { contains: "lock57a" } },
        { email: { contains: "sec03" } },
        { email: { contains: "mint" } },
        { email: { contains: "57b" } },
        { email: { endsWith: "@example.invalid" } },
        { name: { contains: "تست" } },
      ],
    },
    select: undefined,
  });
  out.mintedUsersSample = (
    await db.user.findMany({
      where: {
        OR: [
          { email: { endsWith: "+rbactest@prima.test" } },
          { email: { contains: "lock57a" } },
          { email: { contains: "sec03" } },
          { email: { contains: "mint" } },
          { email: { contains: "57b" } },
          { email: { endsWith: "@example.invalid" } },
        ],
      },
      select: { email: true, createdAt: true },
      take: 10,
    })
  ).map((u) => `${u.email} @${u.createdAt.toISOString()}`);
  out.mintedSessions = await db.session.count({
    where: {
      OR: [
        { sessionToken: { startsWith: "testtoken" } },
        { sessionToken: { startsWith: "mint" } },
        { user: { email: { endsWith: "@example.invalid" } } },
      ],
    },
  });
  out.testRoles = await db.role.count({
    where: {
      OR: [
        { id: { startsWith: "test_role_" } },
        { name: { startsWith: "test_role_" } },
        { name: { contains: "qa" } },
      ],
    },
  });
  out.testRolesSample = (
    await db.role.findMany({
      where: {
        OR: [
          { id: { startsWith: "test_role_" } },
          { name: { startsWith: "test_role_" } },
        ],
      },
      select: { id: true, name: true },
    })
  ).map((r) => `${r.id}/${r.name}`);

  // ── AuditLog آزمایشی باقی‌مانده (lock57a، ایمیل‌های تست 57b، rbac-integration) ──
  out.testAuditRows = await db.auditLog.count({
    where: {
      OR: [
        { entityId: { contains: "lock57a" } },
        { entityId: { contains: "sec03" } },
        { entityId: { contains: "57b" } },
        { entityId: "rbac-integration" },
        { action: "test.audit.entry" },
      ],
    },
  });
  out.testAuditSample = (
    await db.auditLog.findMany({
      where: {
        OR: [
          { entityId: { contains: "lock57a" } },
          { entityId: { contains: "sec03" } },
          { entityId: { contains: "57b" } },
          { action: "test.audit.entry" },
        ],
      },
      select: { action: true, entityId: true, createdAt: true },
      take: 10,
    })
  ).map((a) => `${a.action}/${a.entityId} @${a.createdAt.toISOString()}`);

  // ── سفارش/پرداخت آزمون بی‌صاحب (authority MOCK-*) ──
  const mockPays = await db.payment.findMany({
    where: { authority: { startsWith: "MOCK-" } },
    select: { id: true, authority: true, orderId: true, status: true },
  });
  out.mockPayments = mockPays.length;
  out.mockPaymentsSample = mockPays.map((p) => `${p.authority}/${p.status}`);
  const mockOrderIds = [
    ...new Set(mockPays.map((p) => p.orderId).filter((id): id is string => id !== null)),
  ];
  out.mockOrdersLinked = await db.order.count({
    where: { id: { in: mockOrderIds } },
  });

  // ── سفارش‌های T*-کد بدون کاربر (الگوی تست integration) از امروز ──
  out.guestTestOrdersToday = await db.order.count({
    where: {
      userId: null,
      code: { startsWith: "T" },
      placedAt: { gte: new Date(Date.now() - 24 * 3600 * 1000) },
    },
  });

  // ── Sessionهای ادمین فعال (غیر تستی) — فقط شمارش برای زمینه ──
  out.totalUsers = await db.user.count();
  out.totalSessions = await db.session.count();
  out.totalOrders = await db.order.count();
  out.totalPayments = await db.payment.count();

  console.log(JSON.stringify(out, null, 2));
}

main()
  .catch((e) => {
    console.error("DB-LOOK-ERROR:", e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
