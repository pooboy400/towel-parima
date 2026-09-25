import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getPanelContext } from "@/core/auth/session-service";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "ورود به پنل مدیریت | پریما",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminLoginPage() {
  // از قبل وارد شده؟ مستقیم به پنل
  const ctx = await getPanelContext();
  if (ctx) redirect("/admin");

  return (
    <div className="min-h-screen bg-cream text-ink flex">
      {/* ستون برند — دسکتاپ */}
      <aside className="hidden lg:flex w-[42%] bg-deep text-cream relative overflow-hidden flex-col justify-between p-12">
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 30%, #b7a48c 0, transparent 40%), radial-gradient(circle at 80% 70%, #c88f72 0, transparent 45%)",
          }}
        />
        <div className="relative">
          <p className="text-2xl font-bold tracking-tight">پریما</p>
          <p className="text-sand text-sm mt-1">حوله‌های لوکس پنبه ترکی</p>
        </div>

        <div className="relative space-y-6">
          <h1 className="text-3xl font-bold leading-relaxed">
            پنل مدیریت فروشگاه
            <br />
            <span className="text-sand">همه‌چیز، از یک جا.</span>
          </h1>
          <ul className="space-y-3 text-sm text-cream/80">
            <li className="flex items-center gap-3">
              <span className="size-1.5 rounded-full bg-terracotta inline-block" />
              مدیریت محصولات، موجودی و قیمت‌ها
            </li>
            <li className="flex items-center gap-3">
              <span className="size-1.5 rounded-full bg-terracotta inline-block" />
              رسانه، مجله و محتوای صفحه اصلی
            </li>
            <li className="flex items-center gap-3">
              <span className="size-1.5 rounded-full bg-terracotta inline-block" />
              دفتر رویدادها و کنترل کامل دسترسی‌ها
            </li>
          </ul>
        </div>

        <p className="relative text-xs text-cream/50">
          دسترسی به این بخش ثبت و پایش می‌شود — هر ورود موفق یا ناموفق در دفتر رویدادها ثبت می‌گردد.
        </p>
      </aside>

      {/* ستون فرم */}
      <main className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="lg:hidden mb-8 text-center">
            <p className="text-2xl font-bold">پریما</p>
            <p className="text-stone-muted text-sm mt-1">پنل مدیریت فروشگاه</p>
          </div>
          <LoginForm />
        </div>
      </main>
    </div>
  );
}
