"use client";

/** Badge وضعیت مقاله + فرم ایجاد/ویرایش مقاله (client) */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MediaPicker } from "@/components/admin/media-picker";
import {
  upsertJournalAction,
  deleteJournalAction,
} from "./actions";

export function JournalStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    PUBLISHED: "bg-emerald-50 text-sage",
    DRAFT: "bg-sand-soft text-terracotta-deep",
    ARCHIVED: "bg-gray-100 text-stone-muted",
  };
  const labels: Record<string, string> = { PUBLISHED: "منتشرشده", DRAFT: "پیش‌نویس", ARCHIVED: "آرشیو" };
  return (
    <span className={`rounded-lg px-2.5 py-1 text-[11px] font-bold ${styles[status] ?? styles.DRAFT}`}>
      {labels[status] ?? status}
    </span>
  );
}

export interface JournalFormInitial {
  id?: string;
  title: string;
  slug: string;
  excerpt: string;
  bodyMarkdown: string;
  coverKey: string;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
}

export function JournalForm({ initial }: { initial: JournalFormInitial }) {
  const router = useRouter();
  const isEdit = Boolean(initial.id);
  const [state, setState] = useState(initial);
  const [pending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      const res = await upsertJournalAction(state);
      if (res.ok) {
        toast.success(isEdit ? "مقاله به‌روزرسانی شد." : "مقاله ساخته شد.");
        router.push("/admin/journal");
        router.refresh();
      } else {
        toast.error(res.error.message);
      }
    });
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>عنوان *</Label>
          <Input value={state.title} onChange={(e) => setState({ ...state, title: e.target.value })} className="rounded-xl" />
        </div>
        <div className="space-y-2">
          <Label>اسلاگ *</Label>
          <Input dir="ltr" value={state.slug} onChange={(e) => setState({ ...state, slug: e.target.value })} className="rounded-xl text-left" />
        </div>
      </div>

      <div className="space-y-2">
        <Label>خلاصه *</Label>
        <Textarea value={state.excerpt} onChange={(e) => setState({ ...state, excerpt: e.target.value })} className="rounded-xl min-h-16" maxLength={500} />
      </div>

      <div className="space-y-2">
        <Label>متن مقاله (Markdown — پاراگراف‌ها را با خط خالی جدا کنید) *</Label>
        <Textarea
          value={state.bodyMarkdown}
          onChange={(e) => setState({ ...state, bodyMarkdown: e.target.value })}
          className="rounded-xl min-h-72 font-mono text-sm"
          dir="rtl"
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-2 items-start">
        <div className="space-y-2">
          <Label>تصویر شاخص</Label>
          <MediaPicker value={state.coverKey ? [state.coverKey] : []} onChange={(next) => setState({ ...state, coverKey: next.at(-1) ?? "" })} max={1} />
        </div>
        <div className="space-y-2">
          <Label>وضعیت</Label>
          <select
            value={state.status}
            onChange={(e) => setState({ ...state, status: e.target.value as typeof state.status })}
            className="w-full rounded-xl border border-input bg-surface px-3 py-2 text-sm"
          >
            <option value="DRAFT">پیش‌نویس</option>
            <option value="PUBLISHED">منتشر شود</option>
            <option value="ARCHIVED">آرشیو</option>
          </select>
        </div>
      </div>

      <div className="flex items-center gap-3 pt-2">
        <Button onClick={save} disabled={pending} className="rounded-xl h-11 px-6 font-semibold">
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          ذخیره
        </Button>
        {isEdit && (
          <Button
            variant="outline"
            disabled={pending}
            className="rounded-xl text-red-600 border-red-200 hover:bg-red-50"
            onClick={() => {
              if (!confirm("این مقاله کاملاً حذف شود؟")) return;
              startTransition(async () => {
                const res = await deleteJournalAction({ id: state.id! });
                if (res.ok) {
                  toast.success("مقاله حذف شد.");
                  router.push("/admin/journal");
                  router.refresh();
                } else {
                  toast.error(res.error.message);
                }
              });
            }}
          >
            <Trash2 className="size-4" />
            حذف مقاله
          </Button>
        )}
      </div>
    </div>
  );
}
