import { db } from "@/lib/db";
import { PageHeader } from "@/components/admin/page-header";
import { FaqManager } from "./faq-manager";
import { requirePageAccess } from "@/lib/admin/page-guard";

export const dynamic = "force-dynamic";

export default async function AdminFaqPage() {
  await requirePageAccess("faq");
  const items = await db.faqItem.findMany({ orderBy: [{ sortOrder: "asc" }, { id: "asc" }] });
  return (
    <div>
      <PageHeader
        title="سوالات متداول"
        description={`${items.length} سوال — در صفحه عمومی /faq نمایش داده می‌شود`}
      />
      <FaqManager
        items={items.map((f) => ({
          id: f.id,
          question: f.question,
          answer: f.answer,
          sortOrder: f.sortOrder,
        }))}
      />
    </div>
  );
}
