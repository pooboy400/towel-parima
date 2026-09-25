import { PageHeader } from "@/components/admin/page-header";
import { requirePageAccess } from "@/lib/admin/page-guard";
import { JournalForm } from "../journal-form";

export const dynamic = "force-dynamic";

export default async function NewJournalPostPage() {
  await requirePageAccess("journal");
  return (
    <div>
      <PageHeader title="مقاله جدید" description="پیش‌نویس ذخیره کنید و هر وقت آماده بودید منتشر کنید" />
      <JournalForm
        initial={{
          title: "",
          slug: "",
          excerpt: "",
          bodyMarkdown: "",
          coverKey: "",
          status: "DRAFT",
        }}
      />
    </div>
  );
}
