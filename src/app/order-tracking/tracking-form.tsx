"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * فرم پیگیری (SEC-04) — کد + شمارهٔ موبایل؛ ریدایرکت به همان صفحه با
 * ?code=&phone= (نتیجه Server-rendered است).
 */
export function TrackingForm({
  initialCode,
  initialPhone,
}: {
  initialCode: string;
  initialPhone: string;
}) {
  const router = useRouter();
  const [code, setCode] = useState(initialCode);
  const [phone, setPhone] = useState(initialPhone);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const cleanCode = code.trim();
        if (!cleanCode) return;
        const cleanPhone = phone.trim();
        const params = new URLSearchParams({ code: cleanCode });
        if (cleanPhone) params.set("phone", cleanPhone);
        router.push(`/order-tracking?${params.toString()}`);
      }}
      noValidate
      className="flex flex-col gap-5"
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor="tracking-code">کد رهگیری سفارش</Label>
        <Input
          id="tracking-code"
          name="code"
          dir="ltr"
          inputMode="numeric"
          autoComplete="off"
          placeholder="مثلاً ۱۲۳۴۵۶۷۸۹۰"
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="tracking-phone">شمارهٔ موبایل سفارش</Label>
        <Input
          id="tracking-phone"
          name="phone"
          dir="ltr"
          inputMode="tel"
          autoComplete="tel"
          placeholder="مثلاً ۰۹۱۲۳۴۵۶۷۸۹"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
        <p className="text-xs leading-5 text-muted-foreground">
          همون شماره‌ای که هنگام خرید ثبت کردید — با یا بدون ۰ اول (مثل ۹۱۲…).
        </p>
      </div>
      <Button type="submit" variant="terracotta" size="lg" className="w-full">
        <Search aria-hidden />
        پیگیری
      </Button>
    </form>
  );
}
