/**
 * create-admin.ts — ساخت/بازگردانی حساب SUPER_ADMIN (M2)
 * ---------------------------------------------------------------
 * اجرا: bun scripts/create-admin.ts [--email X] [--password Y] [--show]
 * - idempotent: اگر حساب بود، نقش/وضعیتش را اصلاح می‌کند
 * - بدون --password: رمز تصادفی قوی می‌سازد و (با --show) چاپ می‌کند
 * ⚠️ خروجی رمز فقط یک‌بار نمایش داده می‌شود — هش bcrypt(12) ذخیره می‌شود
 */

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

function parseArgs() {
  const args = process.argv.slice(2);
  const get = (flag: string) => {
    const i = args.indexOf(flag);
    return i >= 0 ? args[i + 1] : undefined;
  };
  return {
    email: (get("--email") ?? "admin@prima-store.ir").toLowerCase(),
    password: get("--password"),
    show: args.includes("--show"),
    name: get("--name") ?? "مدیر ارشد",
    phone: get("--phone") ?? "09120000000",
  };
}

function generateStrongPassword(length = 16): string {
  const alphabet = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%";
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < length; i++) out += alphabet[bytes[i] % alphabet.length];
  if (!/[0-9]/.test(out)) out = `7${out.slice(1)}`;
  if (!/[a-zA-Z]/.test(out)) out = `k${out.slice(1)}`;
  return out;
}

async function main() {
  const { email, password, show, name, phone } = parseArgs();
  const plain = password ?? generateStrongPassword(16);

  if (plain.length < 10) throw new Error("رمز حداقل ۱۰ کاراکتر است.");

  const role = await db.role.upsert({
    where: { name: "SUPER_ADMIN" },
    update: { isSystem: true },
    create: {
      id: "role_super_admin",
      name: "SUPER_ADMIN",
      title: "مدیر ارشد",
      isSystem: true,
      permissions: [
        "products.read","products.create","products.update","products.delete",
        "inventory.read","inventory.update",
        "orders.read","orders.update","orders.refund",
        "customers.read","customers.update",
        "coupons.read","coupons.create","coupons.update","coupons.delete",
        "reviews.read","reviews.moderate",
        "content.read","content.update",
        "media.read","media.upload","media.delete",
        "analytics.read",
        "settings.read","settings.update",
        "users.read","users.update",
        "audit.read",
      ],
    },
  });

  const passwordHash = await bcrypt.hash(plain, 12);

  const user = await db.user.upsert({
    where: { email },
    update: { passwordHash, roleId: role.id, isActive: true, deletedAt: null, name },
    create: { email, phone, name, passwordHash, roleId: role.id, isActive: true },
  });

  // پس از reset رمز، همه نشست‌های قبلی باید بمیرند (§9.3)
  await db.session.updateMany({
    where: { userId: user.id, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  if (show) {
    console.log("──────────────────────────────────────────────");
    console.log("  حساب SUPER_ADMIN آماده است:");
    console.log(`  ایمیل (username): ${email}`);
    console.log(`  رمز عبور        : ${plain}`);
    console.log("  آدرس ورود       : /admin/login");
    console.log("──────────────────────────────────────────────");
    console.log("  ⚠️ این رمز فقط همین یک‌بار چاپ می‌شود — آن را امن نگه دارید.");
  } else {
    console.log(`✓ SUPER_ADMIN آماده: ${email} (رمز ${password ? "دستی" : "تصادفیِ ذخیره‌شده"} — با --show نمایش داده می‌شود)`);
  }
}

main()
  .catch((e) => {
    console.error(String(e));
    process.exit(1);
  })
  .finally(() => db.$disconnect());
