import { MessageSquareText } from "lucide-react";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getPanelContext } from "@/core/auth/session-service";
import { PERMISSIONS } from "@/core/auth/permissions";
import { PageHeader } from "@/components/admin/page-header";
import { formatDate, faDigits } from "@/lib/format";
import { SMS_TAG_LABELS } from "@/core/async/sms-templates";
import { getPaymentGatewayInfo } from "@/providers/payment";
import { smsProvider } from "@/providers/sms";

export const dynamic = "force-dynamic";

/**
 * Admin SMS Log — شیشهٔ پشت کارت‌خوان (M5)
 * در حالت دمو هیچ پیامک واقعی به گوشی کسی نمی‌رود؛ این صفحه همان چیزی است که
 * «می‌رفت» + وضعیت رساندن هر نامه توسط نامه‌رسان (Worker).
 */
export default async function AdminSmsPage() {
  const ctx = await getPanelContext();
  if (!ctx) redirect("/admin/login");
  if (!ctx.actor.permissions.includes(PERMISSIONS.ordersRead)) redirect("/admin");

  const [logs, total] = await Promise.all([
    db.smsLog.findMany({ orderBy: { createdAt: "desc" }, take: 100 }),
    db.smsLog.count(),
  ]);

  const gateway = getPaymentGatewayInfo();
  const smsMode =
    smsProvider.name === "mock" ? "پیامک آزمایشی (ثبت در همین دفتر)" : smsProvider.name;

  return (
    <div>
      <PageHeader
        title="پیامک‌های آزمایشی"
        description={`دفتر پیامک‌های فروشگاه — ${faDigits(total)} پیامک ثبت‌شده`}
      />

      {/* بن حالت دمو — شفافیت کامل */}
      <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-[13px] leading-7 text-amber-900">
        <p className="font-bold flex items-center gap-2 mb-1">
          <MessageSquareText className="size-4" aria-hidden />
          حالت دمو (M5) — هیچ پیامک واقعی ارسال نمی‌شود
        </p>
        <p>
          این صفحه همان متنی را نشان می‌دهد که برای مشتری می‌رفت + وضعیت رساندنش.
          وقتی پیامک واقعی (کاوه‌نگار/ملی‌پیامک) وصل شود، همین دفتر پیامک‌های واقعی را نشان می‌دهد.
        </p>
        <p className="mt-1 text-amber-800">
          سرویس پیامک فعلی: <b>{smsMode}</b> · درگاه پرداخت فعلی: <b>{gateway.label}</b>
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-line bg-surface">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-line bg-cream/60 text-muted-foreground">
              <th className="px-4 py-3 text-start font-medium">زمان</th>
              <th className="px-4 py-3 text-start font-medium">گیرنده</th>
              <th className="px-4 py-3 text-start font-medium">نوع</th>
              <th className="px-4 py-3 text-start font-medium">متن پیامک</th>
              <th className="px-4 py-3 text-start font-medium">وضعیت</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id} className="border-b border-line/60 last:border-0 align-top">
                <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                  {formatDate(l.createdAt.toISOString())}
                  <span className="block text-xs text-stone-muted" dir="ltr">
                    {faDigits(new Date(l.createdAt).toLocaleTimeString("fa-IR"))}
                  </span>
                </td>
                <td className="px-4 py-3 font-mono" dir="ltr">
                  {faDigits(l.to)}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">{SMS_TAG_LABELS[l.tag] ?? l.tag}</td>
                <td className="px-4 py-3 max-w-md">
                  <span className="whitespace-pre-line leading-6 text-ink/90">{l.text}</span>
                  {l.error && <span className="mt-1 block text-xs text-destructive">{l.error}</span>}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  {l.status === "SENT" ? (
                    <span className="rounded-full bg-sage/15 px-2.5 py-1 text-xs font-medium text-sage">
                      رسید
                    </span>
                  ) : (
                    <span className="rounded-full bg-destructive/10 px-2.5 py-1 text-xs font-medium text-destructive">
                      خطا
                    </span>
                  )}
                </td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">
                  هنوز پیامکی ثبت نشده — با اولین خرید آزمایشی، پیامک‌ها اینجا ظاهر می‌شوند.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
