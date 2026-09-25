import { PageHeader } from "@/components/admin/page-header";
import { adminGetProductFormOptions } from "@/lib/repositories/admin-repository";
import { ProductForm } from "@/components/admin/product-form";

export const dynamic = "force-dynamic";

export default async function NewProductPage() {
  const options = await adminGetProductFormOptions();

  return (
    <div>
      <PageHeader title="محصول جدید" description="اطلاعات پایه را پر کنید و واریانت‌ها را بسازید" />
      <ProductForm
        options={options}
        initial={{
          name: "",
          slug: "",
          categoryId: "",
          shortDescription: "",
          description: "",
          status: "DRAFT",
          specs: [],
          care: [],
          suitableFor: [],
          features: [],
          collectionIds: [],
          sortOrder: "0",
          images: [],
          variants: [],
        }}
      />
    </div>
  );
}
