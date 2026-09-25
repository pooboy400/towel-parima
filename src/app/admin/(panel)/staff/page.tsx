import { db } from "@/lib/db";
import { formatNumber, formatDate } from "@/lib/format";
import { PageHeader } from "@/components/admin/page-header";
import { ROLE_TITLES } from "@/lib/admin/role-titles";
import { StaffManager } from "./staff-manager";

export const dynamic = "force-dynamic";

export default async function AdminStaffPage() {
  const [users, roles] = await Promise.all([
    db.user.findMany({
      where: { deletedAt: null },
      include: { role: true },
      orderBy: { createdAt: "asc" },
    }),
    db.role.findMany({ where: { isSystem: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div>
      <PageHeader
        title="کارکنان و نقش‌ها"
        description={`${formatNumber(users.length)} حساب کاربری پنل`}
      />
      <StaffManager
        users={users.map((u) => ({
          id: u.id,
          name: u.name ?? "—",
          email: u.email ?? "—",
          phone: u.phone,
          role: u.role?.name ?? "—",
          roleTitle: u.role ? (ROLE_TITLES[u.role.name] ?? u.role.name) : "بدون نقش",
          isActive: u.isActive,
          lastLoginAt: u.lastLoginAt ? formatDate(u.lastLoginAt.toISOString()) : "هرگز",
          createdAt: formatDate(u.createdAt.toISOString()),
        }))}
        roles={roles.map((r) => ({
          name: r.name,
          title: ROLE_TITLES[r.name] ?? r.title,
          permissionCount: r.permissions.length,
        }))}
      />
    </div>
  );
}
