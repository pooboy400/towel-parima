/**
 * AddressService — دفترچه آدرس مشتری (M4)
 * ---------------------------------------------------------------
 * · همیشه دقیقاً یک isDefault — قاعده ثابت
 * · حذف آدرس پیش‌فرض → جدیدترین آدرس باقی‌مانده ارتقا می‌یابد
 * · مالکیت: userId همیشه داخل where — گارد سطح کوئری
 * · سقف ۱۰ آدرس برای هر کاربر
 */

import "server-only";
import { db } from "@/lib/db";
import { DomainError } from "@/core/errors";
import type { CheckoutAddressInput } from "@/domain/schemas/commerce";

export const MAX_ADDRESSES = 10;

/** همه آدرس‌های کاربر — پیش‌فرض اول، سپس جدیدترین */
export async function listAddresses(userId: string) {
  return db.address.findMany({
    where: { userId },
    orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
  });
}

/** آدرس پیش‌فرض ذخیره‌شده برای prefill checkout (M4) */
export async function getSavedCheckoutAddress(
  userId: string,
): Promise<CheckoutAddressInput | null> {
  const address = await db.address.findFirst({
    where: { userId },
    orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
  });
  if (!address) return null;
  return {
    fullName: address.fullName,
    phone: address.phone,
    province: address.province,
    city: address.city,
    postalCode: address.postalCode,
    line: address.line,
  };
}

/** افزودن آدرس — اولین آدرس همیشه پیش‌فرض می‌شود */
export async function createCustomerAddress(
  userId: string,
  input: {
    fullName: string;
    phone: string;
    province: string;
    city: string;
    postalCode: string;
    line: string;
    isDefault?: boolean;
  },
) {
  const count = await db.address.count({ where: { userId } });
  if (count >= MAX_ADDRESSES) {
    throw new DomainError(
      "CONFLICT",
      `حداکثر ${MAX_ADDRESSES} آدرس می‌توانید ذخیره کنید.`,
    );
  }
  const makeDefault = count === 0 || input.isDefault === true;

  return db.$transaction(async (tx) => {
    if (makeDefault) {
      await tx.address.updateMany({ where: { userId }, data: { isDefault: false } });
    }
    return tx.address.create({
      data: { userId, ...input, isDefault: makeDefault },
    });
  });
}

/** ویرایش آدرس — مالکیت گارد شده؛ isDefault:false نادیده گرفته می‌شود (قاعده تک‌پیش‌فرض) */
export async function updateCustomerAddress(
  userId: string,
  addressId: string,
  input: {
    fullName: string;
    phone: string;
    province: string;
    city: string;
    postalCode: string;
    line: string;
    isDefault?: boolean;
  },
) {
  const existing = await db.address.findFirst({
    where: { id: addressId, userId },
    select: { id: true, isDefault: true },
  });
  if (!existing) {
    throw new DomainError("NOT_FOUND", "آدرس یافت نشد.");
  }

  return db.$transaction(async (tx) => {
    if (input.isDefault === true && !existing.isDefault) {
      await tx.address.updateMany({ where: { userId }, data: { isDefault: false } });
    }
    return tx.address.update({
      where: { id: addressId },
      data: {
        fullName: input.fullName,
        phone: input.phone,
        province: input.province,
        city: input.city,
        postalCode: input.postalCode,
        line: input.line,
        ...(input.isDefault === true ? { isDefault: true } : {}),
      },
    });
  });
}

/** حذف آدرس — اگر پیش‌فرض بود، جدیدترین باقی‌مانده ارتقا می‌یابد */
export async function deleteCustomerAddress(userId: string, addressId: string): Promise<void> {
  const existing = await db.address.findFirst({
    where: { id: addressId, userId },
    select: { id: true, isDefault: true },
  });
  if (!existing) {
    throw new DomainError("NOT_FOUND", "آدرس یافت نشد.");
  }

  await db.$transaction(async (tx) => {
    await tx.address.delete({ where: { id: addressId } });
    if (existing.isDefault) {
      const next = await tx.address.findFirst({
        where: { userId },
        orderBy: { updatedAt: "desc" },
        select: { id: true },
      });
      if (next) {
        await tx.address.update({ where: { id: next.id }, data: { isDefault: true } });
      }
    }
  });
}

/** تعیین پیش‌فرض */
export async function setDefaultCustomerAddress(userId: string, addressId: string): Promise<void> {
  const existing = await db.address.findFirst({
    where: { id: addressId, userId },
    select: { id: true },
  });
  if (!existing) {
    throw new DomainError("NOT_FOUND", "آدرس یافت نشد.");
  }

  await db.$transaction(async (tx) => {
    await tx.address.updateMany({ where: { userId }, data: { isDefault: false } });
    await tx.address.update({ where: { id: addressId }, data: { isDefault: true } });
  });
}
