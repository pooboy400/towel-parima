/** ابزارهای قالب‌بندی سبک برای UI ادمین — client-safe */

/** «۱۲ دقیقه پیش» — برای فید اعلان‌ها */
export function formatRelativeFa(iso: string, now = new Date()): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const diffMs = now.getTime() - t;
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "همین حالا";
  if (minutes < 60) return `${minutes} دقیقه پیش`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ساعت پیش`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} روز پیش`;
  return new Intl.DateTimeFormat("fa-IR", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(t));
}

/** حجم خوانا: ۱.۲ مگابایت / ۸۴۰ کیلوبایت */
export function formatBytesFa(bytes: number): string {
  if (bytes < 1024) return `${bytes} بایت`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 0 }).format(kb)} کیلوبایت`;
  const mb = kb / 1024;
  return `${new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 1 }).format(mb)} مگابایت`;
}
