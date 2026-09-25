import { notFound } from "next/navigation";
import { requirePageAccess } from "@/lib/admin/page-guard";
import { PageHeader } from "@/components/admin/page-header";
import { db } from "@/lib/db";
import { JournalForm } from "../journal-form";

export const dynamic = "force-dynamic";

export default async function EditJournalPostPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePageAccess("journal");
  const { id } = await params;
  const post = await db.journalPost.findUnique({ where: { id } });
  if (!post) notFound();

  return (
    <div>
      <PageHeader title={`ویرایش: ${post.title}`} description={`اسلاگ: ${post.slug}`} />
      <JournalForm
        initial={{
          id: post.id,
          title: post.title,
          slug: post.slug,
          excerpt: post.excerpt,
          bodyMarkdown: post.bodyMarkdown,
          coverKey: post.coverKey ?? "",
          status: post.status as "DRAFT" | "PUBLISHED" | "ARCHIVED",
        }}
      />
    </div>
  );
}
