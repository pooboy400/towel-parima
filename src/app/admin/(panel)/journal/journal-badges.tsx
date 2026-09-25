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
