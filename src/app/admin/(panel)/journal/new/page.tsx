import { PageHeader } from "@/components/admin/page-header";
import { JournalForm } from "../journal-form";

export const dynamic = "force-dynamic";

export default function NewJournalPostPage() {
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
