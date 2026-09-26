// read-only proof: reservation state of the two orders created by battery 67-u3
import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const rows = await p.order.findMany({
  where: { code: { in: ["1945247846", "2980700292"] } },
  select: {
    code: true,
    status: true,
    payments: { select: { status: true } },
    reservations: { select: { status: true, qty: true, releasedAt: true } },
  },
});
console.log(JSON.stringify(rows, null, 1));
await p.$disconnect();
