import { db } from "@/lib/db";
import { PageHeader } from "@/components/admin/page-header";
import { ReviewsModerator } from "../faq/faq-manager";
import { requirePageAccess } from "@/lib/admin/page-guard";

export const dynamic = "force-dynamic";

export default async function AdminReviewsPage() {
  await requirePageAccess("reviews");
  const pending = await db.review.findMany({
    where: { status: "PENDING" },
    include: { product: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <div>
      <PageHeader
        title="نظرات مشتریان"
        description="نظرات جدید پس از تأیید شما در صفحه محصول نمایش داده می‌شوند"
      />
      <ReviewsModerator
        items={pending.map((r) => ({
          id: r.id,
          authorName: r.authorName,
          rating: r.rating,
          body: r.body,
          status: r.status,
          createdAt: r.createdAt.toISOString(),
          productName: r.product?.name ?? "—",
        }))}
      />
    </div>
  );
}
