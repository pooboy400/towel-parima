/**
 * Domain Models — تنظیمات فروشگاه (بخش ۱۸ سند معماری)
 * ---------------------------------------------------------------
 * UI هرگز JSON خام نمی‌بیند؛ خواندن فقط از طریق SettingsService.getStoreSettings()
 * که خروجی را با اسکیمای Zod سخت‌گیرانه (strict) اعتبارسنجی می‌کند.
 */

export interface StoreSettings {
  store: {
    name: string;
    phone: string;
    email: string;
    instagram: string;
    aboutSummary: string;
  };
  shipping: {
    /** هزینه ارسال ثابت — IRT Integer */
    flatFee: number;
    /** آستانه ارسال رایگان — IRT Integer */
    freeThreshold: number;
    /** تخمین روزهای تحویل */
    estimatedDays: number;
    /** بازه مرجوعی — روز */
    returnWindowDays: number;
  };
  social: {
    instagram: string;
    telegram?: string;
    whatsapp?: string;
  };
  seo: {
    titleSuffix: string;
    defaultDescription: string;
    ogImage: string;
  };
  payment: {
    /** `zarinpal` · `zibal` · … — انتخاب Adapter */
    provider: string;
    /** پنجره پرداخت = TTL رزرو — دقیقه (پیش‌فرض ۲۰) */
    windowMinutes: number;
  };
  notifications: {
    smsEnabled: boolean;
    emailEnabled: boolean;
    /** شماره ادمین برای نوتیف سفارش جدید */
    adminPhone: string;
  };
}

/** کلید رکورد Setting در دیتابیس */
export const STORE_SETTINGS_KEY = "store";
