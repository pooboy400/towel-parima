/**
 * تست اداپتور زرین‌پال سندباکس — رفتار با merchant جعلی
 * انتظار: خطای ساختاریافتهٔ فارسی (کد -10 مرچنت نامعتبر) یا عدم دسترسی شبکه — هرگز crash
 */
import { ZarinpalPaymentProvider } from "../src/providers/payment/zarinpal";

async function main() {
  const p = new ZarinpalPaymentProvider({
    merchantId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
    sandbox: true,
  });
  console.log("sandbox:", p.sandbox, "| resumeUrl:", p.buildResumeUrl("TEST-AUTH"));

  try {
    const res = await p.startPayment({
      orderCode: "0000000000",
      amountIrt: 100_000,
      callbackUrl: "http://localhost:3000/checkout/callback",
      description: "تست M5",
    });
    console.log("پاسخ:", JSON.stringify(res));
  } catch (err) {
    console.log(
      "خطای ساختاریافته (انتظار می‌رفت):",
      err instanceof Error ? err.message : String(err),
    );
  }
}

main();
