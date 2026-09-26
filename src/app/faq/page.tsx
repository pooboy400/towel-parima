import type { Metadata } from "next";
import { JsonLd } from "@/components/seo/json-ld";
import Link from "next/link";
import { MessageCircleQuestion } from "lucide-react";
import { getFaq } from "@/services/content-service";
import { Breadcrumb } from "@/components/navigation/breadcrumb";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export const metadata: Metadata = {
  title: "سؤالات پرتکرار",
  description:
    "پاسخ پرتکرارترین سؤالات درباره‌ی ارسال، مرجوعی، نگهداری حوله، سایز و پرداخت در پریما.",
};

export default async function FaqPage() {
  const faq = await getFaq();

  // SEO-01 (فاز ۵) — اسکیمای FAQPage با همان سؤال‌های صفحه
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };

  return (
    <div className="container-brand py-8 lg:py-10">
      <JsonLd data={faqJsonLd} />
      {/* SEO-01 — پاسخ‌ها در HTML اولیه هم هستند (خزنده بدون اجرای JS می‌بیند) */}
      <div className="sr-only" aria-hidden={false}>
        <h2>پاسخ سؤالات پرتکرار</h2>
        {faq.map((item, i) => (
          <div key={i}>
            <h3>{item.question}</h3>
            <p>{item.answer}</p>
          </div>
        ))}
      </div>
      <Breadcrumb
        items={[{ label: "خانه", href: "/" }, { label: "سؤالات پرتکرار" }]}
      />

      <header className="mt-6 max-w-xl">
        <h1 className="text-2xl font-bold sm:text-3xl">سؤالات پرتکرار</h1>
        <p className="mt-3 text-sm leading-7 text-muted-foreground">
          هر چیزی که خریداران پریما معمولاً می‌پرسند؛ از زمان ارسال تا شست‌وشوی
          حوله. اگر پاسخ‌تان این‌جا نبود، از فرم تماس بپرسید.
        </p>
      </header>

      <div className="mt-8 grid items-start gap-8 lg:mt-10 lg:grid-cols-[1fr_320px]">
        <Accordion
          type="single"
          collapsible
          className="rounded-lg border border-line bg-surface px-5 sm:px-6"
        >
          {faq.map((item, i) => (
            <AccordionItem key={i} value={`faq-${i}`}>
              <AccordionTrigger className="text-right text-[15px] font-medium leading-7 hover:no-underline">
                {item.question}
              </AccordionTrigger>
              <AccordionContent className="pb-5">
                <p className="text-sm leading-7 text-muted-foreground">
                  {item.answer}
                </p>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>

        {/* کارت کمکی */}
        <aside className="flex flex-col items-start gap-4 rounded-lg bg-secondary p-6">
          <span className="flex size-12 items-center justify-center rounded-md bg-surface">
            <MessageCircleQuestion
              className="size-5 text-terracotta-deep"
              aria-hidden
            />
          </span>
          <h2 className="text-base font-bold">پاسخ سؤالت را پیدا نکردی؟</h2>
          <p className="text-sm leading-7 text-foreground/75">
            تیم پشتیبانی ما شنبه تا پنجشنبه پاسخ‌گوی شماست؛ سؤالت را مستقیم
            برای‌مان بنویس.
          </p>
          <Button variant="terracotta" asChild>
            <Link href="/contact">تماس با پشتیبانی</Link>
          </Button>
        </aside>
      </div>
    </div>
  );
}
