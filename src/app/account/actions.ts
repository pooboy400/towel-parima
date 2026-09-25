/**
 * Account Actions — ورود دوگانه مشتری، خروج، دفترچه آدرس (M4)
 * ---------------------------------------------------------------
 * ورود OTP: sendOtp → verifyOtp (ساخت خودکار اکانت تازه) → createCustomerSession.
 * ورود رمز: signInWithPassword → createCustomerSession.
 * کوکی‌ست‌کردن فقط همین‌جا (Action layer) — سرویس‌ها بدون وابستگی به کوکی.
 */

"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { DomainError } from "@/core/errors";
import { getCustomerContext, requireCustomerContext, createCustomerSession, revokeCustomerSession } from "@/core/auth/customer-session";
import { sendOtp, verifyOtpAndLogin } from "@/core/auth/otp-auth-service";
import { signInWithPassword } from "@/core/auth/customer-auth-service";
import {
  otpSendSchema,
  otpVerifySchema,
  customerAddressSchema,
  addressIdSchema,
} from "@/domain/schemas/commerce";
import {
  listAddresses,
  createCustomerAddress,
  updateCustomerAddress,
  deleteCustomerAddress,
  setDefaultCustomerAddress,
} from "@/core/commerce/address-service";

/* ------------------------------------------------------------------ */
/* ورود / خروج                                                         */
/* ------------------------------------------------------------------ */

export type AuthActionResult =
  | { ok: true; redirect?: string; devCode?: string; isNewAccount?: boolean }
  | { ok: false; message: string };

async function clientIp(): Promise<string | null> {
  const hdrs = await headers();
  return hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
}

export async function sendOtpAction(input: { phone: string }): Promise<AuthActionResult> {
  try {
    const parsed = otpSendSchema.parse(input);
    const ip = await clientIp();
    const result = await sendOtp({ phoneRaw: parsed.phone, ip });
    return { ok: true, devCode: result.devCode };
  } catch (error) {
    if (error instanceof DomainError) return { ok: false, message: error.message };
    console.error("sendOtpAction failed:", error);
    return { ok: false, message: "ارسال کد ناموفق بود — دوباره تلاش کنید." };
  }
}

export async function verifyOtpAction(input: {
  phone: string;
  code: string;
}): Promise<AuthActionResult> {
  try {
    const parsed = otpVerifySchema.parse(input);
    const hdrs = await headers();
    const result = await verifyOtpAndLogin({
      phoneRaw: parsed.phone,
      codeRaw: parsed.code,
      ip: await clientIp(),
      userAgent: hdrs.get("user-agent") ?? null,
    });
    await createCustomerSession({
      userId: result.userId,
      ip: await clientIp(),
      userAgent: hdrs.get("user-agent") ?? null,
    });
    return { ok: true, isNewAccount: result.isNewAccount };
  } catch (error) {
    if (error instanceof DomainError) return { ok: false, message: error.message };
    console.error("verifyOtpAction failed:", error);
    return { ok: false, message: "بررسی کد ناموفق بود — دوباره تلاش کنید." };
  }
}

export async function signInWithPasswordAction(input: {
  phone: string;
  password: string;
}): Promise<AuthActionResult> {
  try {
    const hdrs = await headers();
    const result = await signInWithPassword({
      phoneRaw: input.phone,
      password: input.password,
      ip: await clientIp(),
    });
    await createCustomerSession({
      userId: result.userId,
      ip: await clientIp(),
      userAgent: hdrs.get("user-agent") ?? null,
    });
    return { ok: true };
  } catch (error) {
    if (error instanceof DomainError) return { ok: false, message: error.message };
    console.error("signInWithPasswordAction failed:", error);
    return { ok: false, message: "ورود ناموفق بود — دوباره تلاش کنید." };
  }
}

export async function logoutAction(): Promise<AuthActionResult> {
  await revokeCustomerSession();
  return { ok: true };
}

export async function getCustomerStateAction(): Promise<{
  ok: true;
  customer: { userId: string; name: string | null; phone: string | null } | null;
}> {
  const ctx = await getCustomerContext();
  return {
    ok: true,
    customer: ctx ? { userId: ctx.userId, name: ctx.name, phone: ctx.phone } : null,
  };
}

/* ------------------------------------------------------------------ */
/* دفترچه آدرس                                                         */
/* ------------------------------------------------------------------ */

export type AddressActionResult =
  | { ok: true }
  | { ok: false; message: string };

export async function listAddressesAction() {
  const ctx = await requireCustomerContext();
  return listAddresses(ctx.userId);
}

export async function createAddressAction(input: unknown): Promise<AddressActionResult> {
  try {
    const ctx = await requireCustomerContext();
    const parsed = customerAddressSchema.parse(input);
    await createCustomerAddress(ctx.userId, parsed);
    revalidatePath("/account");
    return { ok: true };
  } catch (error) {
    if (error instanceof DomainError) return { ok: false, message: error.message };
    console.error("createAddressAction failed:", error);
    return { ok: false, message: "ذخیره آدرس ناموفق بود." };
  }
}

export async function updateAddressAction(addressId: string, input: unknown): Promise<AddressActionResult> {
  try {
    const ctx = await requireCustomerContext();
    const parsed = customerAddressSchema.parse(input);
    const id = addressIdSchema.parse(addressId);
    await updateCustomerAddress(ctx.userId, id, parsed);
    revalidatePath("/account");
    return { ok: true };
  } catch (error) {
    if (error instanceof DomainError) return { ok: false, message: error.message };
    console.error("updateAddressAction failed:", error);
    return { ok: false, message: "ویرایش آدرس ناموفق بود." };
  }
}

export async function deleteAddressAction(addressId: string): Promise<AddressActionResult> {
  try {
    const ctx = await requireCustomerContext();
    const id = addressIdSchema.parse(addressId);
    await deleteCustomerAddress(ctx.userId, id);
    revalidatePath("/account");
    return { ok: true };
  } catch (error) {
    if (error instanceof DomainError) return { ok: false, message: error.message };
    console.error("deleteAddressAction failed:", error);
    return { ok: false, message: "حذف آدرس ناموفق بود." };
  }
}

export async function setDefaultAddressAction(addressId: string): Promise<AddressActionResult> {
  try {
    const ctx = await requireCustomerContext();
    const id = addressIdSchema.parse(addressId);
    await setDefaultCustomerAddress(ctx.userId, id);
    revalidatePath("/account");
    return { ok: true };
  } catch (error) {
    if (error instanceof DomainError) return { ok: false, message: error.message };
    console.error("setDefaultAddressAction failed:", error);
    return { ok: false, message: "تنظیم آدرس پیش‌فرض ناموفق بود." };
  }
}
