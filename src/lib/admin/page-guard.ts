import "server-only";
import { redirect } from "next/navigation";
import { getPanelContext } from "@/core/auth/session-service";
import type { AdminAuthContext } from "@/core/auth/session-service";
import { ADMIN_PAGE_READ_MAP } from "./page-read-map";
import type { AdminPageRoute } from "./page-read-map";

/**
 * authorize سطح صفحه — SEC-01 (تکمیل §۶ سند: read هم مجوز می‌خواهد)
 * ---------------------------------------------------------------
 * بالای هر page سروری پنل صدا زده می‌شود:
 *
 *   export default async function AdminStaffPage() {
 *     await requirePageAccess("staff");
 *     ...
 *   }
 *
 * - نشست ادمین معتبر ندارد → redirect به /admin/login (هم‌راستا با layout)
 * - نقش مجوز read صفحه را ندارد → redirect به /admin/no-access (۴۰۳ دوستانه)
 *
 * ⚠️ این لایه جایگزین گاردهای mutation نیست — امنیت واقعی اکشن‌ها همچنان
 * `withAdminAction(requirePermission)` است (§۲.۲)؛ این لایه فقط «دیدن صفحه»
 * را به ماتریس read گره می‌زند. (CR-8/55-c: صفحات dashboard/sms/notifications
 * هم اکنون با همین helper یکدست شدند؛ account عمداً فقط-احراز‌هویت است.)
 */
export async function requirePageAccess(route: AdminPageRoute): Promise<AdminAuthContext> {
  const ctx = await getPanelContext();
  if (!ctx) redirect("/admin/login");

  const needed = ADMIN_PAGE_READ_MAP[route];
  const ok = needed.some((p) => ctx.actor.permissions.includes(p));
  if (!ok) redirect("/admin/no-access");

  return ctx;
}
