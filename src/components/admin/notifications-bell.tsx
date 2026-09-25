"use client";

/**
 * NotificationsBell — زنگ اعلان‌های پنل (M2)
 * منبع اعلان: /api/admin/notifications (محاسبه زنده از دیتابیس)
 * وضعیت «دیده‌شده» سمت مرورگر نگه داشته می‌شود (localStorage) — بدون جدول اضافه.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, PackageX, MessageSquareQuote, ShieldAlert, FileEdit, Activity } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatRelativeFa } from "@/lib/admin/format-utils";

export interface AdminNotification {
  id: string;
  type: "lowStock" | "pendingReview" | "failedLogin" | "draftContent";
  title: string;
  description: string;
  href: string;
  at: string;
  severity: "warning" | "info" | "critical";
}

const SEEN_KEY = "prima_admin_seen_at";

const ICONS: Record<AdminNotification["type"], React.ComponentType<{ className?: string }>> = {
  lowStock: PackageX,
  pendingReview: MessageSquareQuote,
  failedLogin: ShieldAlert,
  draftContent: FileEdit,
};

export function NotificationsBell() {
  const [items, setItems] = useState<AdminNotification[]>([]);
  const [unseen, setUnseen] = useState(0);
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/notifications", { cache: "no-store" });
      if (!res.ok) return;
      const json = (await res.json()) as { data: AdminNotification[] };
      setItems(json.data ?? []);
      const seenAt = Number(localStorage.getItem(SEEN_KEY) ?? 0);
      setUnseen(json.data.filter((n) => new Date(n.at).getTime() > seenAt).length);
    } catch {
      // بی‌صدا — زنگ نباید رندر پنل را برهم بزند
    }
  }, []);

  useEffect(() => {
    const first = setTimeout(load, 200);
    timer.current = setInterval(load, 60_000);
    return () => {
      clearTimeout(first);
      if (timer.current) clearInterval(timer.current);
    };
  }, [load]);

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      void load();
    } else {
      localStorage.setItem(SEEN_KEY, String(Date.now()));
      setUnseen(0);
    }
  }

  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>
        <button
          className="relative size-10 rounded-xl hover:bg-sand-soft transition-colors flex items-center justify-center"
          aria-label="اعلان‌ها"
        >
          <Bell className="size-5" />
          {unseen > 0 && (
            <span className="absolute -top-0.5 -left-0.5 min-w-5 h-5 px-1 rounded-full bg-terracotta text-white text-[10px] font-bold flex items-center justify-center">
              {unseen > 9 ? "+۹" : unseen}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-96 max-h-[70vh] overflow-y-auto">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>اعلان‌ها</span>
          <span className="text-xs text-stone-muted font-normal">به‌روزرسانی هر دقیقه</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {items.length === 0 ? (
          <div className="py-10 text-center text-sm text-stone-muted">
            <Activity className="size-8 mx-auto mb-2 opacity-40" />
            همه‌چیز مرتب است — اعلان جدیدی نیست
          </div>
        ) : (
          items.map((n) => {
            const Icon = ICONS[n.type];
            return (
              <Link
                key={n.id}
                href={n.href}
                className="flex gap-3 px-3 py-3 hover:bg-sand-soft/60 rounded-xl transition-colors"
                onClick={() => onOpenChange(false)}
              >
                <span
                  className={cn(
                    "size-9 rounded-xl flex items-center justify-center shrink-0",
                    n.severity === "critical" && "bg-red-50 text-red-600",
                    n.severity === "warning" && "bg-amber-50 text-amber-600",
                    n.severity === "info" && "bg-sand-soft text-terracotta-deep",
                  )}
                >
                  <Icon className="size-4.5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold">{n.title}</span>
                  <span className="block text-xs text-stone-muted mt-0.5 line-clamp-2">
                    {n.description}
                  </span>
                  <span className="block text-[10px] text-stone-muted/70 mt-1">
                    {formatRelativeFa(n.at)}
                  </span>
                </span>
              </Link>
            );
          })
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
