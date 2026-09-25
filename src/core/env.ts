/**
 * env.ts — فلگ‌های ایمن runtime
 * ---------------------------------------------------------------
 * ALLOW_MOCKS_IN_PRODUCTION=1
 *   به‌طور صریح اجازه فعال‌بودن providerهای mock (پرداخت/پیامک) را در
 *   بیلد production می‌دهد — فقط برای محیط‌های دمو/staging که درگاه
 *   واقعی ندارند. پیش‌فرض (خالی یا هر مقدار دیگری) = قفل کامل، حتی
 *   اگر اشتباهاً در سرور واقعی ست شود.
 *   ⚠️ هرگز در سرور production واقعی با کاربر و پرداخت واقعی ست نکنید.
 */

export function allowMocksInProduction(): boolean {
  return process.env.ALLOW_MOCKS_IN_PRODUCTION === "1";
}
