import { notFound } from "next/navigation";
import { PageHeader } from "@/components/admin/page-header";
import { adminGetProduct, adminGetProductFormOptions } from "@/lib/repositories/admin-repository";
import { ProductForm } from "@/components/admin/product-form";
import { requirePageAccess } from "@/lib/admin/page-guard";

export const dynamic = "force-dynamic";

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePageAccess("products");
  const { id } = await params;
  const [product, options] = await Promise.all([adminGetProduct(id), adminGetProductFormOptions()]);
  if (!product) notFound();

  return (
    <div>
      <PageHeader title={`ویرایش: ${product.name}`} description={`اسلاگ: ${product.slug}`} />
      <ProductForm
        options={options}
        initial={{
          id: product.id,
          name: product.name,
          slug: product.slug,
          categoryId: product.categoryId,
          shortDescription: product.shortDescription ?? "",
          description: product.description ?? "",
          status: product.status as "DRAFT" | "ACTIVE" | "ARCHIVED",
          specs: Array.isArray(product.specs) ? (product.specs as { label: string; value: string }[]) : [],
          care: Array.isArray(product.care) ? (product.care as string[]) : [],
          suitableFor: Array.isArray(product.suitableFor) ? (product.suitableFor as string[]) : [],
          features: Array.isArray(product.features) ? (product.features as string[]) : [],
          collectionIds: product.collections.map((c) => c.collection.id),
          sortOrder: String(product.sortOrder ?? 0),
          images: product.images.map((img) => img.storageKey),
          variants: product.variants.map((v) => ({
            id: v.id,
            sku: v.sku,
            price: String(v.price),
            compareAtPrice: v.compareAtPrice != null ? String(v.compareAtPrice) : "",
            stock: String(Math.max(0, v.stock - v.reserved)),
            colorId: v.colorId ?? "",
            sizeId: v.sizeId ?? "",
            isActive: v.isActive,
          })),
        }}
      />
    </div>
  );
}
