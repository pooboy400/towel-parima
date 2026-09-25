import { db } from "@/lib/db";
import { PageHeader } from "@/components/admin/page-header";
import { MessagesList } from "./messages-list";
import { requirePageAccess } from "@/lib/admin/page-guard";

export const dynamic = "force-dynamic";

/**
 * پیام‌ها و خبرنامه — ردیف‌های واقعی ContactMessage (فرم تماس + عضویت خبرنامه).
 * جایگزین فاز ۱ که فرم‌ها فقط توست موفقیت نمایش می‌دادند و چیزی ذخیره نمی‌شد.
 */
export default async function AdminMessagesPage() {
  await requirePageAccess("messages");
  const messages = await db.contactMessage.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 200,
  });

  const unread = messages.filter((m) => m.status === "NEW").length;
  const subscribers = messages.filter((m) => m.kind === "NEWSLETTER").length;

  return (
    <div>
      <PageHeader
        title="پیام‌ها و خبرنامه"
        description={`${messages.length} ردیف · ${unread} خوانده‌نشده · ${subscribers} عضو خبرنامه`}
      />
      <MessagesList
        items={messages.map((m) => ({
          id: m.id,
          kind: m.kind,
          email: m.email,
          name: m.name,
          phone: m.phone,
          subject: m.subject,
          message: m.message,
          status: m.status,
          createdAt: m.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
