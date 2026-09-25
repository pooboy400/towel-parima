"use client";

/**
 * ProductForm — فرم ایجاد/ویرایش محصول + واریانت‌ها (M2)
 * ---------------------------------------------------------------
 * تب‌ها: پایه · واریانت‌ها (ترکیب رنگ×سایز) · تصاویر · جزئیات
 * ترکیب‌ساز: رنگ‌ها×سایزها → ردیف‌های واریانت با SKU خودکار — ردیف‌های
 * موجود حفظ می‌شوند (id) و فقط ترکیب‌های غایب اضافه می‌شوند.
 */

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Plus, Rows3, Save, Trash2, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { upsertProductAction } from "@/app/admin/(panel)/products/actions";
import { MediaPicker } from "./media-picker";

export interface ProductFormOptions {
  categories: { id: string; name: string }[];
  colors: { id: string; name: string; hex: string }[];
  sizes: { id: string; name: string }[];
  collections: { id: string; name: string }[];
}

export interface ProductVariantRow {
  id?: string;
  sku: string;
  price: string;
  compareAtPrice: string;
  stock: string;
  colorId: string;
  sizeId: string;
  isActive: boolean;
}

export interface ProductFormInitial {
  id?: string;
  name: string;
  slug: string;
  categoryId: string;
  shortDescription: string;
  description: string;
  status: "DRAFT" | "ACTIVE" | "ARCHIVED";
  specs: { label: string; value: string }[];
  care: string[];
  suitableFor: string[];
  features: string[];
  collectionIds: string[];
  sortOrder: string;
  images: string[];
  variants: ProductVariantRow[];
}

const emptyDefaultPrice = "0";

function randomId4() {
  return Math.random().toString(36).slice(2, 6).toUpperCase();
}

function autoSku(colorName: string | undefined, sizeName: string | undefined) {
  const c = (colorName ?? "STD").replace(/[^A-Za-z]/g, "").slice(0, 4).toUpperCase() || "STD";
  const s = (sizeName ?? "STD").replace(/[^A-Za-z0-9]/g, "").slice(0, 4).toUpperCase() || "STD";
  return `PRIMA-${c}-${s}-${randomId4()}`;
}

export function ProductForm({
  options,
  initial,
}: {
  options: ProductFormOptions;
  initial: ProductFormInitial;
}) {
  const router = useRouter();
  const isEdit = Boolean(initial.id);

  const [name, setName] = useState(initial.name);
  const [slug, setSlug] = useState(initial.slug);
  const [categoryId, setCategoryId] = useState(initial.categoryId);
  const [status, setStatus] = useState(initial.status);
  const [shortDescription, setShortDescription] = useState(initial.shortDescription);
  const [description, setDescription] = useState(initial.description);
  const [specs, setSpecs] = useState(initial.specs.length ? initial.specs : [{ label: "", value: "" }]);
  const [careText, setCareText] = useState(initial.care.join("\n"));
  const [suitableForText, setSuitableForText] = useState(initial.suitableFor.join("\n"));
  const [featuresText, setFeaturesText] = useState(initial.features.join("\n"));
  const [collectionIds, setCollectionIds] = useState<string[]>(initial.collectionIds);
  const [sortOrder, setSortOrder] = useState(initial.sortOrder);
  const [images, setImages] = useState<string[]>(initial.images);
  const [variants, setVariants] = useState<ProductVariantRow[]>(initial.variants);
  const [selectedColors, setSelectedColors] = useState<string[]>(
    [...new Set(initial.variants.map((v) => v.colorId).filter(Boolean))],
  );
  const [selectedSizes, setSelectedSizes] = useState<string[]>(
    [...new Set(initial.variants.map((v) => v.sizeId).filter(Boolean))],
  );
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const colorById = useMemo(
    () => new Map(options.colors.map((c) => [c.id, c])),
    [options.colors],
  );
  const sizeById = useMemo(
    () => new Map(options.sizes.map((s) => [s.id, s])),
    [options.sizes],
  );

  /** ساخت ترکیب‌های غایب رنگ×سایز — ردیف‌های موجود دست‌نخورده */
  function generateCombinations() {
    const combos: { colorId: string; sizeId: string }[] = [];
    const colors = selectedColors.length ? selectedColors : [""];
    const sizes = selectedSizes.length ? selectedSizes : [""];
    for (const c of colors) for (const s of sizes) combos.push({ colorId: c, sizeId: s });

    const existing = new Set(variants.map((v) => `${v.colorId}|${v.sizeId}`));
    const additions: ProductVariantRow[] = [];
    for (const combo of combos) {
      const key = `${combo.colorId}|${combo.sizeId}`;
      if (existing.has(key)) continue;
      existing.add(key);
      additions.push({
        sku: autoSku(colorById.get(combo.colorId)?.name, sizeById.get(combo.sizeId)?.name),
        price: variants[0]?.price ?? emptyDefaultPrice,
        compareAtPrice: "",
        stock: "10",
        colorId: combo.colorId,
        sizeId: combo.sizeId,
        isActive: true,
      });
    }
    if (!additions.length) {
      toast.info("همه ترکیب‌های انتخاب‌شده از قبل موجودند.");
      return;
    }
    setVariants([...variants, ...additions]);
    toast.success(`${additions.length} واریانت جدید اضافه شد.`);
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      const payload = {
        ...(isEdit ? { id: initial.id } : {}),
        name,
        slug,
        categoryId,
        shortDescription,
        description,
        status,
        specs: specs.filter((s) => s.label.trim() && s.value.trim()),
        care: careText.split("\n").map((s) => s.trim()).filter(Boolean),
        suitableFor: suitableForText.split("\n").map((s) => s.trim()).filter(Boolean),
        features: featuresText.split("\n").map((s) => s.trim()).filter(Boolean),
        collectionIds,
        sortOrder,
        images: images.map((storageKey) => ({ storageKey, alt: null })),
        variants: variants.map((v) => ({
          ...(v.id ? { id: v.id } : {}),
          sku: v.sku,
          price: v.price,
          compareAtPrice: v.compareAtPrice || null,
          stock: v.stock,
          colorId: v.colorId || null,
          sizeId: v.sizeId || null,
          isActive: v.isActive,
        })),
      };

      const res = await upsertProductAction(payload);
      if (res.ok) {
        toast.success(isEdit ? "محصول به‌روزرسانی شد." : "محصول ساخته شد.");
        router.push("/admin/products");
        router.refresh();
      } else {
        setError(res.error.message);
        toast.error(res.error.message);
      }
    });
  }

  return (
    <Tabs defaultValue="base" dir="rtl">
      <TabsList className="mb-6 bg-sand-soft/60 rounded-2xl p-1 h-auto">
        <TabsTrigger value="base" className="rounded-xl data-[state=active]:bg-surface">
          اطلاعات پایه
        </TabsTrigger>
        <TabsTrigger value="variants" className="rounded-xl data-[state=active]:bg-surface">
          واریانت‌ها ({variants.length})
        </TabsTrigger>
        <TabsTrigger value="images" className="rounded-xl data-[state=active]:bg-surface">
          تصاویر ({images.length})
        </TabsTrigger>
        <TabsTrigger value="details" className="rounded-xl data-[state=active]:bg-surface">
          جزئیات
        </TabsTrigger>
      </TabsList>

      {/* ── پایه */}
      <TabsContent value="base" className="space-y-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="pf-name">نام محصول *</Label>
            <Input id="pf-name" value={name} onChange={(e) => setName(e.target.value)} className="rounded-xl" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pf-slug">اسلاگ (نشانی صفحه) *</Label>
            <Input
              id="pf-slug"
              dir="ltr"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              className="rounded-xl text-left"
              placeholder="prima-bath-towel"
            />
          </div>
          <div className="space-y-2">
            <Label>دسته‌بندی *</Label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full rounded-xl border border-input bg-surface px-3 py-2 text-sm"
            >
              <option value="">— انتخاب کنید —</option>
              {options.categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label>وضعیت</Label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as typeof status)}
              className="w-full rounded-xl border border-input bg-surface px-3 py-2 text-sm"
            >
              <option value="DRAFT">پیش‌نویس — در فروشگاه دیده نمی‌شود</option>
              <option value="ACTIVE">فعال — قابل فروش</option>
              <option value="ARCHIVED">آرشیو</option>
            </select>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="pf-short">توضیح کوتاه (زیر نام محصول)</Label>
          <Input
            id="pf-short"
            value={shortDescription}
            onChange={(e) => setShortDescription(e.target.value)}
            className="rounded-xl"
            maxLength={200}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="pf-desc">توضیحات کامل</Label>
          <Textarea
            id="pf-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="rounded-xl min-h-36"
          />
        </div>
      </TabsContent>

      {/* ── واریانت‌ها */}
      <TabsContent value="variants" className="space-y-5">
        <div className="bg-surface rounded-2xl border border-line p-5 space-y-4">
          <p className="text-sm font-semibold">ترکیب‌ساز — رنگ‌ها و سایزهای این محصول را بزنید</p>
          <div>
            <p className="text-xs text-stone-muted mb-2">رنگ‌ها</p>
            <div className="flex flex-wrap gap-2">
              {options.colors.map((c) => {
                const on = selectedColors.includes(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() =>
                      setSelectedColors(on ? selectedColors.filter((x) => x !== c.id) : [...selectedColors, c.id])
                    }
                    className={cn(
                      "flex items-center gap-2 rounded-xl border px-3 py-1.5 text-sm transition-colors",
                      on ? "border-terracotta bg-terracotta/10 font-semibold" : "border-line hover:border-sand",
                    )}
                  >
                    <span className="size-3.5 rounded-full border border-line" style={{ backgroundColor: c.hex }} />
                    {c.name}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <p className="text-xs text-stone-muted mb-2">سایزها</p>
            <div className="flex flex-wrap gap-2">
              {options.sizes.map((s) => {
                const on = selectedSizes.includes(s.id);
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() =>
                      setSelectedSizes(on ? selectedSizes.filter((x) => x !== s.id) : [...selectedSizes, s.id])
                    }
                    className={cn(
                      "rounded-xl border px-3 py-1.5 text-sm transition-colors",
                      on ? "border-terracotta bg-terracotta/10 font-semibold" : "border-line hover:border-sand",
                    )}
                  >
                    {s.name}
                  </button>
                );
              })}
            </div>
          </div>
          <Button type="button" variant="secondary" onClick={generateCombinations} className="rounded-xl">
            <Wand2 className="size-4" />
            ساخت ترکیب‌های غایب
          </Button>
        </div>

        {/* جدول واریانت‌ها */}
        {variants.length === 0 ? (
          <p className="text-sm text-stone-muted text-center py-8 border border-dashed border-line rounded-2xl">
            هنوز واریانتی نیست — رنگ و سایز انتخاب کنید و «ساخت ترکیب‌ها» را بزنید.
          </p>
        ) : (
          <div className="bg-surface rounded-2xl border border-line overflow-x-auto">
            <table className="w-full text-sm min-w-[760px]">
              <thead>
                <tr className="text-xs text-stone-muted border-b border-line">
                  <th className="p-3 text-right font-medium">رنگ</th>
                  <th className="p-3 text-right font-medium">سایز</th>
                  <th className="p-3 text-right font-medium">SKU</th>
                  <th className="p-3 text-right font-medium">قیمت (تومان)</th>
                  <th className="p-3 text-right font-medium">قبل از تخفیف</th>
                  <th className="p-3 text-right font-medium">موجودی</th>
                  <th className="p-3 text-center font-medium">فعال</th>
                  <th className="p-3" />
                </tr>
              </thead>
              <tbody>
                {variants.map((v, i) => (
                  <tr key={`${v.id ?? "new"}-${i}`} className="border-b border-line/60 last:border-0">
                    <td className="p-2">
                      <select
                        value={v.colorId}
                        onChange={(e) => {
                          const next = [...variants];
                          next[i] = { ...v, colorId: e.target.value };
                          setVariants(next);
                        }}
                        className="rounded-lg border border-input bg-surface px-2 py-1.5 text-xs"
                      >
                        <option value="">—</option>
                        {options.colors.map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </td>
                    <td className="p-2">
                      <select
                        value={v.sizeId}
                        onChange={(e) => {
                          const next = [...variants];
                          next[i] = { ...v, sizeId: e.target.value };
                          setVariants(next);
                        }}
                        className="rounded-lg border border-input bg-surface px-2 py-1.5 text-xs"
                      >
                        <option value="">—</option>
                        {options.sizes.map((s) => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                    </td>
                    <td className="p-2">
                      <Input
                        dir="ltr"
                        value={v.sku}
                        onChange={(e) => {
                          const next = [...variants];
                          next[i] = { ...v, sku: e.target.value.toUpperCase() };
                          setVariants(next);
                        }}
                        className="w-40 rounded-lg text-left text-xs"
                      />
                    </td>
                    <td className="p-2">
                      <Input
                        inputMode="numeric"
                        value={v.price}
                        onChange={(e) => {
                          const next = [...variants];
                          next[i] = { ...v, price: e.target.value };
                          setVariants(next);
                        }}
                        className="w-28 rounded-lg text-xs tabular-nums"
                      />
                    </td>
                    <td className="p-2">
                      <Input
                        inputMode="numeric"
                        value={v.compareAtPrice}
                        placeholder="—"
                        onChange={(e) => {
                          const next = [...variants];
                          next[i] = { ...v, compareAtPrice: e.target.value };
                          setVariants(next);
                        }}
                        className="w-28 rounded-lg text-xs tabular-nums"
                      />
                    </td>
                    <td className="p-2">
                      <Input
                        inputMode="numeric"
                        value={v.stock}
                        onChange={(e) => {
                          const next = [...variants];
                          next[i] = { ...v, stock: e.target.value };
                          setVariants(next);
                        }}
                        className="w-20 rounded-lg text-xs tabular-nums"
                      />
                    </td>
                    <td className="p-2 text-center">
                      <Switch
                        checked={v.isActive}
                        onCheckedChange={(on) => {
                          const next = [...variants];
                          next[i] = { ...v, isActive: on };
                          setVariants(next);
                        }}
                      />
                    </td>
                    <td className="p-2">
                      <button
                        type="button"
                        aria-label="حذف واریانت"
                        onClick={() => setVariants(variants.filter((_, j) => j !== i))}
                        className="text-red-500 hover:text-red-600"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </TabsContent>

      {/* ── تصاویر */}
      <TabsContent value="images">
        <div className="bg-surface rounded-2xl border border-line p-5">
          <p className="text-sm text-stone-muted mb-4">
            اولین تصویر = عکس اصلی محصول. ترتیب را با موس روی هر عکس عوض کنید.
          </p>
          <MediaPicker value={images} onChange={setImages} max={10} />
        </div>
      </TabsContent>

      {/* ── جزئیات */}
      <TabsContent value="details" className="space-y-5">
        <div className="rounded-lg border border-line bg-sand-soft/50 p-4 text-[13px] leading-6 text-stone-muted">
          برچسب‌های «پرفروش»، «جدید» و «محدود» به‌صورت خودکار از روی فروش واقعی،
          تاریخ افزودن محصول و موجودی انبار محاسبه می‌شوند و دستی قابل ویرایش نیستند.
          آستانه‌ها از <span className="font-medium">تنظیمات فروشگاه → قوانین برچسب‌های خودکار</span> قابل تغییر است.
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="pf-sort">ترتیب نمایش</Label>
            <Input
              id="pf-sort"
              inputMode="numeric"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              className="rounded-xl tabular-nums"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>کالکشن‌ها</Label>
          <div className="flex flex-wrap gap-2">
            {options.collections.map((col) => {
              const on = collectionIds.includes(col.id);
              return (
                <button
                  key={col.id}
                  type="button"
                  onClick={() =>
                    setCollectionIds(on ? collectionIds.filter((x) => x !== col.id) : [...collectionIds, col.id])
                  }
                  className={cn(
                    "rounded-xl border px-3 py-1.5 text-sm transition-colors",
                    on ? "border-terracotta bg-terracotta/10 font-semibold" : "border-line hover:border-sand",
                  )}
                >
                  {col.name}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="pf-features">ویژگی‌ها (هر خط یک مورد)</Label>
          <Textarea id="pf-features" value={featuresText} onChange={(e) => setFeaturesText(e.target.value)} className="rounded-xl min-h-24" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="pf-care">دستور نگهداری (هر خط یک مورد)</Label>
          <Textarea id="pf-care" value={careText} onChange={(e) => setCareText(e.target.value)} className="rounded-xl min-h-20" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="pf-suitable">مناسب برای (هر خط یک مورد)</Label>
          <Textarea id="pf-suitable" value={suitableForText} onChange={(e) => setSuitableForText(e.target.value)} className="rounded-xl min-h-20" />
        </div>

        <div className="bg-surface rounded-2xl border border-line p-5 space-y-3">
          <p className="text-sm font-semibold flex items-center gap-2">
            <Rows3 className="size-4 text-terracotta-deep" />
            جدول مشخصات
          </p>
          {specs.map((row, i) => (
            <div key={i} className="flex gap-2">
              <Input
                value={row.label}
                placeholder="عنوان (مثلاً جنس)"
                onChange={(e) => {
                  const next = [...specs];
                  next[i] = { ...row, label: e.target.value };
                  setSpecs(next);
                }}
                className="rounded-xl w-48"
              />
              <Input
                value={row.value}
                placeholder="مقدار (مثلاً ۱۰۰٪ پنبه ترکی)"
                onChange={(e) => {
                  const next = [...specs];
                  next[i] = { ...row, value: e.target.value };
                  setSpecs(next);
                }}
                className="rounded-xl flex-1"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="حذف ردیف"
                onClick={() => setSpecs(specs.filter((_, j) => j !== i))}
                className="text-red-500"
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-xl"
            onClick={() => setSpecs([...specs, { label: "", value: "" }])}
          >
            <Plus className="size-4" />
            افزودن ردیف
          </Button>
        </div>
      </TabsContent>

      {/* خطا + دکمه ذخیره */}
      <div className="sticky bottom-4 mt-8">
        <div className="bg-surface/95 backdrop-blur rounded-2xl border border-line shadow-md p-4 flex items-center gap-4">
          {error && <p className="text-sm text-red-600 flex-1">{error}</p>}
          <div className="flex-1" />
          <Button onClick={submit} disabled={pending} className="rounded-xl h-11 px-6 font-semibold">
            {pending ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                در حال ذخیره…
              </>
            ) : (
              <>
                <Save className="size-4" />
                {isEdit ? "ذخیره تغییرات" : "ایجاد محصول"}
              </>
            )}
          </Button>
        </div>
      </div>
    </Tabs>
  );
}
