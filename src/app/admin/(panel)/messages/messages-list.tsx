"use client";

/**
 * MessagesList — جدول سادهٔ پیام‌های تماس + مشترکان خبرنامه
 * با اکشن‌های «خوانده شد» و «حذف» (هر دو server action با audit).
 */

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Check, Trash2, Mail, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/admin/page-header";
import { faDigits, formatDate } from "@/lib/format";
import { markMessageReadAction, deleteMessageAction } from "./actions";

interface MessageRow {
  id: string;
  kind: string; // CONTACT | NEWSLETTER
  email: string;
  name: string | null;
  phone: string | null;
  subject: string | null;
  message: string | null;
  status: string; // NEW | READ
  createdAt: string;
}

export function MessagesList({ items }: { items: MessageRow[] }) {
  const [pending, startTransition] = useTransition();
  const [rows, setRows] = useState(items);

  function markRead(id: string) {
    startTransition(async () => {
      const res = await markMessageReadAction(id);
      if (res.ok) {
        setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status: "READ" } : r)));
        toast.success("خوانده‌شده شد.");
      } else {
        toast.error(res.error.message);
      }
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      const res = await deleteMessageAction(id);
      if (res.ok) {
        setRows((prev) => prev.filter((r) => r.id !== id));
        toast.success("حذف شد.");
      } else {
        toast.error(res.error.message);
      }
    });
  }

  if (rows.length === 0) {
    return (
      <SectionCard title="بدون پیام" description="هنوز پیامی ثبت نشده است">
        <p className="text-sm text-muted-foreground">
          پیام‌های فرم تماس و عضویت‌های خبرنامه به‌محض ثبت همین‌جا نمایش داده می‌شوند.
        </p>
      </SectionCard>
    );
  }

  return (
    <div className="space-y-3">
      {rows.map((m) => (
        <div
          key={m.id}
          className={`rounded-xl border bg-surface p-4 ${
            m.status === "NEW" ? "border-terracotta/40" : "border-line"
          }`}
        >
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium ${
                m.kind === "NEWSLETTER"
                  ? "bg-secondary text-deep"
                  : "bg-terracotta/10 text-terracotta-deep"
              }`}
            >
              {m.kind === "NEWSLETTER" ? (
                <>
                  <Mail className="size-3" aria-hidden /> خبرنامه
                </>
              ) : (
                <>
                  <User className="size-3" aria-hidden /> تماس
                </>
              )}
            </span>
            {m.status === "NEW" && (
              <span className="rounded-full bg-terracotta px-2 py-0.5 font-medium text-white">
                جدید
              </span>
            )}
            <span>{faDigits(formatDate(m.createdAt))}</span>
          </div>

          <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="text-sm font-semibold">{m.name ?? "— عضو خبرنامه —"}</span>
            <span dir="ltr" className="text-[13px] text-muted-foreground">
              {m.email}
            </span>
            {m.phone && (
              <span dir="ltr" className="text-[13px] text-muted-foreground">
                {faDigits(m.phone)}
              </span>
            )}
          </div>

          {m.subject && (
            <p className="mt-1.5 text-[13px] font-medium">موضوع: {m.subject}</p>
          )}
          {m.message && (
            <p className="mt-1.5 text-[13px] leading-6 text-muted-foreground whitespace-pre-line">
              {m.message}
            </p>
          )}

          <div className="mt-3 flex gap-2">
            {m.status === "NEW" && (
              <Button size="sm" variant="outline" disabled={pending} onClick={() => markRead(m.id)} className="rounded-xl">
                <Check className="size-3.5" />
                خوانده شد
              </Button>
            )}
            <Button size="sm" variant="ghost" disabled={pending} onClick={() => remove(m.id)} className="rounded-xl text-destructive hover:text-destructive">
              <Trash2 className="size-3.5" />
              حذف
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
