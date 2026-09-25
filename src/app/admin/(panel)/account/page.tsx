import { redirect } from "next/navigation";
import { PageHeader } from "@/components/admin/page-header";
import { getPanelContext } from "@/core/auth/session-service";
import { db } from "@/lib/db";
import { AccountForms } from "./account-forms";

export const dynamic = "force-dynamic";

export default async function AdminAccountPage() {
  const ctx = await getPanelContext();
  if (!ctx) redirect("/admin/login");

  const user = await db.user.findUnique({
    where: { id: ctx.actor.userId },
    select: { name: true, email: true, totpEnabled: true },
  });

  return (
    <div>
      <PageHeader title="حساب من" description="تنظیمات حساب شخصی شما" />
      <AccountForms
        name={user?.name ?? "مدیر"}
        email={user?.email ?? "—"}
        totpEnabled={user?.totpEnabled ?? false}
      />
    </div>
  );
}
