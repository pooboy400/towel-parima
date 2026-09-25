import { describe, expect, it } from "bun:test";
import {
  buildSearchKey,
  normalizeFaDigits,
  normalizePersian,
  tokenizePersian,
} from "../../src/domain/text/normalize-fa";

describe("normalizePersian — بخش ۱۷ سند معماری", () => {
  it("ي و ك عربی به فارسی تبدیل می‌شود", () => {
    expect(normalizePersian("ايس")).toBe("ایس");
    expect(normalizePersian("كوله")).toBe("کوله");
  });

  it("ارقام فارسی و عربی به لاتین تبدیل می‌شوند", () => {
    expect(normalizePersian("حوله ۷۰×۱۴۰")).toBe("حوله 70×140");
    expect(normalizePersian("كد ٤٥٦")).toBe("کد 456");
  });

  it("نیم‌فاصله به فاصله تبدیل می‌شود", () => {
    expect(normalizePersian("لحاف‌دوزی")).toBe("لحاف دوزی");
    expect(normalizePersian("لحاف\u200Bدوزی")).toBe("لحاف دوزی");
  });

  it("فاصله‌های تکراری فشرده و trim می‌شوند", () => {
    expect(normalizePersian("  حوله   پرمو  ")).toBe("حوله پرمو");
    expect(normalizePersian("a\u00A0\u00A0b")).toBe("a b");
  });

  it("لاتین lowercase می‌شود", () => {
    expect(normalizePersian("Prima Towel")).toBe("prima towel");
  });

  it("ترکیبی: عربی + رقم فارسی + نیم‌فاصله همزمان", () => {
    expect(normalizePersian("س‌ت کــــیت")).toBe("س ت کــــیت");
  });

  it("رشته خالی و بدون ورودی امن است", () => {
    expect(normalizePersian("")).toBe("");
    expect(normalizePersian("   ")).toBe("");
  });
});

describe("normalizeFaDigits — فقط ارقام", () => {
  it("حروف دست‌نخورده می‌مانند", () => {
    expect(normalizeFaDigits("۰۹۱۲abc٠٣")).toBe("0912abc03");
  });
});

describe("tokenizePersian", () => {
  it("توکن‌های تمیز برمی‌گرداند", () => {
    expect(tokenizePersian("حوله‌ی پرمو primo")).toEqual(["حوله", "ی", "پرمو", "primo"]);
  });

  it("ورودی خالی → آرایه خالی", () => {
    expect(tokenizePersian("")).toEqual([]);
  });
});

describe("buildSearchKey — تطبیق substring", () => {
  it("نیم‌فاصله و فاصله یکسان می‌شوند", () => {
    expect(buildSearchKey("لحاف‌دوزی")).toBe(buildSearchKey("لحاف دوزی"));
    expect(buildSearchKey("كوله پشتی ۲")).toBe("کولهپشتی2");
  });
});
