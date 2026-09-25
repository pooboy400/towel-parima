/**
 * Action Helpers — قالب اجباری اکشن‌های ادمین (بخش ۲.۲ و ۸ سند معماری)
 * ---------------------------------------------------------------
 * زنجیره هر mutation ادمین:
 *   requireAdminContext (authenticate + requirePermission)
 *   → Zod (اسکیماهای دامنه، نرمال‌سازی ارقام فارسی)
 *   → قواعد کسب‌وکار → تراکنش
 *   → safeAudit (هر mutation ادمین audited — DoD بخش ۲۷)
 *   → revalidateTag فقط با CACHE_TAGS (بخش ۱۶.۱)
 *
 * خروجی استاندارد اکشن برای UI:
 *   { ok: true, data } | { ok: false, error: { code, message, fieldErrors? } }
 */

import "server-only";
import { headers } from "next/headers";
import { isDomainError } from "@/core/errors";
import { requireAdminContext, type AdminAuthContext } from "@/core/auth/session-service";
import { z } from "zod";

export type ActionError = {
  code: string;
  message: string;
  fieldErrors?: Record<string, string>;
};

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: ActionError };

/** IP + User-Agent برای AuditLog (بخش ۲۰ سند) */
export async function requestMeta(): Promise<{ ip: string | null; userAgent: string | null }> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  return {
    ip: forwarded ? forwarded.split(",")[0].trim() : (h.get("x-real-ip") ?? null),
    userAgent: h.get("user-agent"),
  };
}

/** تبدیل خطای Zod به fieldErrors فارسی برای فرم */
export function zodFieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.map(String).join(".") || "_";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

/**
 * wrapper اصلی — همه اکشن‌های mutation ادمین با این قالب نوشته می‌شوند.
 * fn کل کار کسب‌وکار را انجام می‌دهد؛ خطاها به خروجی استاندارد تبدیل می‌شوند.
 */
export async function withAdminAction<T>(
  permission: Parameters<typeof requireAdminContext>[0],
  fn: (ctx: AdminAuthContext & { token: string }) => Promise<T>,
): Promise<ActionResult<T>> {
  try {
    const ctx = await requireAdminContext(permission);
    const data = await fn(ctx);
    return { ok: true, data };
  } catch (e) {
    if (isDomainError(e)) {
      return {
        ok: false,
        error: { code: e.code, message: e.message },
      };
    }
    if (e instanceof z.ZodError) {
      // لاگ ساخت‌یافته برای تشخیص سریع — هرگز در UI پیام فنی نشان داده نمی‌شود
      console.error(
        JSON.stringify({
          level: "warn",
          type: "admin_zod_failed",
          issues: e.issues.map((i) => ({ path: i.path.join("."), message: i.message, code: i.code })),
        }),
      );
      return {
        ok: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "داده‌های فرم معتبر نیست.",
          fieldErrors: zodFieldErrors(e),
        },
      };
    }
    console.error(
      JSON.stringify({ level: "error", type: "admin_action_failed", message: String(e) }),
    );
    return { ok: false, error: { code: "INTERNAL", message: "خطای غیرمنتظره در سرور رخ داد." } };
  }
}
