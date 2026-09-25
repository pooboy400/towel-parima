"use client";

/**
 * CategoryManager — لیست + دیالوگ ایجاد/ویرایش دسته‌بندی (M2)
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { MediaPicker } from "@/components/admin/media-picker";
import {
  upsertCategoryAction,
  deleteCategoryAction,
  upsertCollectionAction,
  deleteCollectionAction,
} from "./actions";

export interface CategoryRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  seoText: string | null;
  imageKey: string | null;
  sortOrder: number;
  productCount: number;
}

interface CategoryFormState {
  id?: string;
  name: string;
  slug: string;
  description: string;
  seoText: string;
  imageKey: string;
  sortOrder: string;
}

const EMPTY: CategoryFormState = {
  name: "",
  slug: "",
  description: "",
  seoText: "",
  imageKey: "",
  sortOrder: "0",
};

export function CategoryDialog({ initial }: { initial?: CategoryRow }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<CategoryFormState>(
    initial
      ? {
          id: initial.id,
          name: initial.name,
          slug: initial.slug,
          description: initial.description ?? "",
          seoText: initial.seoText ?? "",
          imageKey: initial.imageKey ?? "",
          sortOrder: String(initial.sortOrder),
        }
      : EMPTY,
  );

  function save() {
    startTransition(async () => {
      const res = await upsertCategoryAction(state);
      if (res.ok) {
        toast.success(initial ? "دسته‌بندی به‌روزرسانی شد." : "دسته‌بندی ساخته شد.");
        setOpen(false);
        router.refresh();
      } else {
        toast.error(res.error.message);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {initial ? (
          <button type="button" title="ویرایش" className="size-8 rounded-lg hover:bg-sand-soft flex items-center justify-center">
            <Pencil className="size-4" />
          </button>
        ) : (
          <Button className="rounded-xl">
            <Plus className="size-4" />
            دسته جدید
          </Button>
        )}
      </DialogTrigger>
      <DialogContent dir="rtl" className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initial ? "ویرایش دسته‌بندی" : "دسته‌بندی جدید"}</DialogTitle>
          <DialogDescription>اسلاگ در نشانی فروشگاه استفاده می‌شود (مثلاً /shop/bath-towels)</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>نام *</Label>
              <Input value={state.name} onChange={(e) => setState({ ...state, name: e.target.value })} className="rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label>اسلاگ *</Label>
              <Input dir="ltr" value={state.slug} onChange={(e) => setState({ ...state, slug: e.target.value })} className="rounded-xl text-left" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>توضیح کوتاه</Label>
            <Textarea value={state.description} onChange={(e) => setState({ ...state, description: e.target.value })} className="rounded-xl min-h-16" />
          </div>
          <div className="space-y-2">
            <Label>متن سئو (پایین صفحه دسته)</Label>
            <Textarea value={state.seoText} onChange={(e) => setState({ ...state, seoText: e.target.value })} className="rounded-xl min-h-20" />
          </div>
          <div className="space-y-2">
            <Label>تصویر دسته</Label>
            <MediaPicker value={state.imageKey ? [state.imageKey] : []} onChange={(next) => setState({ ...state, imageKey: next.at(-1) ?? "" })} max={1} />
          </div>
          <div className="space-y-2">
            <Label>ترتیب نمایش</Label>
            <Input inputMode="numeric" value={state.sortOrder} onChange={(e) => setState({ ...state, sortOrder: e.target.value })} className="rounded-xl tabular-nums w-28" />
          </div>
        </div>
        <DialogFooter className="flex-row-reverse gap-2">
          <Button onClick={save} disabled={pending} className="rounded-xl">
            {pending ? "در حال ذخیره…" : "ذخیره"}
          </Button>
          <Button variant="outline" onClick={() => setOpen(false)} className="rounded-xl">
            انصراف
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function CategoryDeleteButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      title="حذف"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const res = await deleteCategoryAction({ id });
          if (res.ok) {
            toast.success("دسته‌بندی حذف شد.");
            router.refresh();
          } else {
            toast.error(res.error.message);
          }
        })
      }
      className="size-8 rounded-lg hover:bg-red-50 text-red-500 flex items-center justify-center"
    >
      <Trash2 className="size-4" />
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* کالکشن‌ها — فرم/اقدام‌های مشابه                                      */
/* ------------------------------------------------------------------ */

export interface CollectionRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  imageKey: string | null;
  sortOrder: number;
  productIds: string[];
}

interface CollectionFormState {
  id?: string;
  name: string;
  slug: string;
  description: string;
  imageKey: string;
  sortOrder: string;
  productIds: string[];
}

export function CollectionDialog({
  initial,
  products,
}: {
  initial?: CollectionRow;
  products: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<CollectionFormState>(
    initial
      ? {
          id: initial.id,
          name: initial.name,
          slug: initial.slug,
          description: initial.description ?? "",
          imageKey: initial.imageKey ?? "",
          sortOrder: String(initial.sortOrder),
          productIds: initial.productIds,
        }
      : { name: "", slug: "", description: "", imageKey: "", sortOrder: "0", productIds: [] },
  );

  function save() {
    startTransition(async () => {
      const res = await upsertCollectionAction(state);
      if (res.ok) {
        toast.success(initial ? "کالکشن به‌روزرسانی شد." : "کالکشن ساخته شد.");
        setOpen(false);
        router.refresh();
      } else {
        toast.error(res.error.message);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {initial ? (
          <button type="button" title="ویرایش" className="size-8 rounded-lg hover:bg-sand-soft flex items-center justify-center">
            <Pencil className="size-4" />
          </button>
        ) : (
          <Button className="rounded-xl">
            <Plus className="size-4" />
            کالکشن جدید
          </Button>
        )}
      </DialogTrigger>
      <DialogContent dir="rtl" className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initial ? "ویرایش کالکشن" : "کالکشن جدید"}</DialogTitle>
          <DialogDescription>کالکشن مجموعه‌ای منتخب از محصولات است (مثلاً «ست هدیه»)</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>نام *</Label>
              <Input value={state.name} onChange={(e) => setState({ ...state, name: e.target.value })} className="rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label>اسلاگ *</Label>
              <Input dir="ltr" value={state.slug} onChange={(e) => setState({ ...state, slug: e.target.value })} className="rounded-xl text-left" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>توضیح</Label>
            <Textarea value={state.description} onChange={(e) => setState({ ...state, description: e.target.value })} className="rounded-xl min-h-16" />
          </div>
          <div className="space-y-2">
            <Label>تصویر</Label>
            <MediaPicker value={state.imageKey ? [state.imageKey] : []} onChange={(next) => setState({ ...state, imageKey: next.at(-1) ?? "" })} max={1} />
          </div>
          <div className="space-y-2">
            <Label>محصولات عضو ({state.productIds.length})</Label>
            <div className="max-h-48 overflow-y-auto rounded-xl border border-line divide-y divide-line">
              {products.map((p) => {
                const on = state.productIds.includes(p.id);
                return (
                  <label key={p.id} className="flex items-center gap-3 px-3 py-2 text-sm cursor-pointer hover:bg-cream/60">
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() =>
                        setState({
                          ...state,
                          productIds: on ? state.productIds.filter((x) => x !== p.id) : [...state.productIds, p.id],
                        })
                      }
                      className="accent-[var(--color-terracotta)]"
                    />
                    {p.name}
                  </label>
                );
              })}
            </div>
          </div>
          <div className="space-y-2">
            <Label>ترتیب نمایش</Label>
            <Input inputMode="numeric" value={state.sortOrder} onChange={(e) => setState({ ...state, sortOrder: e.target.value })} className="rounded-xl tabular-nums w-28" />
          </div>
        </div>
        <DialogFooter className="flex-row-reverse gap-2">
          <Button onClick={save} disabled={pending} className="rounded-xl">
            {pending ? "در حال ذخیره…" : "ذخیره"}
          </Button>
          <Button variant="outline" onClick={() => setOpen(false)} className="rounded-xl">
            انصراف
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function CollectionDeleteButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      title="حذف"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const res = await deleteCollectionAction({ id });
          if (res.ok) {
            toast.success("کالکشن حذف شد.");
            router.refresh();
          } else {
            toast.error(res.error.message);
          }
        })
      }
      className="size-8 rounded-lg hover:bg-red-50 text-red-500 flex items-center justify-center"
    >
      <Trash2 className="size-4" />
    </button>
  );
}

/** پیش‌نمایش کوچک تصویر — ردیف لیست */
export function TinyImage({ src }: { src: string | null }) {
  if (!src) return <span className="size-10 rounded-xl bg-sand-soft inline-block" />;
  return (
    <span className="size-10 rounded-xl bg-sand-soft inline-block relative overflow-hidden">
      <Image src={src} alt="" fill className="object-cover" sizes="40px" />
    </span>
  );
}
