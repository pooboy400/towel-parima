import { describe, expect, test } from "bun:test";
import {
  storeConfigSchema,
  testimonialSchema,
} from "@/domain/schemas/settings";
import { storeConfig } from "@/lib/config";

describe("settings-service — اعتبارسنجی مرز خواندن (بخش ۱۸ سند)", () => {
  test("storeConfig سید‌شده از schema عبور می‌کند", () => {
    const parsed = storeConfigSchema.safeParse(storeConfig);
    expect(parsed.success).toBe(true);
  });

  test("ایمیل/URL نامعتبر رد می‌شود", () => {
    const bad = {
      ...storeConfig,
      contact: { ...storeConfig.contact, email: "not-an-email" },
    };
    expect(storeConfigSchema.safeParse(bad).success).toBe(false);
  });

  test("مبالغ منفی رد می‌شوند (IRT Integer — بخش ۱۲ سند)", () => {
    const bad = { ...storeConfig, freeShippingThreshold: -1 };
    expect(storeConfigSchema.safeParse(bad).success).toBe(false);
  });

  test("امتیاز تستیمونیال خارج از 1..5 رد می‌شود", () => {
    expect(
      testimonialSchema.safeParse({
        id: "t1",
        userName: "x",
        rating: 6,
        comment: "c",
        city: "تهران",
      }).success,
    ).toBe(false);
  });
});
