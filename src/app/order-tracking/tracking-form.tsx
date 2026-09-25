"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * فرم پیگیری — ریدایرکت به همان صفحه با ?code= (Server-rendered نتیجه).
 */
export function TrackingForm({ initialCode }: { initialCode: string }) {
  const router = useRouter();
  const [code, setCode] = useState(initialCode);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const clean = code.trim();
        if (!clean) return;
        router.push(`/order-tracking?code=${encodeURIComponent(clean)}`);
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
      <Button type="submit" variant="terracotta" size="lg" className="w-full">
        <Search aria-hidden />
        پیگیری
      </Button>
    </form>
  );
}
