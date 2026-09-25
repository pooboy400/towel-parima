"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

/** دکمه چاپ — جزیره کلاینت داخل صفحه فاکتور */
export function PrintButton() {
  return (
    <div className="flex justify-end print:hidden">
      <Button onClick={() => window.print()} variant="outline" size="sm">
        <Printer className="me-1.5 size-4" aria-hidden />
        چاپ فاکتور
      </Button>
    </div>
  );
}
