"use client";

/**
 * SettingsForms — تنظیمات فروشگاه: تماس، ارسال، نظرات صفحه اول (M2)
 */

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SectionCard } from "@/components/admin/page-header";
import {
  updateStoreConfigAction,
  updateShippingAction,
  updateTestimonialsAction,
  updateHomeFeaturedAction,
  updateBadgeRulesAction,
} from "./actions";

type StoreConfig = {
  brandName: string;
  brandNameEn: string;
  currencyLabel: string;
  freeShippingThreshold: number;
  standardShippingCost: number;
  expressShippingCost: number;
  contact: { phone: string; email: string; address: string; workingHours: string; instagram: string };
};

type BadgeRules = {
  newDays: number;
  bestsellerMinSales: number;
  bestsellerWindowDays: number;
  limitedMaxStock: number;
};

function num(v: string) {
  return Number(v.replace(/[^\d]/g, "")) || 0;
}

export function SettingsForms({ config, shippingJson, testimonialsJson, collections, featured, badgeRules }: {
  config: StoreConfig;
  shippingJson: Record<string, unknown> | null;
  testimonialsJson: Record<string, unknown> | null;
  collections: { slug: string; name: string }[];
  featured: { featuredCollectionSlug: string; headline?: string };
  badgeRules: BadgeRules;
}) {
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<StoreConfig>(config);
  const [shippingText, setShippingText] = useState(
    shippingJson ? JSON.stringify(shippingJson, null, 2) : "{\n  \"returnWindowDays\": 7,\n  \"exchangeWindowDays\": 14\n}",
  );
  const [testimonialsText, setTestimonialsText] = useState(
    testimonialsJson ? JSON.stringify(testimonialsJson, null, 2) : "{\n  \"items\": []\n}",
  );
  const [featuredSlug, setFeaturedSlug] = useState(featured.featuredCollectionSlug);
  const [featuredHeadline, setFeaturedHeadline] = useState(featured.headline ?? "حس اسپا، در خانه خودتان");
  const [rules, setRules] = useState<BadgeRules>(badgeRules);

  function saveConfig() {
    startTransition(async () => {
      const res = await updateStoreConfigAction(state);
      if (res.ok) toast.success("اطلاعات فروشگاه ذخیره شد.");
      else toast.error(res.error.message);
    });
  }

  function saveShipping() {
    startTransition(async () => {
      try {
        const parsed = JSON.parse(shippingText);
        const res = await updateShippingAction(parsed);
        if (res.ok) toast.success("تنظیمات ارسال ذخیره شد.");
        else toast.error(res.error.message);
      } catch {
        toast.error("JSON ارسال معتبر نیست.");
      }
    });
  }

  function saveTestimonials() {
    startTransition(async () => {
      try {
        const parsed = JSON.parse(testimonialsText);
        const res = await updateTestimonialsAction(parsed);
        if (res.ok) toast.success("نظرات صفحه اصلی ذخیره شد.");
        else toast.error(res.error.message);
      } catch {
        toast.error("JSON نظرات معتبر نیست.");
      }
    });
  }

  function saveFeatured() {
    startTransition(async () => {
      const res = await updateHomeFeaturedAction({
        featuredCollectionSlug: featuredSlug,
        headline: featuredHeadline,
      });
      if (res.ok) toast.success("کالکشن ویژهٔ صفحهٔ اصلی ذخیره شد.");
      else toast.error(res.error.message);
    });
  }

  function saveBadgeRules() {
    startTransition(async () => {
      const res = await updateBadgeRulesAction(rules);
      if (res.ok) toast.success("قوانین برچسب‌های خودکار ذخیره شد.");
      else toast.error(res.error.message);
    });
  }

  const set = (patch: Partial<StoreConfig>) => setState({ ...state, ...patch });
  const setRule = (patch: Partial<BadgeRules>) => setRules({ ...rules, ...patch });

  return (
    <div className="space-y-6">
      <SectionCard title="اطلاعات فروشگاه" description="نام برند، اطلاعات تماس و هزینه ارسال">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>نام فارسی</Label>
            <Input value={state.brandName} onChange={(e) => set({ brandName: e.target.value })} className="rounded-xl" />
          </div>
          <div className="space-y-2">
            <Label>نام انگلیسی</Label>
            <Input dir="ltr" value={state.brandNameEn} onChange={(e) => set({ brandNameEn: e.target.value })} className="rounded-xl text-left" />
          </div>
          <div className="space-y-2">
            <Label>واحد پول</Label>
            <Input value={state.currencyLabel} onChange={(e) => set({ currencyLabel: e.target.value })} className="rounded-xl" />
          </div>
          <div className="space-y-2">
            <Label>سقف ارسال رایگان (تومان)</Label>
            <Input inputMode="numeric" value={String(state.freeShippingThreshold)} onChange={(e) => set({ freeShippingThreshold: num(e.target.value) })} className="rounded-xl tabular-nums" />
          </div>
          <div className="space-y-2">
            <Label>هزینه ارسال عادی (تومان)</Label>
            <Input inputMode="numeric" value={String(state.standardShippingCost)} onChange={(e) => set({ standardShippingCost: num(e.target.value) })} className="rounded-xl tabular-nums" />
          </div>
          <div className="space-y-2">
            <Label>هزینه ارسال اکسپرس (تومان)</Label>
            <Input inputMode="numeric" value={String(state.expressShippingCost)} onChange={(e) => set({ expressShippingCost: num(e.target.value) })} className="rounded-xl tabular-nums" />
          </div>
          <div className="space-y-2">
            <Label>تلفن تماس</Label>
            <Input value={state.contact.phone} onChange={(e) => set({ contact: { ...state.contact, phone: e.target.value } })} className="rounded-xl" />
          </div>
          <div className="space-y-2">
            <Label>ایمیل تماس</Label>
            <Input dir="ltr" value={state.contact.email} onChange={(e) => set({ contact: { ...state.contact, email: e.target.value } })} className="rounded-xl text-left" />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>آدرس</Label>
            <Input value={state.contact.address} onChange={(e) => set({ contact: { ...state.contact, address: e.target.value } })} className="rounded-xl" />
          </div>
          <div className="space-y-2">
            <Label>ساعات کاری</Label>
            <Input value={state.contact.workingHours} onChange={(e) => set({ contact: { ...state.contact, workingHours: e.target.value } })} className="rounded-xl" />
          </div>
          <div className="space-y-2">
            <Label>اینستاگرام (URL کامل)</Label>
            <Input dir="ltr" value={state.contact.instagram} onChange={(e) => set({ contact: { ...state.contact, instagram: e.target.value } })} className="rounded-xl text-left" />
          </div>
        </div>
        <div className="mt-5">
          <Button onClick={saveConfig} disabled={pending} className="rounded-xl">
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            ذخیره اطلاعات فروشگاه
          </Button>
        </div>
      </SectionCard>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="قوانین ارسال و مرجوعی" description="JSON ساختاریافته — پس از ذخیره بلافاصله اعمال می‌شود">
          <Textarea dir="ltr" value={shippingText} onChange={(e) => setShippingText(e.target.value)} className="font-mono text-xs min-h-40 rounded-xl text-left" />
          <Button onClick={saveShipping} disabled={pending} variant="outline" className="rounded-xl mt-4">
            <Save className="size-4" />
            ذخیره ارسال
          </Button>
        </SectionCard>

        <SectionCard title="نظرات صفحه اول" description="تستیمونیال‌ها — JSON آرایه items">
          <Textarea dir="ltr" value={testimonialsText} onChange={(e) => setTestimonialsText(e.target.value)} className="font-mono text-xs min-h-40 rounded-xl text-left" />
          <Button onClick={saveTestimonials} disabled={pending} variant="outline" className="rounded-xl mt-4">
            <Save className="size-4" />
            ذخیره نظرات
          </Button>
        </SectionCard>
      </div>

      <SectionCard title="کالکشن ویژهٔ صفحهٔ اصلی" description="کدام کالکشن در بنر بزرگ خانه نمایش داده شود — به‌جای اسلاگ ثابت در کد">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>کالکشن</Label>
            <select
              value={featuredSlug}
              onChange={(e) => setFeaturedSlug(e.target.value)}
              className="h-10 w-full rounded-xl border border-input bg-surface px-3 text-sm outline-none focus-visible:border-ring"
            >
              {collections.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label>تیتر بنر</Label>
            <Input value={featuredHeadline} onChange={(e) => setFeaturedHeadline(e.target.value)} className="rounded-xl" />
          </div>
        </div>
        <Button onClick={saveFeatured} disabled={pending} variant="outline" className="rounded-xl mt-4">
          <Save className="size-4" />
          ذخیره کالکشن ویژه
        </Button>
      </SectionCard>

      <SectionCard
        title="قوانین برچسب‌های خودکار"
        description="سیستم از روی این قوانین و دادهٔ واقعی، برچسب‌ها را خودش می‌زند — بدون دخالت دستی"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>«جدید» — حداکثر عمر محصول (روز)</Label>
            <Input
              inputMode="numeric"
              value={String(rules.newDays)}
              onChange={(e) => setRule({ newDays: num(e.target.value) })}
              className="rounded-xl tabular-nums"
            />
            <p className="text-xs text-stone-muted">محصول کمتر از این تعداد روز از افزودن گذشته باشد، برچسب «جدید» می‌گیرد.</p>
          </div>
          <div className="space-y-2">
            <Label>«پرفروش» — حداقل فروش (عدد)</Label>
            <Input
              inputMode="numeric"
              value={String(rules.bestsellerMinSales)}
              onChange={(e) => setRule({ bestsellerMinSales: num(e.target.value) })}
              className="rounded-xl tabular-nums"
            />
            <p className="text-xs text-stone-muted">فقط سفارش‌های پرداخت‌شده شمرده می‌شوند؛ مرجوع کامل حساب نمی‌شود.</p>
          </div>
          <div className="space-y-2">
            <Label>«پرفروش» — پنجرهٔ شمارش (روز)</Label>
            <Input
              inputMode="numeric"
              value={String(rules.bestsellerWindowDays)}
              onChange={(e) => setRule({ bestsellerWindowDays: num(e.target.value) })}
              className="rounded-xl tabular-nums"
            />
            <p className="text-xs text-stone-muted">فروش این تعداد روز اخیر ملاک است، نه کل تاریخ فروشگاه.</p>
          </div>
          <div className="space-y-2">
            <Label>«محدود» — سقف موجودی (عدد)</Label>
            <Input
              inputMode="numeric"
              value={String(rules.limitedMaxStock)}
              onChange={(e) => setRule({ limitedMaxStock: num(e.target.value) })}
              className="rounded-xl tabular-nums"
            />
            <p className="text-xs text-stone-muted">موجودی آزاد محصول به این عدد یا کمتر رسیده باشد، برچسب «محدود» می‌گیرد.</p>
          </div>
        </div>
        <Button onClick={saveBadgeRules} disabled={pending} variant="outline" className="rounded-xl mt-4">
          <Save className="size-4" />
          ذخیره قوانین برچسب‌ها
        </Button>
      </SectionCard>
    </div>
  );
}
