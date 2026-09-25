"use client";

/**
 * FaqManager + ReviewsModerator + SettingsForms — محتوای تعاملی پنل (client)
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Pencil, Plus, Star, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { upsertFaqAction, deleteFaqAction, moderateReviewAction } from "../settings/actions";

/* ------------------------------------------------------------------ */
/* FAQ                                                                 */
/* ------------------------------------------------------------------ */

interface FaqRow {
  id: string;
  question: string;
  answer: string;
  sortOrder: number;
}

export function FaqManager({ items }: { items: FaqRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState<FaqRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ question: "", answer: "", sortOrder: "0" });

  function openCreate() {
    setForm({ question: "", answer: "", sortOrder: String(items.length) });
    setCreating(true);
    setEditing(null);
  }

  function openEdit(item: FaqRow) {
    setForm({ question: item.question, answer: item.answer, sortOrder: String(item.sortOrder) });
    setEditing(item);
    setCreating(false);
  }

  function save() {
    startTransition(async () => {
      const payload = {
        ...(editing ? { id: editing.id } : {}),
        question: form.question,
        answer: form.answer,
        sortOrder: Number(form.sortOrder) || 0,
      };
      const res = await upsertFaqAction(payload);
      if (res.ok) {
        toast.success("ذخیره شد.");
        setEditing(null);
        setCreating(false);
        router.refresh();
      } else {
        toast.error(res.error.message);
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog
          open={creating || Boolean(editing)}
          onOpenChange={(o) => {
            if (!o) {
              setCreating(false);
              setEditing(null);
            }
          }}
        >
          <DialogTrigger asChild>
            <Button className="rounded-xl" onClick={openCreate}>
              <Plus className="size-4" />
              سوال جدید
            </Button>
          </DialogTrigger>
          <DialogContent dir="rtl" className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editing ? "ویرایش سوال" : "سوال جدید"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>سوال *</Label>
                <Input value={form.question} onChange={(e) => setForm({ ...form, question: e.target.value })} className="rounded-xl" />
              </div>
              <div className="space-y-2">
                <Label>پاسخ *</Label>
                <Textarea value={form.answer} onChange={(e) => setForm({ ...form, answer: e.target.value })} className="rounded-xl min-h-28" />
              </div>
              <div className="space-y-2">
                <Label>ترتیب</Label>
                <Input inputMode="numeric" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: e.target.value })} className="rounded-xl w-28 tabular-nums" />
              </div>
            </div>
            <DialogFooter className="flex-row-reverse gap-2">
              <Button onClick={save} disabled={pending} className="rounded-xl">
                {pending ? "…" : "ذخیره"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="bg-surface rounded-2xl border border-line divide-y divide-line">
        {items.map((item) => (
          <div key={item.id} className="p-4 flex items-start gap-4">
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm">{item.question}</p>
              <p className="text-sm text-stone-muted mt-1 line-clamp-2">{item.answer}</p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                title="ویرایش"
                onClick={() => openEdit(item)}
                className="size-8 rounded-lg hover:bg-sand-soft flex items-center justify-center"
              >
                <Pencil className="size-4" />
              </button>
              <button
                type="button"
                title="حذف"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    const res = await deleteFaqAction({ id: item.id });
                    if (res.ok) {
                      toast.success("حذف شد.");
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
            </div>
          </div>
        ))}
        {items.length === 0 && (
          <p className="p-10 text-center text-sm text-stone-muted">سوالی ثبت نشده است.</p>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* نظرات — تأیید/رد                                                    */
/* ------------------------------------------------------------------ */

export interface ReviewRow {
  id: string;
  authorName: string;
  rating: number;
  body: string;
  status: string;
  createdAt: string;
  productName: string;
}

export function ReviewsModerator({ items }: { items: ReviewRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function decide(id: string, decision: "APPROVED" | "REJECTED") {
    startTransition(async () => {
      const res = await moderateReviewAction({ id, decision });
      if (res.ok) {
        toast.success(decision === "APPROVED" ? "نظر تأیید شد." : "نظر رد شد.");
        router.refresh();
      } else {
        toast.error(res.error.message);
      }
    });
  }

  if (items.length === 0) {
    return (
      <p className="p-10 text-center text-sm text-stone-muted bg-surface rounded-2xl border border-line">
        نظری در انتظار بررسی نیست — انباز سبز 👌
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {items.map((r) => (
        <div key={r.id} className="bg-surface rounded-2xl border border-line p-5">
          <div className="flex items-center gap-3 mb-2">
            <span className="size-9 rounded-xl bg-sand-soft text-terracotta-deep flex items-center justify-center text-sm font-bold">
              {r.authorName.slice(0, 1)}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">{r.authorName}</p>
              <p className="text-xs text-stone-muted">{r.productName}</p>
            </div>
            <span className="flex items-center gap-0.5 text-amber-500" aria-label={`${r.rating} ستاره`}>
              {Array.from({ length: 5 }, (_, i) => (
                <Star key={i} className={`size-3.5 ${i < r.rating ? "fill-current" : "opacity-25"}`} />
              ))}
            </span>
          </div>
          <p className="text-sm text-ink/80 leading-relaxed mb-4">{r.body}</p>
          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={pending}
              onClick={() => decide(r.id, "APPROVED")}
              className="rounded-xl bg-sage hover:bg-sage/90"
            >
              <Check className="size-4" />
              تأیید و انتشار
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => decide(r.id, "REJECTED")}
              className="rounded-xl text-red-600 border-red-200 hover:bg-red-50"
            >
              <X className="size-4" />
              رد
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
