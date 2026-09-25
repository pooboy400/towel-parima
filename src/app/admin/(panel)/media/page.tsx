import { PageHeader } from "@/components/admin/page-header";
import { MediaGrid } from "./media-grid";

export const dynamic = "force-dynamic";

export default function AdminMediaPage() {
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
