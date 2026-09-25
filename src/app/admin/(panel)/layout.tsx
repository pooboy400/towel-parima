import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getPanelContext } from "@/core/auth/session-service";
import { AdminShell } from "@/components/admin/admin-shell";
import { Toaster } from "@/components/ui/sonner";

export const metadata: Metadata = {
  title: { default: "پنل مدیریت | پریما", template: "%s | پنل پریما" },
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Layout پنل — تنها نقطه ورود صفحات محافظت‌شده.
 * احراز اینجا UX/مسیریابی است؛ امنیت واقعی هر اکشن = requirePermission (§2.2).
 */
export default async function AdminPanelLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getPanelContext();
  if (!ctx) redirect("/admin/login");

  return (
    <AdminShell
      actorName={ctx.actor.name ?? "مدیر"}
      actorRole={ctx.actor.role ?? "CUSTOMER"}
      actorEmail={null}
    >
      {children}
    </AdminShell>
  );
}
