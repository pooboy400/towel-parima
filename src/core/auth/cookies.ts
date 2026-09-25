/**
 * نام کوکی‌های session — ماژول مستقل بدون وابستگی سرور
 * ---------------------------------------------------------------
 * کوکی ادمین از مشتری جداست (بخش ۹.۳ سند) تا idle-timeout و revocation
 * مستقل ممکن باشد. Middleware (edge runtime) هم از همین ماژول import می‌کند —
 * بنابراین این فایل نباید هیچ وابستگی node/server-only پیدا کند.
 */

export const CUSTOMER_SESSION_COOKIE = "prima_session";
export const ADMIN_SESSION_COOKIE = "prima_admin_session";

/** حداقل طول توکن session — برای گارد ارزان مسیر (لایه اول) */
export const MIN_SESSION_TOKEN_LENGTH = 32;
