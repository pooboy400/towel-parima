"use client";

/**
 * MediaPicker — دیالوگ انتخاب از کتابخانه + آپلود (M2)
 * استفاده در فرم محصول/دسته/کالکشن. value = آرایه URL/Key تصاویر.
 */

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, ImagePlus, Loader2, Trash2, UploadCloud, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { uploadMediaAction } from "@/app/admin/(panel)/media/actions";
import { formatBytesFa } from "@/lib/admin/format-utils";

interface LibraryItem {
  id: string;
  url: string;
  thumbUrl: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
}

export function MediaPicker({
  value,
  onChange,
  max = 10,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  max?: number;
}) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [pending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/media/list?page=${p}`, { cache: "no-store" });
      if (!res.ok) throw new Error();
      const j = await res.json();
      setItems((prev) => (p === 1 ? j.data.items : [...prev, ...j.data.items]));
      setPages(j.data.pages);
      setPage(j.data.page);
    } catch {
      toast.error("خواندن کتابخانه رسانه ناموفق بود.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) void load(1);
  }, [open, load]);

  function addFromLibrary(item: LibraryItem) {
    if (value.includes(item.url)) return;
    if (value.length >= max) {
      toast.error(`حداکثر ${max} تصویر مجاز است.`);
      return;
    }
    onChange([...value, item.url]);
  }

  function onUpload(file: File) {
    setUploading(true);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("file", file);
      const res = await uploadMediaAction(fd);
      if (res.ok) {
        toast.success(
          res.data.deduped ? "این تصویر قبلاً آپلود شده بود (از نسخه موجود استفاده شد)." : "آپلود و تبدیل به WebP انجام شد.",
        );
        onChange(value.length < max ? [...value, res.data.url] : value);
        void load(1);
      } else {
        toast.error(res.error.message);
      }
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    });
  }

  return (
    <div>
      {/* انتخاب‌شده‌ها */}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-3 mb-3">
          {value.map((url, i) => (
            <div key={url} className="relative size-24 rounded-xl overflow-hidden border border-line group">
              <Image src={url} alt="" fill className="object-cover" sizes="96px" />
              <div className="absolute inset-x-0 bottom-0 flex justify-center gap-1 p-1 bg-ink/60 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  type="button"
                  aria-label="جابه‌جایی به عقب"
                  disabled={i === 0}
                  onClick={() => {
                    const next = [...value];
                    [next[i - 1], next[i]] = [next[i], next[i - 1]];
                    onChange(next);
                  }}
                  className="text-white disabled:opacity-30"
                >
                  <ArrowUp className="size-3.5" />
                </button>
                <button
                  type="button"
                  aria-label="جابه‌جایی به جلو"
                  disabled={i === value.length - 1}
                  onClick={() => {
                    const next = [...value];
                    [next[i], next[i + 1]] = [next[i + 1], next[i]];
                    onChange(next);
                  }}
                  className="text-white disabled:opacity-30"
                >
                  <ArrowDown className="size-3.5" />
                </button>
                <button
                  type="button"
                  aria-label="حذف"
                  onClick={() => onChange(value.filter((u) => u !== url))}
                  className="text-red-300"
                >
                  <X className="size-3.5" />
                </button>
              </div>
              {i === 0 && value.length > 1 && (
                <span className="absolute top-1 right-1 rounded-md bg-terracotta text-white text-[9px] px-1.5 py-0.5 font-bold">
                  اصلی
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* دکمه باز کردن کتابخانه */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button type="button" variant="outline" className="rounded-xl border-line">
            <ImagePlus className="size-4" />
            انتخاب از کتابخانه / آپلود جدید
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>کتابخانه رسانه</DialogTitle>
            <DialogDescription>
              عکس آپلودی خودکار به WebP تبدیل می‌شود (JPG، PNG، GIF، AVIF — حداکثر ۵ مگابایت)
            </DialogDescription>
          </DialogHeader>

          {/* آپلود */}
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const f = e.dataTransfer.files?.[0];
              if (f) onUpload(f);
            }}
            className="rounded-2xl border-2 border-dashed border-line bg-cream/60 p-6 text-center mb-4"
          >
            <UploadCloud className="size-8 mx-auto text-stone-muted mb-2" />
            <p className="text-sm text-stone-muted mb-3">فایل را بکشید یا انتخاب کنید</p>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
              className="hidden"
              id="media-upload-input"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onUpload(f);
              }}
            />
            <Button
              type="button"
              variant="secondary"
              disabled={uploading || pending}
              onClick={() => fileRef.current?.click()}
              className="rounded-xl"
            >
              {uploading || pending ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  در حال پردازش…
                </>
              ) : (
                "انتخاب فایل"
              )}
            </Button>
          </div>

          {/* گرید کتابخانه */}
          {loading && items.length === 0 ? (
            <div className="py-10 text-center text-sm text-stone-muted">
              <Loader2 className="size-5 animate-spin mx-auto mb-2" />
              در حال خواندن…
            </div>
          ) : items.length === 0 ? (
            <p className="py-10 text-center text-sm text-stone-muted">
              کتابخانه خالی است — اولین تصویر را آپلود کنید.
            </p>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              {items.map((item) => {
                const selected = value.includes(item.url);
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => addFromLibrary(item)}
                    className={cn(
                      "relative aspect-square rounded-xl overflow-hidden border-2 transition-colors",
                      selected ? "border-terracotta" : "border-line hover:border-sand",
                    )}
                  >
                    <Image src={item.thumbUrl || item.url} alt="" fill className="object-cover" sizes="120px" />
                    <span className="absolute inset-x-0 bottom-0 bg-ink/60 text-white text-[9px] py-0.5 text-center">
                      {formatBytesFa(item.sizeBytes)}
                    </span>
                    {selected && (
                      <span className="absolute top-1 left-1 size-5 rounded-full bg-terracotta text-white text-[10px] font-bold flex items-center justify-center">
                        ✓
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {page < pages && (
            <div className="text-center mt-4">
              <Button type="button" variant="ghost" size="sm" disabled={loading} onClick={() => void load(page + 1)}>
                {loading ? <Loader2 className="size-4 animate-spin" /> : "نمایش بیشتر"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** حذف از کتابخانه — صفحه مدیریت رسانه */
export function MediaDeleteButton({ id, onDeleted }: { id: string; onDeleted?: () => void }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      aria-label="حذف تصویر"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const { deleteMediaAction } = await import("@/app/admin/(panel)/media/actions");
          const res = await deleteMediaAction({ id });
          if (res.ok) {
            toast.success("تصویر حذف شد.");
            onDeleted?.();
          } else {
            toast.error(res.error.message);
          }
        })
      }
      className="absolute top-2 left-2 size-8 rounded-lg bg-white/90 text-red-600 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity"
    >
      {pending ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
    </button>
  );
}
