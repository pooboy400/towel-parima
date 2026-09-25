import { PageHeader } from "@/components/admin/page-header";
import { MediaGrid } from "./media-grid";
import { requirePageAccess } from "@/lib/admin/page-guard";

export const dynamic = "force-dynamic";

export default async function AdminMediaPage() {
  await requirePageAccess("media");
  return (
    <div>
      <PageHeader
        title="رسانه"
        description="کتابخانه تصاویر — آپلودها خودکار به WebP تبدیل و فشرده می‌شوند"
      />
      <MediaGrid />
    </div>
  );
}
