/**
 * Allowed Origins — INFRA-06 (فاز ۶)
 * ---------------------------------------------------------------
 * فهرست سفید مبدأ Server Actions/POST — منبع یگانه برای next.config.ts و proxy.ts.
 * در دیپلوی واقعی متغیر SERVER_ACTIONS_ALLOWED_ORIGINS ست می‌شود
 * (مثلاً "prima-store.ir,https://www.prima-store.ir") و wildcard سندباکس
 * دیگر استفاده نمی‌شود — ریسک جعل Origin بین‌زیردامنه‌ای صفر.
 */

export function allowedOrigins(): string[] {
  const fromEnv = process.env.SERVER_ACTIONS_ALLOWED_ORIGINS;
  if (fromEnv) {
    const list = fromEnv
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (list.length > 0) return list;
  }
  // سندباکس پیش‌نمایش (پیش‌فرض dev) — INFRA-06: در دیپلوی واقعی با env جایگزین شود
  return ["*.space-z.ai"];
}

/** تطبیق مبدأ: تساوی دقیق یا wildcard زیردامنه (مثال: *.example.com) */
export function isAllowedOrigin(originHost: string, host: string): boolean {
  if (originHost === host) return true;
  for (const pattern of allowedOrigins()) {
    if (pattern.startsWith("*.")) {
      const suffix = pattern.slice(1); // ".example.com"
      if (
        originHost.endsWith(suffix) &&
        (host === pattern.slice(2) || host.endsWith(suffix))
      ) {
        return true;
      }
    }
  }
  return false;
}
