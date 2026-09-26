import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Toaster } from "sonner";
import "./globals.css";
import { SiteHeader } from "@/components/layout/site-header";
import { Footer } from "@/components/layout/footer";
import { CartDrawer } from "@/components/cart/cart-drawer";
import { CartSync } from "@/components/cart/cart-sync";
import { JsonLd, organizationSchema, websiteSchema } from "@/components/seo/json-ld";
import { getStoreSettingsSafe } from "@/services/settings-service";
import { storeConfig as defaultConfig } from "@/lib/config";

const vazirmatn = localFont({
  src: [
    { path: "../fonts/Vazirmatn-Regular.woff2", weight: "400", style: "normal" },
    { path: "../fonts/Vazirmatn-Medium.woff2", weight: "500", style: "normal" },
    { path: "../fonts/Vazirmatn-SemiBold.woff2", weight: "600", style: "normal" },
    { path: "../fonts/Vazirmatn-Bold.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-vazirmatn",
  display: "swap",
});

/**
 * SEO-03 (فاز ۵) — تصمیم ADR دربارهٔ preload فونت:
 * next/font/local فونت‌ها را self-host و با display:swap سرو می‌کند
 * (بدون FOIT و بدون رندر-بلاک). preload دستی URLهای هش‌دار build را
 * می‌شکند (hash بین dev/prod عوض می‌شود) — لذا اعمال نشد؛ اگر روزی
 * measurement نشان داد LCP فونت‌محور است، از next/font preload داخلی
 * در build production استفاده می‌شود نه URL هاردکد.
 */

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://prima-towel.ir",
  ),
  title: {
    default: `${defaultConfig.brandName} | حوله‌های باکیفیت و پریمیوم`,
    template: `%s | ${defaultConfig.brandName}`,
  },
  description:
    "خرید حوله‌های باکیفیت برای حمام، استخر، هدیه و استفاده روزمره. حوله‌هایی با تمرکز بر کیفیت، نرمی و تجربه‌ای که هر روز لمس می‌کنید.",
  keywords: [
    "حوله",
    "حوله حمام",
    "حوله پریمیوم",
    "ست حوله",
    "تن‌پوش",
    "حوله کودک",
    "خرید حوله",
  ],
  openGraph: {
    title: `${defaultConfig.brandName} | حوله‌های باکیفیت و پریمیوم`,
    description:
      "حوله‌هایی با تمرکز بر کیفیت، نرمی و تجربه‌ای که هر روز لمس می‌کنید.",
    siteName: defaultConfig.brandName,
    locale: "fa_IR",
    type: "website",
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#F8F6F2",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // تنظیمات زنده از دیتابیس (cache-tag شده) — سبد خرید/فوتر همیشه هم‌جهت با ادمین
  const { config } = await getStoreSettingsSafe();

  return (
    <html lang="fa" dir="rtl" data-scroll-behavior="smooth" suppressHydrationWarning>
      <body
        className={`${vazirmatn.variable} flex min-h-screen flex-col bg-background font-sans text-foreground antialiased`}
      >
        <CartSync />
        <JsonLd
          data={[
            organizationSchema(
              process.env.NEXT_PUBLIC_SITE_URL ?? "https://prima-towel.ir",
            ),
            websiteSchema(
              process.env.NEXT_PUBLIC_SITE_URL ?? "https://prima-towel.ir",
            ),
          ]}
        />
        <SiteHeader />
        <main className="flex-1">{children}</main>
        <Footer />
        <CartDrawer
          shippingRates={{
            freeShippingThreshold: config.freeShippingThreshold,
            standardShippingCost: config.standardShippingCost,
            expressShippingCost: config.expressShippingCost,
          }}
        />
        {/* UX-07 (فاز ۴): از پایین-وسط (روی دکمهٔ ارسال می‌نشست) به بالا-چپ */}
        <Toaster
          position="top-left"
          dir="rtl"
          toastOptions={{
            style: {
              fontFamily: "var(--font-vazirmatn)",
              borderRadius: "0.75rem",
            },
          }}
        />
      </body>
    </html>
  );
}
