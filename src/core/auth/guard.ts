/**
 * Guard Layer — نقطه واحد اعمال authorization (بخش ۲ و ۶ سند معماری)
 * ---------------------------------------------------------------
 * ⚠️ قوانین قطعی:
 * ۱. هیچ handler ای خودش role را چک نمی‌کند — فقط requirePermission.
 * ۲. چک role مستقیم = privilege escalation در انتظار؛ ممنوع.
 * ۳. UI (مخفی‌سازی دکمه) فقط UX است — امنیت اینجاست.
 * ۴. Zod validation به هیچ عنوان authorization نیست.
 *
 * M0: قرارداد guard + SessionReader قراردادی.
 * M2: SessionReader به DB وصل می‌شود (Session دیتابیسی — ADR-005)؛
 *     امضای همین فایل ثابت می‌ماند.
 */

import "server-only";
import { cookies } from "next/headers";
import { DomainError } from "../errors";
import { PERMISSIONS, type Permission } from "./permissions";
import {
  CUSTOMER_SESSION_COOKIE,
  ADMIN_SESSION_COOKIE,
  MIN_SESSION_TOKEN_LENGTH,
} from "./cookies";
import type { AuthenticatedActor, Session, SystemRoleName } from "@/domain/models/account";

export { CUSTOMER_SESSION_COOKIE, ADMIN_SESSION_COOKIE, MIN_SESSION_TOKEN_LENGTH };

/* ------------------------------------------------------------------ */
/* SessionReader — تنها نقطه وابستگی guard به ذخیره‌سازی session        */
/* ------------------------------------------------------------------ */

export interface SessionReader {
  /**
   * خواندن session معتبر از توکن — revoked/expired/ناموجود = null.
   * پیاده‌سازی v1 (M1+) روی جدول Session دیتابیس.
   */
  getSession(token: string): Promise<Session | null>;
  /** بارگذاری actor (کاربر + نقش + مجوزها) — user غیرفعال/حذف‌شده = null */
  getActor(userId: string): Promise<AuthenticatedActor | null>;
}

/* ------------------------------------------------------------------ */
/* Guard                                                                */
/* ------------------------------------------------------------------ */

export interface GuardOptions {
  /** SessionReader جاری — در M2 از DI سراسری مقدار می‌گیرد */
  sessionReader: SessionReader;
  /**
   * توکن explicit — برای تسته‌ها و فراخوانی از API Route (که کوکی‌ها را
   * خودش از request می‌خواند). اگر داده نشود از cookies() خوانده می‌شود.
   */
  token?: string;
  /** آدرس IP برای audit — فراخواننده از request/headers تأمین می‌کند */
  ip?: string;
}

/** خواندن توکن از کوکی‌ها — ادمین اول (در صفحات ادمین) سپس مشتری */
async function readTokenFromCookies(): Promise<string> {
  const jar = await cookies();
  return (
    jar.get(ADMIN_SESSION_COOKIE)?.value ?? jar.get(CUSTOMER_SESSION_COOKIE)?.value ?? ""
  );
}

/**
 * گام ۱ زنجیره اجباری — authenticate.
 * بدون session معتبر: DomainError UNAUTHENTICATED (401).
 */
export async function authenticate(opts: GuardOptions): Promise<AuthenticatedActor> {
  const token = opts.token ?? (await readTokenFromCookies());

  if (token.length < MIN_SESSION_TOKEN_LENGTH) {
    throw new DomainError("UNAUTHENTICATED", "برای این عملیات باید وارد حساب شوید.");
  }

  const session = await opts.sessionReader.getSession(token);
  if (!session || session.revokedAt || new Date(session.expiresAt) <= new Date()) {
    throw new DomainError("UNAUTHENTICATED", "نشست شما منقضی شده است. دوباره وارد شوید.");
  }

  const actor = await opts.sessionReader.getActor(session.userId);
  if (!actor) {
    throw new DomainError("UNAUTHENTICATED", "حساب کاربری معتبر نیست.");
  }

  return actor;
}

/**
 * گام ۲ زنجیره اجباری — authorize.
 * همیشه پس از authenticate صدا زده می‌شود؛ هرگز مستقل.
 */
export async function requirePermission(
  permission: Permission,
  opts: GuardOptions,
): Promise<AuthenticatedActor> {
  const actor = await authenticate(opts);

  if (!actor.permissions.includes(permission)) {
    throw new DomainError("FORBIDDEN", "شما به این عملیات دسترسی ندارید.", undefined, {
      permission,
    });
  }
  return actor;
}

/** چند مجوز — کافی است یکی باشد (برای صفحات ترکیبی) */
export async function requireAnyPermission(
  permissions: readonly Permission[],
  opts: GuardOptions,
): Promise<AuthenticatedActor> {
  const actor = await authenticate(opts);
  const granted = permissions.find((p) => actor.permissions.includes(p));
  if (!granted) {
    throw new DomainError("FORBIDDEN", "شما به این عملیات دسترسی ندارید.", undefined, {
      permissions: [...permissions],
    });
  }
  return actor;
}

/**
 * گارد مسیر ادمین — فقط لایه اول (Middleware) با چک ارزان.
 * منبع حقیقت همچنان requirePermission داخل هر handler است (بخش ۲.۲ سند).
 */
export function looksLikeSessionToken(token: string | undefined): boolean {
  return Boolean(token && token.length >= MIN_SESSION_TOKEN_LENGTH);
}

export { PERMISSIONS };
export type { Permission, AuthenticatedActor, SystemRoleName };
