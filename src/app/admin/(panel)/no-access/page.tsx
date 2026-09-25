import Link from "next/link";
import { redirect } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import { getPanelContext } from "@/core/auth/session-service";
import { getRoleDefinition } from "@/core/auth/roles";
import type { SystemRoleName } from "@/domain/models/account";
import { PERMISSIONS } from "@/core/auth/permissions";

export const dynamic = "force-dynamic";

/**
 * صفحهٔ «دسترسی ندارید» — مقصد redirect صفحات ممنوع (SEC-01).
 * عمداً هیچ مجوز read نمی‌خواهد (فقط احراز) تا حلقهٔ redirect رخ ندهد.
 */
export default async function AdminNoAccessPage() {
  const ctx = await getPanelContext();
  if (!ctx) redirect("/admin/login");

  let roleTitle: string | null = ctx.actor.role ?? null;
  if (roleTitle) {
    try {
      roleTitle = getRoleDefinition(roleTitle as SystemRoleName).title;
    } catch {
      // نقش ناشناخته — همان نام خام نمایش داده می‌شود
    }
  }

  const canDashboard = ctx.actor.permissions.includes(PERMISSIONS.analyticsRead);

  return (
    <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
      <ShieldAlert className="size-12 text-muted-foreground" aria-hidden />
      <h1 className="text-xl font-bold">دسترسی به این بخش ندارید</h1>
      <p className="max-w-md text-sm leading-6 text-muted-foreground">
        دسترسی‌های شما بر اساس نقش{roleTitle ? ` («${roleTitle}»)` : ""} محدود شده است. اگر فکر
        می‌کنید این محدودیت اشتباه است، با مدیر ارشد هماهنگ کنید.
      </p>
      <div className="flex gap-3">
        {canDashboard && (
          <Link
            href="/admin"
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            بازگشت به داشبورد
          </Link>
        )}
        <Link
          href="/admin/account"
          className="rounded-md border px-4 py-2 text-sm font-medium transition-colors hover:bg-muted"
        >
          حساب من
        </Link>
      </div>
    </div>
  );
}
