import { describe, expect, it } from "bun:test";
import {
  availableOf,
  canReserve,
  isReservationExpired,
  reservationExpiry,
  RESERVATION_TTL_MS,
} from "../../src/domain/policies/inventory";
import { isWithinReturnWindow } from "../../src/domain/policies/returns";
import { productInvalidationTags, CACHE_TAGS } from "../../src/core/cache";
import { STORE_SETTINGS_KEY, type StoreSettings } from "../../src/domain/models/settings";
import { toShippingSnapshot } from "../../src/domain/models/account";

describe("Inventory policy — بخش ۱۳ سند", () => {
  it("available = stock − reserved", () => {
    expect(availableOf({ stock: 10, reserved: 3 })).toBe(7);
    expect(availableOf({ stock: 5, reserved: 5 })).toBe(0);
  });

  it("رزرو تا سقف available مجاز است", () => {
    expect(
      canReserve({ stock: 10, reserved: 3, isActive: true }, 7),
    ).toBe("OK");
    expect(
      canReserve({ stock: 10, reserved: 3, isActive: true }, 8),
    ).toBe("OUT_OF_STOCK");
  });

  it("واریانت غیرفعال/حذف‌شده رزرو نمی‌شود", () => {
    expect(canReserve({ stock: 10, reserved: 0, isActive: false }, 1)).toBe("INACTIVE");
    expect(
      canReserve({ stock: 10, reserved: 0, isActive: true, deletedAt: new Date() }, 1),
    ).toBe("INACTIVE");
  });

  it("qty نامعتبر رزرو نمی‌شود", () => {
    expect(canReserve({ stock: 10, reserved: 0, isActive: true }, 0)).toBe("OUT_OF_STOCK");
    expect(canReserve({ stock: 10, reserved: 0, isActive: true }, 1.5)).toBe("OUT_OF_STOCK");
  });

  it("TTL رزرو = ۲۰ دقیقه", () => {
    expect(RESERVATION_TTL_MS).toBe(20 * 60_000);
    const now = new Date("2026-01-01T12:00:00Z");
    expect(reservationExpiry(now).toISOString()).toBe("2026-01-01T12:20:00.000Z");
    expect(isReservationExpired(new Date("2026-01-01T12:19:59Z"), new Date("2026-01-01T12:20:00Z"))).toBe(true);
    expect(isReservationExpired(new Date("2026-01-01T12:20:01Z"), new Date("2026-01-01T12:20:00Z"))).toBe(false);
  });
});

describe("Return window", () => {
  it("داخل بازه مجاز، بیرون آن ممنوع", () => {
    const delivered = new Date("2026-01-01T00:00:00Z");
    expect(
      isWithinReturnWindow({
        deliveredAt: delivered,
        requestedAt: new Date("2026-01-08T00:00:00Z"),
        returnWindowDays: 7,
      }),
    ).toBe(true);
    expect(
      isWithinReturnWindow({
        deliveredAt: delivered,
        requestedAt: new Date("2026-01-08T00:00:01Z"),
        returnWindowDays: 7,
      }),
    ).toBe(false);
    expect(
      isWithinReturnWindow({
        deliveredAt: delivered,
        requestedAt: new Date("2025-12-31T00:00:00Z"), // قبل از تحویل!
        returnWindowDays: 7,
      }),
    ).toBe(false);
  });
});

describe("Cache tags — بخش ۱۶.۱ سند", () => {
  it("invalidation محصول گروه کامل تگ‌ها را می‌دهد", () => {
    const tags = productInvalidationTags("p1", {
      categorySlug: "bath",
      onHomepage: true,
      collections: ["lux"],
    });
    expect(tags).toContain("product:p1");
    expect(tags).toContain("products");
    expect(tags).toContain("category:bath");
    expect(tags).toContain("collection:lux");
    expect(tags).toContain("homepage");
    expect(new Set(tags).size).toBe(tags.length);
  });

  it("تگ‌های پایه", () => {
    expect(CACHE_TAGS.homepage).toBe("homepage");
    expect(CACHE_TAGS.settings).toBe("settings");
    expect(CACHE_TAGS.journalPost("x")).toBe("journal:x");
  });
});

describe("Settings + Snapshot helpers", () => {
  it("کلید تنظیمات فروشگاه", () => {
    expect(STORE_SETTINGS_KEY).toBe("store");
  });

  it("toShippingSnapshot آدرس زنده را به snapshot تبدیل می‌کند", () => {
    const snap = toShippingSnapshot(
      {
        id: "a1",
        userId: "u1",
        fullName: "علی رضایی",
        phone: "09121234567",
        province: "تهران",
        city: "تهران",
        postalCode: "1234567890",
        line: "خیابان ولیعصر، پلاک ۱",
        isDefault: true,
      },
      "زنگ دوم",
    );
    expect(snap).toEqual({
      fullName: "علی رضایی",
      phone: "09121234567",
      province: "تهران",
      city: "تهران",
      postalCode: "1234567890",
      line: "خیابان ولیعصر، پلاک ۱",
      note: "زنگ دوم",
    });
    // snapshot هیچ اشاره‌ای به id/isDefault ندارد — مستقل از رکورد زنده
    expect("id" in snap).toBe(false);
    expect("isDefault" in snap).toBe(false);
  });

  it("شکل StoreSettings با سند (بخش ۱۸) هم‌خوان است", () => {
    // تایپ‌چک کامپایل‌تایم — نمونه کامل برای اطمینان runtime
    const s: StoreSettings = {
      store: { name: "پریما", phone: "02112345678", email: "hi@prima.ir", instagram: "prima", aboutSummary: "…" },
      shipping: { flatFee: 45000, freeThreshold: 800000, estimatedDays: 3, returnWindowDays: 7 },
      social: { instagram: "prima" },
      seo: { titleSuffix: "پریما", defaultDescription: "…", ogImage: "/og.png" },
      payment: { provider: "zarinpal", windowMinutes: 20 },
      notifications: { smsEnabled: true, emailEnabled: false, adminPhone: "09121234567" },
    };
    expect(s.shipping.returnWindowDays).toBe(7);
  });
});
