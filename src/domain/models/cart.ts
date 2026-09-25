/**
 * Domain Models — سبد خرید و فیلترها
 * ---------------------------------------------------------------
 * قراردادهای فاز ۱ عیناً حفظ شده‌اند (بخش ۲۶ سند معماری).
 */

export interface CartLine {
  /** شناسه یکتای خط سبد = productId + رنگ + سایز */
  lineId: string;
  productId: string;
  slug: string;
  name: string;
  image: string;
  colorName?: string;
  colorHex?: string;
  sizeLabel?: string;
  price: number;
  compareAtPrice?: number;
  quantity: number;
  maxStock: number;
}

export type ShippingMethod = "standard" | "express";

export interface AddressFormValues {
  firstName: string;
  lastName: string;
  phone: string;
  province: string;
  city: string;
  postalCode: string;
  address: string;
  note?: string;
}

export interface OrderSummaryTotals {
  subtotal: number;
  discount: number;
  shipping: number;
  total: number;
}

export type SortOption =
  | "popular"
  | "newest"
  | "price-asc"
  | "price-desc"
  | "rating";

export interface ProductFilters {
  category?: string;
  collection?: string;
  colors?: string[];
  sizes?: string[];
  priceFrom?: number;
  priceTo?: number;
  minRating?: number;
  onlyAvailable?: boolean;
  sort?: SortOption;
  query?: string;
}

/* ------------------------------------------------------------------ */
/* Store Config — قابل‌تنظیم، بدون hard-code                            */
/* ------------------------------------------------------------------ */

export interface StoreConfig {
  brandName: string;
  brandNameEn: string;
  currencyLabel: string;
  /** آستانه ارسال رایگان به تومان */
  freeShippingThreshold: number;
  /** هزینه ارسال عادی به تومان */
  standardShippingCost: number;
  expressShippingCost: number;
  contact: {
    phone: string;
    email: string;
    address: string;
    workingHours: string;
    instagram: string;
  };
}
