"use client";

/**
 * ProductRowActions — اقدام‌های ردیف جدول محصولات: تغییر سریع وضعیت + حذف
 * این UI است؛ امنیت هر اقدام در خود اکشن با requirePermission است (§2.2).
 */

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Archive, PackageCheck, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { deleteProductAction, setProductStatusAction } from "./actions";

export function StatusBadge({ status }: { status: "DRAFT" | "ACTIVE" | "ARCHIVED" }) {
  const styles = {
    ACTIVE: "bg-emerald-50 text-sage",
    DRAFT: "bg-sand-soft text-terracotta-deep",
    ARCHIVED: "bg-gray-100 text-stone-muted",
  } as const;
  const labels = { ACTIVE: "فعال", DRAFT: "پیش‌نویس", ARCHIVED: "آرشیو" } as const;
  return (
    <span className={`rounded-lg px-2.5 py-1 text-[11px] font-bold ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}

export function ProductRowActions({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function changeStatus(next: "DRAFT" | "ACTIVE" | "ARCHIVED") {
    startTransition(async () => {
      const res = await setProductStatusAction({ id, status: next });
      if (res.ok) {
        toast.success("وضعیت محصول عوض شد.");
        router.refresh();
      } else {
        toast.error(res.error.message);
      }
    });
  }

  return (
    <div className="flex items-center gap-1 justify-end">
      {status !== "ACTIVE" && (
        <button
          type="button"
          title="فعال‌سازی"
          disabled={pending}
          onClick={() => changeStatus("ACTIVE")}
          className="size-8 rounded-lg hover:bg-emerald-50 text-sage flex items-center justify-center"
        >
          <PackageCheck className="size-4" />
        </button>
      )}
      {status !== "ARCHIVED" && (
        <button
          type="button"
          title="آرشیو"
          disabled={pending}
          onClick={() => changeStatus("ARCHIVED")}
          className="size-8 rounded-lg hover:bg-sand-soft text-stone-muted flex items-center justify-center"
        >
          <Archive className="size-4" />
        </button>
      )}

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <button
            type="button"
            title="حذف"
            disabled={pending}
            className="size-8 rounded-lg hover:bg-red-50 text-red-500 flex items-center justify-center"
          >
            <Trash2 className="size-4" />
          </button>
        </AlertDialogTrigger>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>حذف محصول؟</AlertDialogTitle>
            <AlertDialogDescription>
              محصول از فروشگاه حذف می‌شود (حذف نرم — سفارش‌های آینده از آن استفاده نکنند). این کار
              در دفتر رویدادها ثبت می‌شود.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row-reverse gap-2">
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={(e) => {
                e.preventDefault();
                startTransition(async () => {
                  const res = await deleteProductAction({ id });
                  if (res.ok) {
                    toast.success("محصول حذف شد.");
                    router.refresh();
                  } else {
                    toast.error(res.error.message);
                  }
                });
              }}
            >
              حذف قطعی
            </AlertDialogAction>
            <AlertDialogCancel>انصراف</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
