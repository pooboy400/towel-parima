import type { Category, Collection, ColorOption, ProductSize } from "@/types";

/* ------------------------------------------------------------------ */
/* دسته‌بندی‌ها — پرامپت 26                                            */
/* ------------------------------------------------------------------ */

export const categories: Category[] = [
  {
    id: "c1",
    slug: "bath-towels",
    name: "حوله حمام",
    description:
      "حوله‌های حمام با بافت متراکم و جذب بالا؛ همراه هر روز شما بعد از یک دوش گرم.",
    seoText:
      "انتخاب حوله حمام مناسب به وزن (GSM)، جنس الیاف و تراکم بافت بستگی دارد. حوله‌های ۵۰۰ به بالا وزن، جذب‌آبی بیشتر و حس لطافت عمیق‌تری دارند و برای استفاده روزمره از حمام خانه ایده‌آل هستند.",
    image: "/images/cat-bath.jpg",
  },
  {
    id: "c2",
    slug: "hand-face",
    name: "دست و صورت",
    description:
      "حوله‌های دست و صورت لطیف برای پوست حساس؛ سبک، سریع‌الخشک و مناسب سرویس حمام.",
    seoText:
      "حوله دست و صورت به دلیل تماس مستقیم با پوست صورت باید از الیاف نرم و ظریف بافته شده باشد؛ وزن سبک‌تر (۴۰۰ تا ۵۰۰ GSM) باعث خشک‌شدن سریع‌تر و بهداشت بهتر می‌شود.",
    image: "/images/cat-hand.jpg",
  },
  {
    id: "c3",
    slug: "pool",
    name: "استخری",
    description:
      "حوله‌های استخری بزرگ و خوش‌دوام با رنگ‌های روشن؛ برای استخر، ساحل و باشگاه.",
    seoText:
      "حوله استخری باید ابعاد بزرگ، وزن متعادل و مقاومت بالا در برابر کلر و نور آفتاب داشته باشد؛ الیاف حلقه‌ای متراکم، آب را سریع جذب می‌کنند و پس از شست‌وشو فرم خود را حفظ می‌کنند.",
    image: "/images/cat-pool.jpg",
  },
  {
    id: "c4",
    slug: "bathrobes",
    name: "تن‌پوش",
    description:
      "تن‌پوش‌های وافل و پارچه‌ای سبک؛ حس یک اسپای خانگی بعد از حمام یا استخر.",
    seoText:
      "تن‌پوش بافت وافل به دلیل ساختار مشبک خود سبک است و رطوبت را سریع تبخیر می‌کند؛ گزینه‌ای مینیمال و سریع‌الخشک برای بعد از استخر و حمام.",
    image: "/images/cat-robe.jpg",
  },
  {
    id: "c5",
    slug: "kids",
    name: "کودک",
    description:
      "حوله‌های کودک با الیاف ضدحساسیت و رنگ‌های ملایم؛ لطیف روی پوست نوزاد و کودک.",
    seoText:
      "پوست کودک نازک‌تر و حساس‌تر از بزرگسالان است؛ حوله کودک باید از الیاف طبیعی بدون مواد شیمیایی، با بافت لطیف و وزن سبک انتخاب شود.",
    image: "/images/cat-kids.jpg",
  },
  {
    id: "c6",
    slug: "sets",
    name: "ست‌ها",
    description:
      "ست‌های هماهنگ حوله برای سرویس کامل حمام؛ انتخابی هوشمند برای خانه جدید و جهیزیه.",
    seoText:
      "خرید ست کامل حوله علاوه بر هماهنگی رنگی، اقتصادی‌تر از خرید تک‌به‌تک است؛ یک ست استاندارد شامل حوله حمام، حوله دست و توالت‌کاغذی‌پوش یا حوله صورت است.",
    image: "/images/cat-sets.jpg",
  },
];

/* ------------------------------------------------------------------ */
/* کالکشن‌ها — پرامپت 20                                              */
/* ------------------------------------------------------------------ */

export const collections: Collection[] = [
  {
    id: "col1",
    slug: "premium",
    name: "پریمیوم",
    description: "انتخاب برتر با بالاترین وزن و لطافت برای تجربه‌ای حسی‌تر.",
    image: "/images/lifestyle-shelf.jpg",
  },
  {
    id: "col2",
    slug: "everyday",
    name: "روزمره",
    description: "حوله‌های کاربردی و باکیفیت برای مصرف روزانه خانواده.",
    image: "/images/lifestyle-warm.jpg",
  },
  {
    id: "col3",
    slug: "spa",
    name: "اسپا",
    description: "حس اسپا در خانه؛ بافت‌های لطیف و رنگ‌های آرام.",
    image: "/images/lifestyle-spa.jpg",
  },
  {
    id: "col4",
    slug: "gift",
    name: "هدیه",
    description: "بسته‌بندی خاص برای هدیه‌هایی که لمس‌شان می‌شود.",
    image: "/images/cat-gift.jpg",
  },
  {
    id: "col5",
    slug: "seasonal",
    name: "فصلی",
    description: "انتخاب‌های محدود برای فصل‌های خاص سال.",
    image: "/images/lifestyle-beach.jpg",
  },
];

/* ------------------------------------------------------------------ */
/* رنگ‌ها و سایزهای مشترک                                             */
/* ------------------------------------------------------------------ */

export const colors = {
  cream: { id: "cream", name: "کرم", hex: "#F5F0E6" } satisfies ColorOption,
  white: { id: "white", name: "سفید", hex: "#FAFAF7" } satisfies ColorOption,
  beige: { id: "beige", name: "بژ", hex: "#D9CBB6" } satisfies ColorOption,
  sand: { id: "sand", name: "شنی", hex: "#C3A98C" } satisfies ColorOption,
  taupe: { id: "taupe", name: "خاکستری گرم", hex: "#A69B8D" } satisfies ColorOption,
  stone: { id: "stone", name: "سنگی", hex: "#8C8A85" } satisfies ColorOption,
  mint: { id: "mint", name: "سبز ملایم", hex: "#C9DCD0" } satisfies ColorOption,
  sage: { id: "sage", name: "سبز مریم‌گلی", hex: "#9DB4A5" } satisfies ColorOption,
  clay: { id: "clay", name: "گلی", hex: "#C88F72" } satisfies ColorOption,
};

export const sizes = {
  bath: { id: "bath", label: "حمام", dimensions: "70 × 140", gsm: 550 } satisfies ProductSize,
  bathLarge: { id: "bath-large", label: "حمام بزرگ", dimensions: "90 × 150", gsm: 600 } satisfies ProductSize,
  hand: { id: "hand", label: "دست و صورت", dimensions: "35 × 75", gsm: 500 } satisfies ProductSize,
  handSmall: { id: "hand-small", label: "صورت", dimensions: "30 × 30", gsm: 480 } satisfies ProductSize,
  pool: { id: "pool", label: "استخری", dimensions: "90 × 180", gsm: 450 } satisfies ProductSize,
  guest: { id: "guest", label: "مهمان", dimensions: "40 × 60", gsm: 450 } satisfies ProductSize,
  kids: { id: "kids", label: "کودک", dimensions: "60 × 120", gsm: 420 } satisfies ProductSize,
  travel: { id: "travel", label: "مسافرتی", dimensions: "50 × 90", gsm: 400 } satisfies ProductSize,
};
