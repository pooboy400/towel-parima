import { ZarinpalPaymentProvider } from "../src/providers/payment/zarinpal";

async function main() {
  const p = new ZarinpalPaymentProvider({
    merchantId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
    sandbox: true,
  });
  const v = await p.verifyPayment({
    authority: "S00000000000000000000000000000er6z38",
    amountIrt: 100_000,
  });
  console.log("verify:", JSON.stringify(v));

  const r = await p.refundPayment({ transactionId: "123456", amountIrt: 50_000 });
  console.log("refund:", JSON.stringify(r));
}

main();
