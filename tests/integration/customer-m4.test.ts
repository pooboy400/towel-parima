/**
 * Integration — Customer Experience (M4): OTP امن، دفترچه آدرس، ادغام سبد
 * DoD بخش ۲۷: «تست‌های OTP abuse سبز · merge بدون گم شدن آیتم»
 * اجرا: DATABASE_URL=... bun test tests/integration/customer-m4.test.ts
 */

import { describe, expect, it, beforeAll, afterAll } from "bun:test";
import { PrismaClient } from "@prisma/client";
import {
  sendOtp,
  verifyOtpAndLogin,
} from "../../src/core/auth/otp-auth-service";
import { rateLimiter } from "../../src/core/rate-limit";
import { rateKey } from "../../src/core/rate-limit/policies";
import {
  createCustomerAddress,
  updateCustomerAddress,
  deleteCustomerAddress,
  setDefaultCustomerAddress,
  listAddresses,
  MAX_ADDRESSES,
} from "../../src/core/commerce/address-service";
import {
  addToServerCart,
  mergeGuestCart,
  getServerCartLines,
} from "../../src/core/commerce/cart-service";
import { makeVariantWithStock } from "./helpers/m4-fixtures";

const DATABASE_URL =
  process.env.DATABASE_URL ?? "postgresql://prima:prima_dev_only@127.0.0.1:5432/prima?schema=public";

const db = new PrismaClient({ datasources: { db: { url: DATABASE_URL } } });

const TEST_TAG = `m4-${Date.now()}`;
const created = {
  userIds: [] as string[],
  otpPhones: [] as string[],
  variantIds: [] as string[],
  productIds: [] as string[],
  addressIds: [] as string[],
};

async function makeUser() {
  const phone = `0936${String(Math.floor(Math.random() * 1_000_000_0)).padStart(7, "0")}`;
  const user = await db.user.create({ data: { phone } });
  created.userIds.push(user.id);
  created.otpPhones.push(phone);
  return user;
}

beforeAll(async () => {
  await db.$queryRaw`SELECT 1`;
});

afterAll(async () => {
  // پاکسازی FK-امن: وابسته‌های واریانت و سبد قبل از محصول/واریانت
  for (const variantId of created.variantIds) {
    await db.inventoryReservation.deleteMany({ where: { variantId } });
  }
  await db.cartItem.deleteMany({ where: { cart: { userId: { in: created.userIds } } } });
  await db.cart.deleteMany({ where: { userId: { in: created.userIds } } });
  await db.address.deleteMany({ where: { userId: { in: created.userIds } } });
  await db.session.deleteMany({ where: { userId: { in: created.userIds } } });
  await db.user.deleteMany({ where: { id: { in: created.userIds } } });
  for (const productId of created.productIds) {
    await db.productImage.deleteMany({ where: { productId } });
    await db.product.deleteMany({ where: { id: productId } });
  }
  await db.outboxEvent.deleteMany({ where: { type: "CustomerWelcome" } });
  await db.otpCode.deleteMany({ where: { phone: { in: created.otpPhones } } });
  for (const phone of created.otpPhones) {
    await rateLimiter.reset(`otp-send:phone:${phone}`);
    await rateLimiter.reset(`otp-verify:phone:${phone}`);
  }
  await db.$disconnect();
});

/* ================================================================== */
/* OTP                                                                 */
/* ================================================================== */

/** عقب‌بردن زمان ارسال کدها — برای عبور از cooldown ۹۰ ثانیه در تست */
async function backdateOtp(phone: string, ms = 120_000) {
  await db.otpCode.updateMany({
    where: { phone },
    data: { createdAt: new Date(Date.now() - ms) },
  });
}

describe("OTP — سیاست §9.4", () => {
  const phone = `0935${String(Math.floor(Math.random() * 1_000_000_0)).padStart(7, "0")}`;

  it("ارسال موفق کد ۶ رقمی + ساخت خودکار اکانت در verify", async () => {
    created.otpPhones.push(phone);
    const sent = await sendOtp({ phoneRaw: phone, ip: "test-ip" });
    expect(sent.devCode).toMatch(/^\d{6}$/);

    const result = await verifyOtpAndLogin({ phoneRaw: phone, codeRaw: sent.devCode! });
    expect(result.isNewAccount).toBe(true);
    expect(result.phone).toBe(phone);

    const user = await db.user.findUnique({ where: { phone } });
    expect(user).not.toBeNull();
    expect(user!.passwordHash).toBeNull();
    expect(user!.roleId).toBeNull();
    created.userIds.push(user!.id);

    // ورود دوم — دیگر اکانت جدید نمی‌سازد (با فرمت +98 و عبور از cooldown)
    await backdateOtp(phone);
    const sent2 = await sendOtp({ phoneRaw: `+98 ${phone.slice(1)}` }); // فرمت +98
    const result2 = await verifyOtpAndLogin({ phoneRaw: `+98${phone.slice(1)}`, codeRaw: sent2.devCode! });
    expect(result2.isNewAccount).toBe(false);
  });

  it("cooldown ۹۰ ثانیه — ارسال دوم بلافاصله رد می‌شود", async () => {
    const phone2 = `0936${String(Math.floor(Math.random() * 1_000_000_0)).padStart(7, "0")}`;
    created.otpPhones.push(phone2);
    await makeUser(); // فقط برای ثبت پاکسازی
    const sent = await sendOtp({ phoneRaw: phone2 });
    expect(sent.devCode).toMatch(/^\d{6}$/);
    try {
      await sendOtp({ phoneRaw: phone2 });
      expect.unreachable();
    } catch (e) {
      expect((e as Error).message).toContain("صبر کنید");
    }
  });

  it("کد اشتباه تلاش می‌سوزاند؛ بعد از ۵ تلاش TOO_MANY", async () => {
    const phone3 = `0934${String(Math.floor(Math.random() * 1_000_000_0)).padStart(7, "0")}`;
    created.otpPhones.push(phone3);
    await sendOtp({ phoneRaw: phone3 });

    // ۵ تلاش اشتباه — همه «کد اشتباه» (تلاش ششم ممنوع می‌شود)
    for (let i = 0; i < 5; i++) {
      try {
        await verifyOtpAndLogin({ phoneRaw: phone3, codeRaw: "000000" });
        expect.unreachable();
      } catch (e) {
        expect((e as Error).message).toContain("کد تأیید اشتباه است");
      }
    }
    // تلاش ششم — TOO_MANY_ATTEMPTS (بعد از ریست سقف verify تا دو دفاع جدا شوند)
    await rateLimiter.reset(rateKey("otp-verify", "phone", phone3));
    try {
      await verifyOtpAndLogin({ phoneRaw: phone3, codeRaw: "000000" });
      expect.unreachable();
    } catch (e) {
      expect((e as Error).message).toContain("تعداد تلاش‌ها");
    }
  });

  it("کد منقضی رد می‌شود", async () => {
    const phone4 = `0933${String(Math.floor(Math.random() * 1_000_000_0)).padStart(7, "0")}`;
    created.otpPhones.push(phone4);
    const sent = await sendOtp({ phoneRaw: phone4 });

    // کد را منقضی کن
    await db.otpCode.updateMany({
      where: { phone: phone4, usedAt: null },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    try {
      await verifyOtpAndLogin({ phoneRaw: phone4, codeRaw: sent.devCode! });
      expect.unreachable();
    } catch (e) {
      expect((e as Error).message).toContain("منقضی");
    }
  });

  it("کد یک‌بار مصرف است — verify دوم با همان کد رد می‌شود", async () => {
    const phone5 = `0932${String(Math.floor(Math.random() * 1_000_000_0)).padStart(7, "0")}`;
    created.otpPhones.push(phone5);
    const sent = await sendOtp({ phoneRaw: phone5 });
    await verifyOtpAndLogin({ phoneRaw: phone5, codeRaw: sent.devCode! });

    // خروج و ورود دوم با همان کد
    await db.session.deleteMany({});
    try {
      await verifyOtpAndLogin({ phoneRaw: phone5, codeRaw: sent.devCode! });
      expect.unreachable();
    } catch (e) {
      const msg = (e as Error).message;
      expect(msg.includes("قبلاً استفاده") || msg.includes("کدی برای این شماره")).toBe(true);
    }
  });

  it("rate limit: بیش از ۳ ارسال در ۱۰ دقیقه برای یک شماره رد می‌شود", async () => {
    const phone6 = `0931${String(Math.floor(Math.random() * 1_000_000_0)).padStart(7, "0")}`;
    created.otpPhones.push(phone6);

    await sendOtp({ phoneRaw: phone6 }).catch(() => null);
    // cooldown مانع ارسال پشت سر هم است — برای تست سقف، cooldown رکوردها را دستی عقب می‌بریم
    for (let i = 0; i < 3; i++) {
      await db.otpCode.updateMany({
        where: { phone: phone6 },
        data: { createdAt: new Date(Date.now() - 120_000) },
      });
      await sendOtp({ phoneRaw: phone6 }).catch(() => null);
    }
    // تلاش چهارم در پنجره — باید RATE_LIMITED باشد
    await db.otpCode.updateMany({
      where: { phone: phone6 },
      data: { createdAt: new Date(Date.now() - 120_000) },
    });
    try {
      await sendOtp({ phoneRaw: phone6 });
      expect.unreachable();
    } catch (e) {
      const msg = (e as Error).message;
      expect(msg.includes("زیاد") || msg.includes("صبر")).toBe(true);
    }
  });
});

/* ================================================================== */
/* دفترچه آدرس                                                         */
/* ================================================================== */

describe("AddressBook — قاعده تک‌پیش‌فرض", () => {
  let userId: string;

  beforeAll(async () => {
    const user = await makeUser();
    userId = user.id;
  });

  it("اولین آدرس خودکار پیش‌فرض می‌شود", async () => {
    const a1 = await createCustomerAddress(userId, {
      fullName: "الف ب",
      phone: "09121112233",
      province: "تهران",
      city: "تهران",
      postalCode: "1965843111",
      line: "خیابان اول پلاک ۱",
    });
    created.addressIds.push(a1.id);
    expect(a1.isDefault).toBe(true);
  });

  it("افزودن آدرس دوم (isDefault:false) پیش‌فرض را عوض نمی‌کند", async () => {
    const a2 = await createCustomerAddress(userId, {
      fullName: "ج د",
      phone: "09121112233",
      province: "گیلان",
      city: "رشت",
      postalCode: "4163944455",
      line: "خیابان دوم پلاک ۲",
      isDefault: false,
    });
    created.addressIds.push(a2.id);
    expect(a2.isDefault).toBe(false);
    const list = await listAddresses(userId);
    expect(list.filter((a) => a.isDefault)).toHaveLength(1);
    expect(list.find((a) => a.isDefault)!.city).toBe("تهران");
  });

  it("setDefault پیش‌فرض را جابه‌جا می‌کند — همیشه دقیقاً یکی", async () => {
    const list = await listAddresses(userId);
    const second = list.find((a) => !a.isDefault)!;
    await setDefaultCustomerAddress(userId, second.id);
    const after = await listAddresses(userId);
    expect(after.filter((a) => a.isDefault)).toHaveLength(1);
    expect(after.find((a) => a.isDefault)!.id).toBe(second.id);
  });

  it("حذف پیش‌فرض → جدیدترین باقی‌مانده ارتقا می‌یابد", async () => {
    const list = await listAddresses(userId);
    const currentDefault = list.find((a) => a.isDefault)!;
    await deleteCustomerAddress(userId, currentDefault.id);
    const after = await listAddresses(userId);
    expect(after.filter((a) => a.isDefault)).toHaveLength(1);
    expect(after).toHaveLength(1);
  });

  it("ویرایش با isDefault:true پیش‌فرض را جابه‌جا می‌کند", async () => {
    const a1 = await createCustomerAddress(userId, {
      fullName: "و خ",
      phone: "09121112233",
      province: "فارس",
      city: "شیراز",
      postalCode: "7134746111",
      line: "خیابان سوم پلاک ۳",
    });
    created.addressIds.push(a1.id);
    await updateCustomerAddress(userId, a1.id, {
      fullName: "و خ",
      phone: "09121112233",
      province: "فارس",
      city: "شیراز",
      postalCode: "7134746111",
      line: "خیابان سوم پلاک ۳ ویرایش",
      isDefault: true,
    });
    const after = await listAddresses(userId);
    expect(after.filter((a) => a.isDefault)).toHaveLength(1);
    expect(after.find((a) => a.isDefault)!.id).toBe(a1.id);
    expect(after.find((a) => a.isDefault)!.line).toContain("ویرایش");
  });

  it("سقف ۱۰ آدرس — آدرس ۱۱ رد می‌شود", async () => {
    // فعلاً ۲ آدرس داریم — تا ۱۰ پر می‌کنیم
    const existing = await listAddresses(userId);
    for (let i = existing.length; i < MAX_ADDRESSES; i++) {
      const a = await createCustomerAddress(userId, {
        fullName: `کاربر ${i}`,
        phone: "09121112233",
        province: "تهران",
        city: "تهران",
        postalCode: "1965843111",
        line: `خیابان شماره ${i} پلاک ${i}`,
      });
      created.addressIds.push(a.id);
    }
    try {
      await createCustomerAddress(userId, {
        fullName: "بیست و یکم",
        phone: "09121112233",
        province: "تهران",
        city: "تهران",
        postalCode: "1965843111",
        line: "خیابان یازدهم پلاک ۱۱",
      });
      expect.unreachable();
    } catch (e) {
      expect((e as Error).message).toContain("حداکثر");
    }
  });
});

/* ================================================================== */
/* Cart Merge — طلایی M4                                               */
/* ================================================================== */

describe("CartMerge — ادغام بدون گم شدن", () => {
  it("ادغام مهمان + سروری: تجمعی، سقف موجودی، رد واریانت مرده", async () => {
    const user = await makeUser();
    // واریانت سروری: موجودی ۶ — سبد سروری ۴
    const v1 = await makeVariantWithStock(db, created, 6);
    await addToServerCart(user.id, { variantId: v1.id, quantity: 4 });
    // واریانت جدید فقط در سبد مهمان
    const v2 = await makeVariantWithStock(db, created, 5);
    // واریانت مرده — باید بی‌سروصدا رد شود
    const dead = await makeVariantWithStock(db, created, 5, true);

    const merged = await mergeGuestCart(user.id, [
      { variantId: v1.id, quantity: 2 }, // 4+2=6 → سقف 6
      { variantId: v2.id, quantity: 1 }, // جدید → 1
      { variantId: dead.id, quantity: 3 }, // مرده → رد
    ]);

    expect(merged).toHaveLength(2);
    const line1 = merged.find((l) => l.lineId.startsWith(v1.productId))!;
    const line2 = merged.find((l) => l.lineId.startsWith(v2.productId))!;
    expect(line1.quantity).toBe(6); // سقف موجودی
    expect(line2.quantity).toBe(1);

    // هیچ رکورد سبد جدا برای dead
    const cart = await db.cart.findUnique({ where: { userId: user.id }, include: { items: true } });
    expect(cart!.items).toHaveLength(2);
  });

  it("getServerCartLines اقلام مرده را از DB پاک می‌کند", async () => {
    const user = await makeUser();
    const v = await makeVariantWithStock(db, created, 5);
    await addToServerCart(user.id, { variantId: v.id, quantity: 1 });

    // واریانت را غیرفعال کن — قلم سبد می‌میرد
    await db.variant.update({ where: { id: v.id }, data: { isActive: false } });

    const lines = await getServerCartLines(user.id);
    expect(lines).toHaveLength(0);
    const cart = await db.cart.findUnique({ where: { userId: user.id }, include: { items: true } });
    expect(cart!.items).toHaveLength(0); // از DB هم پاک شد
  });
});
