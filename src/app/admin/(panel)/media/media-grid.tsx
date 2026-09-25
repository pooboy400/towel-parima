"use client";

/**
 * MediaGrid — کتابخانه رسانه با آپلود/حذف و صفحه‌بندی بی‌نهایت سبک (M2)
 */

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { ImageOff, Loader2, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { uploadMediaAction, deleteMediaAction } from "./actions";
import { formatBytesFa } from "@/lib/admin/format-utils";

interface LibraryItem {
  id: string;
  url: string;
  thumbUrl: string;
  mime: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  createdAt: string;
}

export function MediaGrid() {
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
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
      setTotal(j.data.total);
    } catch {
      toast.error("خواندن کتابخانه ناموفق بود.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(1);
  }, [load]);

  function upload(file: File) {
    setUploading(true);
    void (async () => {
      const fd = new FormData();
      fd.set("file", file);
      const res = await uploadMediaAction(fd);
      if (res.ok) {
        toast.success(
          res.data.deduped
            ? "این تصویر قبلاً آپلود شده بود (نسخه موجود استفاده شد)."
            : "آپلود انجام شد — تبدیل به WebP موفق.",
        );
        void load(1);
      } else {
        toast.error(res.error.message);
      }
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    })();
  }

  return (
    <div>
      {/* نوار آپلود */}
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const f = e.dataTransfer.files?.[0];
          if (f) upload(f);
        }}
        className="rounded-2xl border-2 border-dashed border-line bg-surface p-8 text-center mb-6"
      >
        <UploadCloud className="size-10 mx-auto text-stone-muted mb-3" />
        <p className="text-sm text-stone-muted mb-4">
          فایل تصویر را اینجا بکشید — JPG، PNG، GIF، AVIF تا ۵ مگابایت (تبدیل خودکار به WebP)
        </p>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) upload(f);
          }}
        />
        <Button
          type="button"
          disabled={uploading}
          onClick={() => fileRef.current?.click()}
          className="rounded-xl"
        >
          {uploading ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              در حال پردازش…
            </>
          ) : (
            "انتخاب فایل"
          )}
        </Button>
      </div>

      <p className="text-xs text-stone-muted mb-4">{formatBytesFa(0) && `${total} تصویر در کتابخانه`}</p>

      {/* گرید */}
      {loading && items.length === 0 ? (
        <div className="py-16 text-center text-stone-muted">
          <Loader2 className="size-6 animate-spin mx-auto" />
        </div>
      ) : items.length === 0 ? (
        <div className="py-16 text-center text-stone-muted">
          <ImageOff className="size-8 mx-auto mb-2 opacity-40" />
          کتابخانه خالی است.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {items.map((item) => (
            <div
              key={item.id}
              className="group relative aspect-square rounded-2xl overflow-hidden border border-line bg-cream"
            >
              <Image
                src={item.thumbUrl || item.url}
                alt=""
                fill
                className="object-cover"
                sizes="(max-width:640px) 50vw, 20vw"
              />
              <div className="absolute inset-x-0 bottom-0 bg-ink/70 text-white text-[10px] px-2 py-1 flex justify-between opacity-0 group-hover:opacity-100 transition-opacity">
                <span>
                  {item.width}×{item.height}
                </span>
                <span>{formatBytesFa(item.sizeBytes)}</span>
              </div>
              <button
                type="button"
                title="حذف"
                onClick={() =>
                  void (async () => {
                    const res = await deleteMediaAction({ id: item.id });
                    if (res.ok) {
                      toast.success("تصویر حذف شد.");
                      setItems((prev) => prev.filter((x) => x.id !== item.id));
                      setTotal((t) => Math.max(0, t - 1));
                    } else {
                      toast.error(res.error.message);
                    }
                  })()
                }
                className="absolute top-2 left-2 size-8 rounded-lg bg-white/90 text-red-600 text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {page < pages && (
        <div className="text-center mt-6">
          <Button variant="outline" className="rounded-xl" disabled={loading} onClick={() => void load(page + 1)}>
            نمایش بیشتر
          </Button>
        </div>
      )}
    </div>
  );
}
