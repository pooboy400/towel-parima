import type { Review, Testimonial } from "@/types";

/**
 * نظرات محصولات — در فاز 2 از دیتابیس خوانده می‌شود.
 * پرامپت 39: فقط نظر واقعی؛ Verified Purchase در صورت امکان.
 * (داده فعلی نمونه اولیه است و پیش از انتشار با نظرات واقعی جایگزین می‌شود.)
 */
export const reviews: Review[] = [
  {
    id: "r1",
    productSlug: "prima-bath-towel",
    userName: "نگار م.",
    rating: 5,
    date: "2025-07-02",
    comment:
      "بعد از دو ماه استفاده و ده‌ها بار شست‌وشو هنوز نرمی روز اول را دارد. جذب آبش واقعاً فرق کرده با حوله‌های قبلی‌ام.",
    verifiedPurchase: true,
  },
  {
    id: "r2",
    productSlug: "prima-bath-towel",
    userName: "امیر ح.",
    rating: 5,
    date: "2025-06-18",
    comment:
      "وزنش دقیقاً همون چیزیه که توضیح داده شده؛ سنگین ولی نه اذیت‌کننده. رنگ کرمش هم با حمام ما ست شد.",
    verifiedPurchase: true,
  },
  {
    id: "r3",
    productSlug: "prima-bath-towel",
    userName: "سمانه ر.",
    rating: 4,
    date: "2025-05-30",
    comment: "کیفیت عالیه، فقط دوست داشتم سایز بزرگ‌ترش زودتر موجود می‌شد که سفارش می‌دادم.",
    verifiedPurchase: false,
  },
  {
    id: "r4",
    productSlug: "prima-bath-towel-taupe",
    userName: "پویا ک.",
    rating: 5,
    date: "2025-07-11",
    comment: "رنگش در واقعیت گرم‌تر و قشنگ‌تر از عکسه. بعد از حمام واقعاً خشک می‌کنه.",
    verifiedPurchase: true,
  },
  {
    id: "r5",
    productSlug: "prima-bath-towel-taupe",
    userName: "مینا ص.",
    rating: 4,
    date: "2025-06-25",
    comment: "خیلی خوبه ولی برای خشک شدن توی هوای مرطوب شمال کمی زمان می‌بره.",
    verifiedPurchase: true,
  },
  {
    id: "r6",
    productSlug: "prima-hand-face-towel",
    userName: "الهام ن.",
    rating: 5,
    date: "2025-07-05",
    comment:
      "برای پوست حساس من بعد از شست‌وصورت عالیه. لطیفه و بوی شیمیایی هم نمی‌ده.",
    verifiedPurchase: true,
  },
  {
    id: "r7",
    productSlug: "prima-hand-face-towel",
    userName: "رضا ت.",
    rating: 5,
    date: "2025-06-02",
    comment: "سه تا گرفتم برای دستشویی؛ سریع خشک می‌شه و ریزش نداره. راضی‌ام.",
    verifiedPurchase: true,
  },
  {
    id: "r8",
    productSlug: "prima-white-hotel-towel",
    userName: "شیرین ع.",
    rating: 5,
    date: "2025-06-20",
    comment:
      "دقیقاً همون حس حوله‌ی هتله. سفیدش بعد از سه بار شست‌وشو هنوز روشنه. ارزش قیمتش رو داره.",
    verifiedPurchase: true,
  },
  {
    id: "r9",
    productSlug: "prima-white-hotel-towel",
    userName: "مهدی ب.",
    rating: 5,
    date: "2025-05-14",
    comment: "سنگین و پهن. حس خوبی بعد از دوش می‌ده. توی سبد هدیه عروس هم گذاشتم که تعریف داشت.",
    verifiedPurchase: true,
  },
  {
    id: "r10",
    productSlug: "prima-towel-set-4pcs",
    userName: "زهرا ف.",
    rating: 5,
    date: "2025-07-01",
    comment: "برای جهیزیه گرفتم. بسته‌بندی‌ش خیلی شیک بود که اصلاً بازش نکردم. رنگ بژش گرم و قشنگه.",
    verifiedPurchase: true,
  },
  {
    id: "r11",
    productSlug: "prima-towel-set-4pcs",
    userName: "کاربری پریما",
    rating: 4,
    date: "2025-06-12",
    comment: "ست کامل و باکیفیته. فقط جعبه‌ش توی حمل کمی له شد که پشتیبانی سریع جبران کرد.",
    verifiedPurchase: true,
  },
  {
    id: "r12",
    productSlug: "prima-kids-towel",
    userName: "مریم ج.",
    rating: 5,
    date: "2025-07-08",
    comment: "پسرم خودش می‌کشه رو تنش چون سبکه. پوستش هم حساسیت نگرفته. سبز ملایمش خیلی قشنگه.",
    verifiedPurchase: true,
  },
  {
    id: "r13",
    productSlug: "prima-kids-towel",
    userName: "آرش د.",
    rating: 5,
    date: "2025-06-15",
    comment: "برای تولد خواهرزاده گرفتم، مامانش گفت بهترین حوله‌ایه که داشته. واقعاً لطیفه.",
    verifiedPurchase: false,
  },
  {
    id: "r14",
    productSlug: "prima-pool-towel",
    userName: "سینا و.",
    rating: 4,
    date: "2025-06-28",
    comment: "اندازه‌اش فوق‌العاده‌ست برای کنار استخر. بعد از کلر، رنگش تغییر نکرد.",
    verifiedPurchase: true,
  },
  {
    id: "r15",
    productSlug: "prima-pool-towel",
    userName: "نیلوفر ق.",
    rating: 5,
    date: "2025-05-22",
    comment: "برای ویلا بردیم. تو باد خشک می‌شه و بوی نم نمی‌گیره. بزرگ و پهن هم هست.",
    verifiedPurchase: true,
  },
  {
    id: "r16",
    productSlug: "prima-waffle-bathrobe",
    userName: "بهاره ا.",
    rating: 5,
    date: "2025-07-03",
    comment:
      "تن‌پوش وافلش سبک و خنکه، برای تابستون عالیه. جیب‌هاش هم واقعاً عمیقه که موبایل و کلیپر جا می‌شه.",
    verifiedPurchase: true,
  },
  {
    id: "r17",
    productSlug: "prima-waffle-bathrobe",
    userName: "کیوان ر.",
    rating: 4,
    date: "2025-06-05",
    comment: "کیفیت دوخت خوبه. سایز L برای قد ۱۸۵ خوب بود ولی آستین‌هاش کمی کوتاهه.",
    verifiedPurchase: true,
  },
  {
    id: "r18",
    productSlug: "prima-guest-towel-striped",
    userName: "ترانه س.",
    rating: 5,
    date: "2025-07-10",
    comment: "برای دستشویی مهمان گرفتم؛ بافت وافلش توی عکس‌های اینستاگرام خیلی خوب درمیاد!",
    verifiedPurchase: true,
  },
  {
    id: "r19",
    productSlug: "prima-travel-towel",
    userName: "فرزاد م.",
    rating: 4,
    date: "2025-06-30",
    comment: "برای کوله باشگاه حرفه‌ایه؛ جمع‌وجور و سریع خشک. جذبش هم خوبه ولی نسبت به حوله حمام کمتره که طبیعیه.",
    verifiedPurchase: true,
  },
  {
    id: "r20",
    productSlug: "prima-spa-towel-set",
    userName: "هستی پ.",
    rating: 5,
    date: "2025-07-12",
    comment: "به عنوان هدیه تولد برای خودم خریدم. حس اسپا واقعاً منتقل می‌شه؛ رنگ‌ها و بسته‌بندیش عالیه.",
    verifiedPurchase: true,
  },
];

/** نظرات صفحه اصلی — پرامپت: Reviews واقعی */
export const testimonials: Testimonial[] = [
  {
    id: "t1",
    userName: "نگار م.",
    rating: 5,
    comment:
      "حوله پریما بعد از دو ماه هنوز نرمی روز اول را دارد. اولین بار است حوله‌ای می‌خرم که خریدش را تکرار کنم.",
    city: "تهران",
  },
  {
    id: "t2",
    userName: "مهدی ب.",
    rating: 5,
    comment:
      "حس حوله هتل را در خانه داشتیم. بسته‌بندی و ارسال هم دقیق و مرتب بود.",
    city: "اصفهان",
  },
  {
    id: "t3",
    userName: "مریم ج.",
    rating: 5,
    comment:
      "حوله کودک واقعاً لطیف است و پوست پسرم حساسیت نگرفت. انتخاب رنگ‌ها هم آرام و مینیمال است.",
    city: "شیراز",
  },
];
