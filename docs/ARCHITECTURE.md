# معماری پروژه پریما — Backend Architecture v2.4

> **وضعیت:** تأییدشده توسط مالک محصول · **تاریخ تصویب:** ۱۴۰۴/۰۷/۰۱ (2026-09-22) · **نسخه:** 2.4
> **دامنه:** این سند، قرارداد معماری فاز ۲ (بک‌اند، ادمین، پرداخت، داده) است و مرجع رسمی همه مایلستون‌های M0 تا M6 محسوب می‌شود.
> **قانون تغییر:** هر تغییری در این سند باید به‌صورت کامیت جداگانه با به‌روزرسانی شماره نسخه ثبت شود و در جلسه شروع هر مایلستون مرجع قرار بگیرد.

---

## فهرست مطالب

1. اصول حاکم بر معماری
2. نقشه معماری کلی و زنجیره درخواست
3. لایه‌بندی: Domain Model در برابر Prisma Model
4. دیتابیس — ERD کامل (Entityها، فیلدها، Constraintها، Indexها)
5. ماشین‌های وضعیت (State Machines)
6. RBAC — نقش‌ها، مجوزها، ماتریس دسترسی
7. Service Map
8. API / Server Action Map
9. Security Model (تهدیدها، دفاع‌ها، سیاست‌ها)
10. Transaction Boundaries
11. Idempotency
12. پول، ارز و محاسبات مالی
13. موجودی و رزرو (Inventory & Reservation)
14. Snapshot و سیاست حذف (Historical Immutability)
15. معماری Async / Event / Outbox
16. Caching Strategy
17. جستجوی فارسی
18. Settings تایپ‌شده
19. Provider Abstraction
20. Audit Log
21. مدیا و امنیت آپلود
22. Deployment Architecture
23. Testing Strategy
24. استاندارد خطاها
25. ساختار پوشه‌های هدف
26. Mapping فاز ۱ → فاز ۲
27. Roadmap نهایی M0 تا M6
28. تصمیم‌های معماری ثبت‌شده (ADR)
29. مسیرهای ارتقای آینده
30. نگهداری و نسخه‌بندی سند

---

## ۱) اصول حاکم بر معماری

این اصول قطعی‌اند و در طول پروژه تغییر نمی‌کنند مگر با تصمیم صریح مالک محصول و ثبت ADR جدید:

1. **تک‌اپ فول‌استک:** Next.js (App Router) + PostgreSQL + Prisma + Service Layer. بک‌اند جداگانه (Laravel/Django/NestJS) و Microservices ممنوع مگر دلیل فنی بسیار محکم.
2. **Server-first:** صفحات عمومی با RSC/SSR/ISR رندر می‌شوند؛ Client Component فقط برای تعامل واقعی (جزایر). فلسفه فاز ۱ حفظ می‌شود.
3. **mutation داخلی = Server Action؛ API Route فقط برای:** وب‌هوک درگاه، callback پرداخت، جستجوی سریع، health-check و هر جا که یک کلاینت غیرفرم وجود دارد.
4. **UI هرگز مرز امنیت نیست:** همه authorization در سرور و داخل Guard Layer انجام می‌شود؛ Middleware فقط محافظ مسیر است.
5. **UI فاز ۱ دست‌نخورده می‌ماند:** سوییچ به دیتابیس فقط در Service Layer اتفاق می‌افتد؛ امضای سرویس‌ها و تایپ‌های Domain تغییر رفتار به UI نمی‌دهند.
6. **سادگی Production-grade:** هر جا بین سادگی و پیچیدگی انتخاب داریم، ساده‌ترین معماری‌ای انتخاب می‌شود که نیاز واقعی Production را پوشش دهد (مثال: Outbox بدون Redis در روز اول).
7. **پول Integer است:** هیچ Float در محاسبات مالی. واحد canonical یکتاست (IRT).
8. **رکورد تاریخی immutable است:** سفارش، پرداخت، refund و audit پس از ثبت تغییرناپذیرند؛ فقط گذار وضعیتِ کنترل‌شده دارند.
9. **همه وابستگی‌های خارجی پشت Abstraction:** Payment، SMS، Email، Storage — تعویض سرویس‌دهنده نباید Business Logic را لمس کند.
10. **گیت = شبکه ایمنی:** هر مایلستون برنچ و کامیت‌های مرحله‌ای جداگانه دارد؛ امکان rollback در هر نقطه.

---

## ۲) نقشه معماری کلی و زنجیره درخواست

### ۲.۱ دیاگرام کلی

```text
┌─ Browser ────────────────────────────────────────────────────────┐
│  Storefront (RSC/SSR/ISR)      Admin /admin        Client Islands │
└───────────────┬──────────────────────────────────────────────────┘
                │ HTTPS — Caddy (TLS خودکار، HSTS)
┌─ Next.js (یک اپ — Docker standalone) ────────────────────────────┐
│                                                                  │
│  Middleware:                                                     │
│    · path-guard برای /admin (کوکی ادمین — لایه اول)              │
│    · security headers (CSP مرحله‌ای)                              │
│    · rate-limit hook برای مسیرهای حساس                           │
│                                                                  │
│  صفحات عمومی (RSC)           صفحات ادمین (RSC)                   │
│        │                          │                              │
│        ▼                          ▼                              │
│  Server Actions (mutation)    API Routes:                        │
│        │                      · POST /api/payment/callback        │
│        │                      · POST /api/webhooks/payment        │
│        │                      · GET  /api/search                  │
│        │                      · GET  /api/health                  │
│        ▼                          ▼                              │
│  ═════════ Guard Layer — مرز امنیت واقعی ════════                │
│  ۱ authenticate  →  ۲ authorize (RBAC)  →  ۳ validate (Zod)      │
│  →  ۴ business rules  →  ۵ DB Transaction  →  ۶ audit/revalidate │
│        │                                                         │
│        ▼                                                         │
│  Service Layer (منطق دامنه، قرارداد تایپ‌شده)                     │
│  ProductService · InventoryService · CheckoutService · ...       │
│        ▼                                                         │
│  Repository Layer (نگاشت Prisma ↔ Domain Model)                  │
│        ▼                                                         │
│  Prisma ──► PostgreSQL (+WAL، Backup شبانه)                      │
│        │                                                         │
│        └──► Outbox Events ──► Worker درون-پروسه‌ای                │
│                  │                                               │
│     ┌──────────┼──────────────┬────────────────┐                 │
│     ▼          ▼              ▼                ▼                 │
│  SmsProvider  EmailProvider  StorageProvider   Analytics        │
│  (Kavenegar…  (SMTP…)        (S3-compatible)   (لاگ/داشبورد)    │
│                                                                  │
│  PaymentProvider ◄── Adapter (زرین‌پال / زیبال / ...)            │
│  AuditLog — append-only برای هر mutation ادمین                   │
└──────────────────────────────────────────────────────────────────┘
```

### ۲.۲ زنجیره اجباری هر Mutation

هر Server Action و API Routeِ تغییردهنده، **بدون استثنا** این زنجیره را طی می‌کند — مستقل از UI و مستقل از اینکه فراخوانی از کدام صفحه آمده است:

```text
UI
 ↓
Server Action / API Route
 ↓
Authentication        ← هویت از session (کوکی)؛ نه از ورودی کلاینت
 ↓
Authorization         ← requirePermission(...) — RBAC
 ↓
Validation            ← Zod (اسکیمای مشترک با فرانت)
 ↓
Business Rules        ← قوانین دامنه (موجودی، سقف کوپن، گذار وضعیت…)
 ↓
DB Transaction        ← اتمیک + Outbox Event
 ↓
Service Layer
 ↓
Repository / Prisma
 ↓
Database
```

**قانون:** Zod فقط Validation است و به هیچ عنوان Authorization محسوب نمی‌شود. مخفی‌سازی دکمه/فرم در UI هم فقط UX است، نه امنیت.

---

## ۳) لایه‌بندی: Domain Model در برابر Prisma Model

UI و Business Contract هرگز به Prisma وابسته نیستند. جریان یک‌طرفه است:

```text
Database
 ↓
Prisma Model          (شکل جدول — implementation persistence)
 ↓
Repository            (کوئری + نگاشت به Domain)
 ↓
Domain Model          (src/domain/models — قرارداد اصلی Business Logic؛ همان تایپ‌های فاز ۱ توسعه‌یافته)
 ↓
Service Layer         (منطق دامنه — فقط Domain Model می‌بیند)
 ↓
UI                    (فقط Domain Model مصرف می‌کند)
```

**قواعد:**
- تایپ‌های `src/types` فاز ۱ نقطه شروع Domain Model هستند و در M0 به `src/domain/models` منتقل و کامل می‌شوند (Order، Payment، Reservation، Refund و…).
- Repository ها Prisma type را می‌پذیرند و Domain type برمی‌گردانند؛ هیچ فایل UI یا Service ای `import` از `@prisma/client` ندارد (تنها استثنا: `src/lib/db.ts` و Repositories).
- اگر ساختار دیتابیس فردا تغییر کند، فقط Repository و نگاشت عوض می‌شود؛ UI و Business Contract ثابت می‌مانند.
- نگاشت‌ها pure و تست‌پذیرند (Unit test مستقل از دیتابیس).

---

## ۴) دیتابیس — ERD کامل

موتور: **PostgreSQL 16** · ORM: **Prisma** · همه مبالغ: **Integer (IRT)** · همه زمان‌ها: `DateTime(utc)`.

### ۴.۰ Enumهای سیستم

| Enum | مقادیر |
|---|---|
| `ProductStatus` | `DRAFT` · `ACTIVE` · `ARCHIVED` |
| `OrderStatus` | `PENDING` · `PROCESSING` · `SHIPPED` · `DELIVERED` · `CANCELLED` · `RETURN_REQUESTED` · `RETURNED` |
| `PaymentStatus` | `PENDING` · `AUTHORIZED` · `PAID` · `FAILED` · `REFUNDED` · `PARTIALLY_REFUNDED` |
| `ShipmentStatus` | `PENDING` · `READY` · `SHIPPED` · `IN_TRANSIT` · `DELIVERED` · `FAILED` · `RETURNED` |
| `ReservationStatus` | `ACTIVE` · `CONVERTED` · `RELEASED` · `EXPIRED` |
| `RefundStatus` | `REQUESTED` · `PROCESSING` · `SUCCEEDED` · `FAILED` |
| `ReviewStatus` | `PENDING` · `APPROVED` · `REJECTED` |
| `ContentStatus` | `DRAFT` · `PUBLISHED` · `ARCHIVED` |
| `CouponType` | `PERCENT` · `FIXED` |
| `OutboxStatus` | `PENDING` · `PROCESSING` · `DONE` · `FAILED` |

### ۴.۱ دسترسی، نقش‌ها و احراز هویت

**User**
| فیلد | نوع | قید |
|---|---|---|
| id | String (cuid) | PK |
| phone | String(15) | UNIQUE, NOT NULL — شناسه اصلی |
| passwordHash | String? | NULLABLE (ورود OTP-محور؛ رمز اختیاری) |
| name | String? | — |
| email | String? | UNIQUE (اگر پر شود) |
| roleId | String? | FK → Role, onDelete: SET NULL (NULL = customer) |
| isActive | Boolean | DEFAULT true — غیرفعال = منع ورود |
| lastLoginAt | DateTime? | — |
| deletedAt | DateTime? | soft-delete (حساب حذف‌شده سفارش‌هایش را نگه می‌دارد) |
| createdAt / updatedAt | DateTime | auto |

**Role**
| فیلد | نوع | قید |
|---|---|---|
| id | String | PK |
| name | String | UNIQUE — `SUPER_ADMIN`, `STORE_MANAGER`, `ORDER_MANAGER`, `CONTENT_MANAGER`, `SUPPORT_AGENT`, `MARKETING_MANAGER` |
| title | String | نام فارسی برای نمایش |
| permissions | String[] | آرایه مجوزها — افزودن نقش/مجوز جدید = رکورد جدید، بدون تغییر schema |
| isSystem | Boolean | DEFAULT false — نقش‌های سیستمی قابل حذف نیستند |

**Session**
| فیلد | نوع | قید |
|---|---|---|
| id | String | PK |
| sessionToken | String | UNIQUE, INDEX |
| userId | String | FK → User, onDelete: CASCADE |
| isAdminSession | Boolean | DEFAULT false — سیاست انقضای جدا برای ادمین |
| ip / userAgent | String? | برای audit ورود |
| idleAt | DateTime? | آخرین فعالیت — مبنای idle-timeout ادمین |
| expiresAt | DateTime | NOT NULL، INDEX |
| revokedAt | DateTime? | revocation صریح (خروج اجباری/تغییر نقش) |

**OtpCode**
| فیلد | نوع | قید |
|---|---|---|
| id | String | PK |
| phone | String(15) | NOT NULL, INDEX (phone, createdAt) |
| codeHash | String | NOT NULL — **هرگز OTP خام ذخیره نمی‌شود** |
| expiresAt | DateTime | NOT NULL (۵ دقیقه) |
| attemptCount | Int | DEFAULT 0 — حداکثر ۵ تلاش |
| usedAt | DateTime? | مصرف یک‌بار |
| ip | String? | برای rate limit و audit |
| createdAt | DateTime | — |

### ۴.۲ کاتالوگ محصول

**Product**
| فیلد | نوع | قید |
|---|---|---|
| id | String | PK |
| slug | String | UNIQUE, NOT NULL |
| name | String | NOT NULL, INDEX (FTS) |
| shortDescription | String(300) | — |
| description | String | متن کامل، INDEX (FTS) |
| status | ProductStatus | DEFAULT `DRAFT`, INDEX |
| categoryId | String | FK → Category, onDelete: RESTRICT |
| ~~badges~~ | — | **حذف‌شده در v2.4 (ADR 011)** — برچسب‌ها محاسباتی‌اند؛ منبع: `store.badgeRules` + فروش واقعی + createdAt + موجودی — بنگر ۴.۲.۱ |
| deletedAt | DateTime? | soft-delete |
| createdAt / updatedAt | DateTime | — |

**Variant** — واحد موجودی و قیمت
| فیلد | نوع | قید |
|---|---|---|
| id | String | PK |
| productId | String | FK → Product, onDelete: CASCADE, INDEX |
| colorId | String? | FK → Color, onDelete: RESTRICT |
| sizeId | String? | FK → Size, onDelete: RESTRICT |
| sku | String | UNIQUE, NOT NULL, INDEX (FTS) |
| price | Int | NOT NULL — IRT، ≥ 0 |
| compareAtPrice | Int? | برای نمایش تخفیف؛ > price |
| stock | Int | DEFAULT 0 — موجودی فیزیکی |
| reserved | Int | DEFAULT 0 — رزروشده؛ `available = stock − reserved` |
| isActive | Boolean | DEFAULT true |
| deletedAt | DateTime? | soft-delete |
| createdAt / updatedAt | DateTime | — |
| **CHECK** | — | `stock >= 0` و `reserved >= 0` و `stock - reserved >= 0` |

**Color** (id PK, name, hex UNIQUE) · **Size** (id PK, name, sortOrder)

**ProductImage**: id PK · productId FK→Product CASCADE, INDEX · storageKey UNIQUE · alt? · sortOrder

**Category**: id PK · slug UNIQUE · name · description? · imageKey? · sortOrder · deletedAt?
**Collection**: id PK · slug UNIQUE · name · description? · imageKey? · sortOrder · deletedAt?
**CollectionProduct**: collectionId FK CASCADE + productId FK CASCADE → **PK مرکب (collectionId, productId)**

#### ۴.۲.۱ سیستم برچسب‌ها (Badges) — منبع حقیقت و قواعد نمایش

> افزوده‌شده در v2.1 (پاسخ به پرسش «برچسب‌ها هاردکد نیستند؟») — **بازنویسی کامل در v2.4 با تصمیم مالک: همهٔ برچسب‌ها کاملاً خودکار شدند (ADR 011)** — دیگر هیچ برچسبی با دست زده نمی‌شود، نه در seed، نه از پنل ادمین.

**منبع واحد برچسب: `badge-service` (محاسبه در زمان خواندن)**

| برچسب | قانون خودکار | دادهٔ منبع |
|---|---|---|
| `new` (جدید) | `ageDays ≤ newDays` از `createdAt` | تاریخ افزودن محصول |
| `bestseller` (پرفروش) | فروش واقعی پرداخت‌شدهٔ پنجرهٔ `bestsellerWindowDays` روز اخیر ≥ `bestsellerMinSales`؛ سفارش‌های PROCESSING/SHIPPED/DELIVERED؛ مرجوع کامل (`payments: none REFUNDED`) شمرده نمی‌شود | تجمیع `OrderItem` |
| `limited` (محدود) | `0 < stock ≤ limitedMaxStock` | Σ(variant.stock − reserved) |
| تخفیف + درصد | همیشه زنده از `compareAtPrice > price` (بدون ذخیره) | قیمت واریانت فعال |

**آستانه‌ها — Setting `store.badgeRules` (قابل تغییر از /admin/settings، fallback ایمن به `DEFAULT_BADGE_RULES`):**
`{ newDays: 14, bestsellerMinSales: 5, bestsellerWindowDays: 30, limitedMaxStock: 10 }` — هیچ عدد سیاستی در کد سفت نیست (ادامهٔ قاعدهٔ ADR 009).

**پیاده‌سازی:** `computeAutoBadges` (pure، ترتیب اهمیت: پرفروش > جدید > محدود) + `attachAutoBadges` (Repository بعد از `mapProductToDomain` صدا می‌زند — تک و لیست). کارت محصول حداکثر ۲ برچسب از همین آرایه محاسباتی نشان می‌دهد (`slice(0,2)`) + برچسب درصد تخفیف در صورت تخفیف واقعی.

**پنل ادمین:** فرم محصول فیلد برچسب دستی ندارد (توضیح صادقانه به‌جای آن)؛ کارت «پرفروش‌های خودکار» در داشبورد و صفحهٔ محصولات **گزارش** فروش واقعی را نشان می‌دهد (بدون دکمهٔ تأیید — حالت قبلی M5 جایگزین شد). تغییر قوانین → invalidate تگ `settings` + `products` + `homepage`.

**به‌روزرسانی برچسب:** هیچ فرایندی لازم نیست — برچسب تابع داده است. برای تازگی سریع ویترین (ISR)، زنجیرهٔ فروش (placeOrder / confirmPayment / failPayment / cancelOrder / refund / انقضای رزرو) از طریق `storefront-invalidation` تگ‌های محصول/خانه را invalidate می‌کند؛ `revalidateTag` خارج از زمینهٔ درخواست (worker تایمر/اسکریپت) best-effort رد می‌شود و صفحه در پنجرهٔ revalidate خودش تازه می‌شود.

**«پرفروش‌ترین‌ها» صفحهٔ اصلی:** همچنان رتبه‌بندی پروکسی `reviewCount × rating` — مستقل از برچسب محاسباتی `bestseller`. (ادغام این دو در M6 بررسی می‌شود.)

### ۴.۳ فروش، سفارش و پرداخت

**Address**
id PK · userId FK→User CASCADE, INDEX · fullName · phone · province · city · postalCode(10) · line · isDefault Boolean DEFAULT false

**Cart / CartItem** (فقط کاربر لاگین‌شده؛ سبد مهمان در localStorage می‌ماند)
- Cart: id PK · userId FK UNIQUE · updatedAt
- CartItem: id PK · cartId FK CASCADE · variantId FK RESTRICT · quantity (1..20) · **UNIQUE(cartId, variantId)**

**Coupon**
| فیلد | نوع | قید |
|---|---|---|
| id | String | PK |
| code | String | UNIQUE, NOT NULL |
| type | CouponType | — |
| value | Int | درصد (1..100) یا مبلغ IRT |
| minSubtotal | Int? | حداقل مبلغ سبد |
| maxDiscount | Int? | سقف تخفیف برای PERCENT |
| usageLimit | Int? | سقف کلی |
| perUserLimit | Int? | سقف برای هر کاربر |
| usedCount | Int | DEFAULT 0 — کش خواندنی؛ حقیقت از CouponRedemption |
| startsAt / expiresAt | DateTime? | بازه اعتبار |
| isActive | Boolean | DEFAULT true |
| deletedAt | DateTime? | soft-delete |

**CouponRedemption**: id PK · couponId FK RESTRICT, INDEX · orderId FK RESTRICT · userId? · createdAt · **UNIQUE(couponId, orderId)**

**Order** — رکورد تاریخیِ immutable (به‌جز ستون‌های status/note)
| فیلد | نوع | قید |
|---|---|---|
| id | String | PK |
| code | String(10) | UNIQUE, NOT NULL — کد رهگیری مشتری |
| userId | String? | FK → User, onDelete: SET NULL, INDEX (userId, createdAt) |
| phone | String | NOT NULL — تماس مستقل از حساب |
| status | OrderStatus | DEFAULT `PENDING`, INDEX |
| subtotal | Int | SNAPSHOT |
| discountTotal | Int | SNAPSHOT |
| shippingTotal | Int | SNAPSHOT |
| taxTotal | Int | SNAPSHOT DEFAULT 0 |
| grandTotal | Int | SNAPSHOT = جمع اجزا |
| currency | String(3) | DEFAULT `IRT` — snapshot |
| shippingAddress | Json | **SNAPSHOT آدرس** (نه FK به Address) |
| couponCodeSnapshot | String? | کد استفاده‌شده در زمان ثبت |
| note | String? | قابل ویرایش توسط ادمین |
| placedAt | DateTime | — |
| createdAt / updatedAt | DateTime | — |

**OrderItem** — snapshot کامل هر قلم
id PK · orderId FK→Order **RESTRICT**, INDEX · productId (رشته، بدون FK زنده) · variantId · productNameSnapshot · variantNameSnapshot · skuSnapshot · imageUrlSnapshot? · unitPrice · quantity · discount · total (unitPrice×quantity−discount)

**InventoryReservation**
| فیلد | نوع | قید |
|---|---|---|
| id | String | PK |
| variantId | String | FK RESTRICT, INDEX |
| orderId | String? | FK → Order SET NULL |
| qty | Int | ≥ 1 |
| status | ReservationStatus | DEFAULT `ACTIVE`, INDEX |
| expiresAt | DateTime | NOT NULL — TTL پیش‌فرض ۲۰ دقیقه، INDEX |
| createdAt / releasedAt? | DateTime | — |

**Payment** — یک رکورد به ازای هر «تلاش پرداخت»
| فیلد | نوع | قید |
|---|---|---|
| id | String | PK |
| orderId | String | FK RESTRICT, INDEX |
| provider | String | `zarinpal` · `zibal` · … |
| authority | String | UNIQUE — شناسه سمت درگاه |
| transactionId | String? | UNIQUE — پس از verify |
| amount | Int | IRT — مقدار درخواستی |
| status | PaymentStatus | DEFAULT `PENDING`, INDEX |
| metadata | Json? | پاس‌های خام درگاه برای اشکال‌زدایی |
| createdAt / verifiedAt? | DateTime | — |

**Refund**
id PK · paymentId FK RESTRICT · orderId FK RESTRICT, INDEX · amount · reason · status RefundStatus DEFAULT `REQUESTED` · providerRef? · actorId FK→User SET NULL · createdAt · succeededAt?

**Shipment**
id PK · orderId FK RESTRICT, INDEX · carrier? · trackingCode? · status ShipmentStatus DEFAULT `PENDING` · addressSnapshot Json · shippedAt? · deliveredAt? · createdAt

### ۴.۴ محتوا و سیستم

**Review**: id PK · productId FK RESTRICT, INDEX (productId, status) · userId? · authorName · rating Int (1..5) · body · status ReviewStatus DEFAULT `PENDING` · publishedAt? · createdAt

**JournalPost**: id PK · slug UNIQUE · title · excerpt · bodyMarkdown · coverKey? · topic · readingMinutes Int · status ContentStatus DEFAULT `DRAFT`, INDEX · publishedAt? · authorId FK→User SET NULL · deletedAt? · createdAt/updatedAt

**FaqItem**: id PK · question · answer · sortOrder · isActive

**Setting**: key PK (String) · value Json · updatedAt · updatedBy FK→User SET NULL — خواندنی فقط از طریق `SettingsService` تایپ‌شده

**MediaObject** (registry آپلودها): id PK · storageKey UNIQUE · mime · sizeBytes · width · height · sha256 UNIQUE · uploadedBy FK→User SET NULL · createdAt

**AuditLog** — append-only، هیچ delete/update
id PK · actorId FK→User SET NULL, INDEX · action (مثل `product.update`, `order.refund`) · entityType · entityId, INDEX (entityType, entityId) · before Json? · after Json? · ip? · userAgent? · createdAt, INDEX

**OutboxEvent**
id PK · type (مثل `PaymentSucceeded`) · payload Json · status OutboxStatus DEFAULT `PENDING` · attempts Int DEFAULT 0 · lastError? · availableAt DateTime (backoff) · processedAt? · claimedAt? (زمان claim برای بازیابی crash) · createdAt, INDEX (status, availableAt)

**SmsLog** — دفتر پیامک‌ها (M5) — append-only
id PK · to VarChar(15) · text · tag (مثل `order-created`) · status SmsLogStatus DEFAULT `SENT` · provider · providerId? · orderId? (بدون FK — پیامک ممکن است بیرون از سفارش باشد) · error? · createdAt, INDEX (createdAt) و (tag, createdAt)

**WishlistItem**: id PK · userId FK CASCADE · productId FK CASCADE · **UNIQUE(userId, productId)**

### ۴.۵ قوانین FK و حذف

- `RESTRICT` برای همه FKهای اشاره‌کننده به **Order، Payment، Product(از OrderItem)، Refund، AuditLog**: رکورد تاریخی هرگز با حذف مرجع، پاک یا معیوب نمی‌شود.
- `CASCADE` فقط داخل مالکیت محتوا: Cart→CartItem، Product→ProductImage، Collection↔Product (پیوند).
- `SET NULL` برای Actor/Author/Userهای اختیاری تا تاریخچه پس از حذف کاربر باقی بماند.
- حذف: Product/Variant/Category/Collection/Coupon/JournalPost/User = **soft-delete** (`deletedAt`). Order/Payment/Refund/Shipment/Reservation/AuditLog/Outbox = **هرگز delete نمی‌شوند** (بخش ۱۴).

### ۴.۶ فهرست Indexها (علاوه بر UNIQUEها)

```text
Variant(productId) · Order(userId, createdAt) · Order(status) · Payment(orderId) · Payment(status)
InventoryReservation(status, expiresAt) — partial: status = ACTIVE
OutboxEvent(status, availableAt) · Session(sessionToken) · Session(expiresAt)
OtpCode(phone, createdAt) · Review(productId, status) · AuditLog(entityType, entityId) · AuditLog(createdAt)
CouponRedemption(couponId) · ProductImage(productId) · CollectionProduct(PK مرکب)
FTS: Product(name, shortDescription, description) + Variant(sku) — GIN با پیکربندی فارسی (بخش ۱۷)
```

---

## ۵) ماشین‌های وضعیت (State Machines)

سه ماشین Order / Payment / Shipment **مستقل‌اند** و سازگاری‌شان فقط در Serviceهای دامنه تضمین می‌شود. هیچ گذاری مستقیم از طریق UPDATE ادمین انجام نمی‌شود؛ فقط متدهای دامنه (`OrderService.transition` و …) با چک گذار مجاز.

### ۵.۱ Order

```text
PENDING ──► PROCESSING ──► SHIPPED ──► DELIVERED
   │             │                        
   ▼             ▼                        
CANCELLED      CANCELLED (فقط قبل از SHIPPED، ادمین + refund در صورت PAID)
DELIVERED ──► RETURN_REQUESTED ──► RETURNED
```

| از | به | شرط | مجری |
|---|---|---|---|
| PENDING | PROCESSING | پرداخت PAID (خودکار در Payment confirm) | سیستم |
| PENDING | CANCELLED | انصراف کاربر/تایم‌اوت پرداخت/لغو ادمین — رزروها آزاد می‌شوند | کاربر/سیستم/ادمین |
| PROCESSING | SHIPPED | ثبت Shipment با کد رهگیری | `orders.update` |
| SHIPPED | DELIVERED | تأیید تحویل | `orders.update` |
| PROCESSING | CANCELLED | لغو ادمین پیش از ارسال + refund خودکار اگر PAID | `orders.update` + `orders.refund` |
| DELIVERED | RETURN_REQUESTED | درخواست مرجوعی مشتری داخل بازه سیاست (۷/۱۴ روز) | مشتری |
| RETURN_REQUESTED | RETURNED | تأیید ادمین — موجودی برگردانده و refund اجرا می‌شود | `orders.update` + `orders.refund` |

### ۵.۲ Payment (هر رکورد = یک تلاش)

```text
PENDING ──► PAID        (verify موفق — یک‌بار و idempotent)
PENDING ──► FAILED      (verify ناموفق / انقضای پنجره پرداخت ~۲۰ دقیقه / لغو کاربر)
PAID    ──► PARTIALLY_REFUNDED ──► REFUNDED
AUTHORIZED   (رزرو برای درگاه‌های hold-based / COD آینده — در زرین‌پال v1 استفاده نمی‌شود)
```

### ۵.۳ Shipment

```text
PENDING → READY → SHIPPED → IN_TRANSIT → DELIVERED
SHIPPED|IN_TRANSIT → FAILED → RETURNED
```

### ۵.۴ InventoryReservation

```text
ACTIVE → CONVERTED   (پرداخت موفق — همزمان: stock−=qty و reserved−=qty)
ACTIVE → RELEASED    (لغو سفارش/خطای پرداخت)
ACTIVE → EXPIRED     (worker انقضا — TTL ۲۰ دقیقه)
```

### ۵.۵ Refund · Review · Content

```text
Refund:  REQUESTED → PROCESSING → SUCCEEDED | FAILED
Review:  PENDING → APPROVED | REJECTED          (نمایش عمومی فقط APPROVED)
Content: DRAFT → PUBLISHED → ARCHIVED           (ژورنال — DRAFT هرگز عمومی نیست)
```

---

## ۶) RBAC — نقش‌ها، مجوزها، ماتریس دسترسی

### ۶.۱ مدل

```text
User ──(roleId, NULL = customer)──► Role ──(permissions: String[])──► Permission
```

- **Permissionها رشته‌های کانونی** با الگوی `entity.action` هستند (فهرست کامل در ۶.۲).
- افزودن Role یا Permission جدید = یک رکورد/یک ثابت جدید — **بدون تغییر schema و بدون تغییر معماری**.
- اعمال authorization فقط از طریق تابع واحد `requirePermission(permission)` در Guard Layer؛ هیچ handler ای خودش role را چک نمی‌کند (چک role مستقیم ممنوع — فقط permission).
- نقش `customer` (roleId=NULL) به پنل ادمین هیچ دسترسی ندارد؛ فقط صفحات حساب کاربری.

### ۶.۲ فهرست کانونی Permissionها

```text
products.read · products.create · products.update · products.delete
inventory.read · inventory.update            (اصلاح دستی stock)
orders.read · orders.update · orders.refund
customers.read · customers.update
coupons.read · coupons.create · coupons.update · coupons.delete
reviews.read · reviews.moderate
content.read · content.update                (ژورنال، FAQ، صفحات محتوایی)
media.read · media.upload · media.delete
analytics.read
settings.read · settings.update
users.read · users.update                    (کاربران ادمین و نقش‌ها)
audit.read
```

### ۶.۳ ماتریس Role × Permission

| Permission | SUPER_ADMIN | STORE_MANAGER | ORDER_MANAGER | CONTENT_MANAGER | SUPPORT_AGENT | MARKETING_MANAGER |
|---|:-:|:-:|:-:|:-:|:-:|:-:|
| products.read / create / update / delete | ✅ | ✅ | 🔵read | 🔵read | 🔵read | 🔵read |
| inventory.read / update | ✅ | ✅ | — | — | — | — |
| orders.read | ✅ | ✅ | ✅ | — | ✅ | — |
| orders.update | ✅ | ✅ | ✅ | — | — | — |
| orders.refund | ✅ | ✅ | ✅ | — | — | — |
| customers.read / update | ✅ | ✅ | 🔵read | — | ✅ | — |
| coupons.* | ✅ | ✅ | — | — | — | ✅ |
| reviews.read / moderate | ✅ | ✅ | — | ✅ | 🔵read | 🔵read |
| content.read / update | ✅ | 🔵read | — | ✅ | — | 🔵read |
| media.* | ✅ | ✅ | — | ✅ | — | — |
| analytics.read | ✅ | ✅ | ✅ | ✅ | — | ✅ |
| settings.read | ✅ | ✅ | — | — | — | — |
| settings.update | ✅ | — | — | — | — | — |
| users.read / update | ✅ | — | — | — | — | — |
| audit.read | ✅ | — | — | — | — | — |

🔵read = فقط read آن گروه. قوانین ویژه: تغییر نقش کاربران فقط `users.update` (SUPER_ADMIN) + Audit اجباری + 2FA اجباری برای SUPER_ADMIN.

---

## ۷) Service Map

| Service | مسئولیت | وابستگی کلیدی |
|---|---|---|
| `ProductService` | CRUD محصول/واریانت، کوئری عمومی، related | ProductRepository · Audit · Cache |
| `CategoryService` / `CollectionService` | CRUD دسته/کالکشن + پیوند محصولات | Audit · Cache |
| `InventoryService` | reserve / release / convert / expire / adjust — همگی atomic | ReservationRepository |
| `CartService` | سبد کاربر لاگین، اعتبارسنجی qty، merge سبد مهمان | InventoryService |
| `CheckoutService` | ارکستراسیون checkout: قیمت سروری → کوپن → رزرو → Order+Items+Payment (یک tx) | همه بالا |
| `OrderService` | کوئری‌ها، گذار وضعیت، پیگیری با code، خروجی ادمین | Audit |
| `PaymentService` | شروع تلاش، verify سمت سرور، confirm idempotent، refund | PaymentProvider · OrderService |
| `ShippingService` | مرسوله، کد رهگیری، گذار ShipmentStatus | Audit · Notification |
| `CouponService` | اعتبارسنجی + مصرف transactional + شمارش | — |
| `ReviewService` | ثبت نظر مشتری + مدیریت ادمین | Notification |
| `ContentService` | ژورنال/FAQ + pipeline markdown sanitize | StorageProvider |
| `SettingsService` | `getStoreSettings(): StoreSettings` تایپ‌شده + اعتبارسنجی تغییرها | Cache |
| `MediaService` | آپلود امن + registry + حذف | StorageProvider |
| `AuthService` | OTP issue/verify، ورود/خروج، session | RateLimit · Notification |
| `UserService` | کاربران ادمین، نقش‌ها، فعال/غیرفعال | Audit |
| `SearchService` | نرمال‌سازی فارسی + FTS + پیشنهاد سریع | — |
| `NotificationService` | قالب‌های SMS/Email + enqueue در Outbox | Outbox |
| `AuditService` | ثبت append-only رخدادهای ادمین | — |
| `AnalyticsService` | تجمیع داشبورد (فروش، سفارش، موجودی) | — |
| `OutboxService` | enqueue + dispatch به Worker | Workerها |

**قاعده فراخوانی:** Service فقط Service دیگر و Repository را می‌بیند؛ **Repository هرگز Service را صدا نمی‌زند**؛ UI فقط Service (از طریق Action/API).

---

## ۸) API / Server Action Map

سطح دسترسی: 🌐 Public · 🔑 Authenticated (customer) · 🛡 Admin+Permission

| عملیات | مسیر | سطح | نکته امنیتی |
|---|---|---|---|
| جستجوی سریع | `GET /api/search?q=` | 🌐 | rate limit 30/IP/min |
| سلام سیستم | `GET /api/health` | 🌐 | بدون داده حساس |
| callback درگاه (ریدایرکت) | `POST /api/payment/callback` | 🌐 | verify سروری + idempotency |
| وب‌هوک درگاه | `POST /api/webhooks/payment` | 🌐 | امضای درگاه + idempotency |
| ارسال OTP | Server Action `sendOtp` | 🌐 | rate limit IP+phone (بخش ۹.۴) |
| بررسی OTP | Server Action `verifyOtp` | 🌐 | attemptCount + hash + مصرف یک‌بار |
| ورود با رمز (اختیاری) | Server Action `signIn` | 🌐 | rate limit + audit تلاش |
| خروج | Server Action `signOut` | 🔑 | revoke session |
| CRUD آدرس | Server Action | 🔑 | فقط آدرس‌های userId خود |
| به‌روزرسانی سبد سروری | Server Action | 🔑 | اعتبارسنجی موجودی |
| Checkout (ثبت سفارش) | Server Action `checkout` | 🔑 | tx کامل (بخش ۱۰.۱) |
| درخواست مرجوعی | Server Action | 🔑 | فقط سفارش خود، داخل بازه |
| ثبت نظر | Server Action | 🔑 | فقط محصول خریداری‌شده؛ PENDING |
| CRUD محصول/دسته/کالکشن | Server Action | 🛡 products.* | audit + revalidateTag |
| اصلاح موجودی | Server Action | 🛡 inventory.update | audit (before/after) |
| گذار وضعیت سفارش/مرسوله | Server Action | 🛡 orders.update | فقط گذار مجاز |
| Refund | Server Action | 🛡 orders.refund | tx + audit + Idempotency |
| CRUD کوپن | Server Action | 🛡 coupons.* | audit |
| تأیید/رد نظر | Server Action | 🛡 reviews.moderate | audit |
| آپلود مدیا | Server Action | 🛡 media.upload | بخش ۲۱ |
| ژورنال/FAQ/تنظیمات | Server Action | 🛡 content.update / settings.update | audit + revalidate |
| مدیریت کاربران و نقش‌ها | Server Action | 🛡 users.update (SUPER_ADMIN) | audit + revoke session کاربر |
| مشاهده Audit Log | صفحه ادمین | 🛡 audit.read | read-only |

**قانون:** هر Server Action mutation فارغ از سطح، زنجیره بخش ۲.۲ را طی می‌کند. API Routeهای mutation (callback/webhook) به‌جای session از **امضای درگاه** احراز می‌شوند و برای مرورگر same-origin نیستند (هدر CSRF فقط برای مسیرهای session-دار الزامی است).

---

## ۹) Security Model

### ۹.۱ تهدید → دفاع

| تهدید | دفاع |
|---|---|
| **CSRF** | Server Actions: حفاظت بومی فریم‌ورک (چک Origin/Host + غیرمجاز بودن GET) + کوکی `sameSite=lax`. API Routeهای mutation با session: چک same-origin + هدر سفارشی. هیچ state-change با GET. مسیرهای callback/webhook درگاه به‌جای CSRF با **امضای درگاه** محافظت می‌شوند |
| **XSS** | Escape خودکار React؛ `dangerouslySetInnerHTML` فقط برای markdownِ sanitize-شده (بخش ۲۱.۳) و JSON-LD ثابت؛ CSP مرحله‌ای (بخش ۹.۲) |
| **SQL Injection** | Prisma کوئری پارامتری؛ ممنوعیت رشته‌های SQL خام (تنها استثنای بازبینی‌شده: statement رزرو موجودی با پارامتر bind-شده) |
| **Auth Bypass** | دو لایه: Middleware (محافظ مسیر) + authenticate داخل هر handler؛ تست خودکار «هر مسیر ادمین بدون session → 401» |
| **IDOR** | کوئری‌های مشتری همیشه scope با `userId`؛ دسترسی سفارش = مالک یا `orders.read`؛ تست IDOR خودکار برای همه Actionهای 🔑 |
| **Brute Force** | Rate limit ورود (۹.۴) + audit همه تلاش‌های ورود ادمین |
| **OTP Abuse** | سیاست کامل ۹.۴: hash، انقضا، cooldown، attempt، مصرف یک‌بار، rate limit ترکیبی IP+phone |
| **Payment Fraud** | هیچ موفقیتی بر اساس اطلاعات client/redirect پذیرفته نمی‌شود؛ verify سروری + چک مبلغ + چک authority (بخش ۱۱) |
| **Replay / Duplicate Callback** | Idempotency کامل (بخش ۱۱) — callback/webhook تکراری اثر مالی صفر دارد |
| **Race Condition** | رزرو موجودی با UPDATE شرطی اتمیک (بخش ۱۳)؛ مصرف کوپن و سقف‌ها در tx؛ unique constraintها به‌عنوان خط دفاعی نهایی |
| **Upload Abuse** | خط لوله امن بخش ۲۱.۲ — هیچ فایل آپلودی executable نیست |
| **Session Theft** | کوکی httpOnly+secure+sameSite؛ session دیتابیسی → revocation؛ idle-timeout ادمین؛ 2FA SUPER_ADMIN؛ تغییر نقش → revoke session‌های کاربر |
| **Privilege Escalation** | authorization فقط سرور در Guard Layer؛ چک role مستقیم در handler ممنوع؛ تغییر نقش‌ها فقط SUPER_ADMIN + audit |
| **Data Exfiltration** | لاگ JSON بدون داده حساس (بدون رمز/توکن/شماره کارت)؛ دسترسی دیتابیس فقط از داخل شبکه Docker |

### ۹.۲ Security Headers

فعال از فاز ۱ (`next.config.ts`): `X-Frame-Options: DENY` · `X-Content-Type-Options: nosniff` · `Referrer-Policy: strict-origin-when-cross-origin` · `Permissions-Policy` (بستن دوربین/میکروفون/موقعیت/پرداخت مرورگر) · `Strict-Transport-Security`.

**CSP مرحله‌ای (M0 → M6):**
1. `Content-Security-Policy-Report-Only` با گزارش‌گیری — M0
2. CSP سخت‌گیرانه با `nonce` برای اسکریپت‌های Next — M6 (پس از تست کامل همه صفحات)
3. `frame-ancestors 'none'` · `object-src 'none'` · `base-uri 'self'`

### ۹.۳ سیاست Session ادمین و مشتری

| پارامتر | مشتری | ادمین |
|---|---|---|
| انقضای مطلق | ۳۰ روز (sliding) | ۸ ساعت |
| Idle timeout | — | ۳۰ دقیقه (ستون `idleAt`) |
| کوکی | httpOnly · secure · sameSite=lax | همان + نام کوکی جدا |
| Revocation | خروج دستی | دستی + اجباری (تغییر نقش، reset رمز) |
| 2FA | اختیاری (آینده) | **اجباری برای SUPER_ADMIN** (TOTP) |
| Audit ورود | — | همه تلاش‌های موفق/ناموفق |
| سیاست رمز (در صورت استفاده) | — | حداقل ۱۰ کاراکتر، هش argon2/bcrypt(12) |

### ۹.۴ سیاست OTP و Rate Limitها

**سیاست OTP:** hash (SHA-256 + salt سرور) · انقضا ۵ دقیقه · حداکثر ۵ تلاش بررسی · مصرف یک‌بار (`usedAt`) · cooldown ۹۰ ثانیه بین دو ارسال برای یک شماره.

| Endpoint | سقف | پنجره |
|---|---|---|
| `sendOtp` — per phone | ۳ | ۱۰ دقیقه |
| `sendOtp` — per IP | ۱۰ | ۱ ساعت |
| `verifyOtp` — per phone | ۵ | ۱۵ دقیقه |
| `signIn` (رمز) | ۵ per IP+شناسه | ۱۵ دقیقه + قفل تصاعدی |
| شروع پرداخت | ۵ per user | ۱۰ دقیقه |
| apply coupon | ۱۰ per user | ۱۰ دقیقه |
| ثبت نظر | ۳ per user | ۲۴ ساعت |
| `GET /api/search` | ۳۰ per IP | ۱ دقیقه |
| بقیه APIهای عمومی | ۱۲۰ per IP | ۱ دقیقه |

پیاده‌سازی: abstraction واحد `RateLimiter` — پیاده‌سازی v1 درون-حافظه (تک‌نود)؛ ارتقای بعدی بدون تغییر امضا.

---

## ۱۰) Transaction Boundaries

### ۱۰.۱ Checkout

```text
✅ داخل یک DB Transaction:
  ۱. اعتبارسنجی نهایی سبد (قیمت/موجودی از DB — هرگز از کلاینت)
  ۲. رزرو اتمیک همه واریانت‌ها (UPDATE شرطی — بخش ۱۳) → خطا = rollback کامل
  ۳. ایجاد Order + OrderItems (همه snapshotها)
  ۴. ایجاد InventoryReservation (ACTIVE, TTL ۲۰ دقیقه)
  ۵. ثبت CouponRedemption + به‌روزرسانی usedCount
  ۶. AuditLog (checkout) — optional
  ۷. OutboxEvent(OrderCreated)

❌ خارج از Transaction (بعد از commit):
  · فراخوانی PaymentProvider.start → دریافت authority → ثبت Payment در tx کوچک جدا
  · SMS/Email (از طریق Outbox)
```

### ۱۰.۲ تأیید پرداخت (callback/webhook)

```text
Gateway Callback / Webhook
 ↓
Validate Callback (فرمت + امضا)
 ↓
Find PaymentAttempt (با authority UNIQUE)
 ↓
Server-side Verify (فراخوانی مستقیم API درگاه — خارج از tx)
 ↓
Verify Amount (amount پاس درگاه == amount رکورد Payment)
 ↓
Verify Authority / TransactionId
 ↓
Idempotency Check (بخش ۱۱)
 ↓
DB Transaction:
  · Payment.status → PAID (+ transactionId, verifiedAt)
  · Order.status PENDING → PROCESSING
  · Reservation(s) → CONVERTED + stock−=qty و reserved−=qty
  · OutboxEvent(PaymentSucceeded)
 ↓
Redirect به صفحه نتیجه / پاسخ webhook
```

### ۱۰.۳ سایر عملیات

| عملیات | داخل tx | خارج tx |
|---|---|---|
| آپدیت محصول ادمین | update + AuditLog(before/after) | revalidateTag (بعد از commit) |
| Refund | Refund row + Payment.status + Order.status | فراخوانی refund درگاه (با reconciliation) |
| انقضای رزرو | هر Reservation جدا: EXPIRED + reserved−=qty | OutboxEvent(ProductBackInStock) در صورت صفر شدن available |
| ورود OTP | مصرف OtpCode + ایجاد Session | ارسال SMS |
| حذف کاربر (soft) | deletedAt + revoke همه sessionها | audit |

**قانون طلایی:** SMS، Email، فراخوانی API خارجی و پردازش تصویر **هرگز داخل DB Transaction** نیستند.

---

## ۱۱) Idempotency

**اصل:** همه عملیات حساس مالی با تکرار، همان نتیجه بدون اثر مضاعف می‌دهند.

| سناریوی تکرار | مکانیزم | نتیجه |
|---|---|---|
| callback تکراری (همان authority) | UNIQUE `authority` + چک status داخل tx | پاس موفق تکراری، بدون تغییر دیتا |
| webhook تکراری | همان مسیر confirm idempotent | بدون SMS/تغییر وضعیت مضاعف |
| double-submit checkout (کلاینت) | توکن idempotency در Action + unique code سفارش | یک Order واحد |
| refund تکراری | چک Refund.status + قفل وضعیت Payment | فقط یک refund فعال |
| ارسال مجدد Event توسط worker | چک وضعیت Outbox + کلید اثر (مثل `order:{id}:payment-succeeded`) | یک SMS/Email |

**تست الزامی:** شبیه‌سازی callback دوباره و سه‌باره پس از PAID — انتظار: پاس موفق، صفر تغییر در Order/Inventory/Notification.

---

## ۱۲) پول، ارز و محاسبات مالی

- **واحد canonical کل سیستم: `IRT` (تومان) — Integer.** هیچ Float/Decimal در منطق قیمت.
- هر Order/Payment/Refund فیلد `currency` را snapshot می‌کند (فعلاً همیشه `IRT`).
- تبدیل واحد فقط در **Adapter** هر PaymentProvider انجام می‌شود (مثلاً اگر درگاهی ریال بگیرد: `×10` داخل adapter، نه در Business Logic).
- فرمول‌ها: `subtotal = Σ(unitPrice×quantity)` · `discountTotal = min(سقف‌ها, محاسبه کوپن)` · `grandTotal = subtotal − discountTotal + shippingTotal + taxTotal`.
- `taxTotal` فعلاً ۰ (فروشگاه B2C بدون مالیات بر ارزش افزوده در فاز اول) — فیلد از روز اول در schema هست.
- گرد کردن: فقط در درصد کوپن (`floor`)؛ اختلاف ریالی به نفع مشتری.
- `compareAtPrice` صرفاً نمایشی است و در محاسبه مالی وارد نمی‌شود.

---

## ۱۳) موجودی و رزرو (Inventory & Reservation)

**مدل:** `stock` (فیزیکی) − `reserved` (رزروشده) = `available`. حقیقت موجودیِ قابل فروش همین تفاضل است.

**رزرو اتمیک (داخل tx checkout):**

```sql
UPDATE "Variant"
SET "reserved" = "reserved" + :qty
WHERE "id" = :variantId
  AND "isActive" = true
  AND "deletedAt" IS NULL
  AND ("stock" - "reserved") >= :qty;
-- rowCount == 0 → OUT_OF_STOCK → rollback کل checkout
```

- رزرو **همه** قلم‌های سبد در یک tx است؛ خطای یک قلم = آزادی کامل بقیه (rollback).
- **TTL رزرو: ۲۰ دقیقه** (پنجره پرداخت). Worker انقضا هر ۵ دقیقه: `ACTIVE ∧ expiresAt < now → EXPIRED + reserved−=qty` (per-row tx، اتمیک با همان الگوی شرطی).
- **CONVERTED** هنگام پرداخت موفق: `stock−=qty` و `reserved−=qty` در همان tx تأیید پرداخت.
- **RELEASED** هنگام لغو سفارش/خطای پرداخت: فقط `reserved−=qty`.
- اگر با آزاد شدن رزرو، `available` از ۰ به >۰ رسید → OutboxEvent(`ProductBackInStock`).
- اصلاح دستی stock توسط ادمین (`inventory.update`) فقط با AuditLog(before/after).
- قید CHECK دیتابیسی (`stock ≥ 0`, `reserved ≥ 0`, `stock−reserved ≥ 0`) خط دفاعی نهایی است.

---

## ۱۴) Snapshot و سیاست حذف (Historical Immutability)

**قانون:** اگر داده‌ای در آینده قابل تغییر است، سفارش نباید به آن وابسته باشد.

| snapshot | کجا | محافظت از چه |
|---|---|---|
| productName / variantName / sku / imageUrl / unitPrice / discount / total | OrderItem | تغییر نام/قیمت/SKU/تصویر محصول |
| subtotal / discountTotal / shippingTotal / taxTotal / grandTotal / currency / couponCode | Order | تغییر کوپن، هزینه ارسال، قوانین مالیات |
| آدرس کامل | Order.shippingAddress (Json) | ویرایش/حذف Address توسط کاربر |
| مبلغ + provider + authority | Payment | تغییر قیمت بعد از شروع پرداخت |

**Delete Policy:**

| دسته | سیاست |
|---|---|
| Product / Variant / Category / Collection / Coupon / JournalPost / User | soft-delete (`deletedAt`) — قابل بازیابی، از کوئری‌های عمومی حذف می‌شوند |
| Order / Payment / Refund / Shipment / Reservation / AuditLog / OutboxEvent | **هرگز delete نمی‌شوند** — retention دائمی؛ فقط RESTRICT FK مانع خرابی تاریخچه است |
| Session / OtpCode | حذف امن پس از انقضا (داده حساس فاقد ارزش تاریخی) — پاک‌سازی دوره‌ای |
| MediaObject | حذف فیزیکی از storage فقط پس از بررسی عدم ارجاع |

---

## ۱۵) معماری Async / Event / Outbox

### ۱۵.۱ جریان

```text
DB Transaction (رکورد اصلی + OutboxEvent در همان tx)
 ↓
Worker درون-پروسه‌ای (poll هر ۵ ثانیه، SELECT ... FOR UPDATE SKIP LOCKED)
 ↓
Dispatch به Handler → SmsProvider / EmailProvider / Analytics / Notification
 ↓
DONE  (یا: retry با backoff نمایی ۱→۲→۴→۸ دقیقه، حداکثر ۸ تلاش → FAILED + هشدار)
```

- Worker روز اول **درون-پروسه‌ای** است (بدون Redis)؛ ارتقای آینده به BullMQ فقط Worker را جایگزین می‌کند — Outbox و Handlerها ثابت می‌مانند (ADR-003).
- Eventها یک‌بار-اثر هستند (کلید اثر در بخش ۱۱) و ترتیب پردازش هر order تضمین می‌شود (poll بر اساس createdAt).
- **پیاده‌سازی M5:** ورود worker از `instrumentation.register` (فقط runtime nodejs، نه فاز build)؛ تیک ۵ ثانیه‌ای + انقضای رزرو تیک ۵ دقیقه‌ای (§13)؛ گارد globalThis برای جلوگیری از دوبل با HMR · unref · فلگ anti-overlap.
- **claim اتمیک:** `updateMany(status=PENDING → PROCESSING, claimedAt=now)` — فقط یک claim برنده؛ **بازیابی crash:** PROCESSING با claimedAt قدیمی‌تر از ۱۰ دقیقه دوباره PENDING.
- **retry:** backoff نمایی ۱→۲→۴→۸→۱۶→۳۲→۶۴→۱۲۸ دقیقه؛ پس از ۸ تلاش FAILED + لاگ error.
- **قواعد handler:** هیچ فراخوانی خارجی داخل tx؛ خطای handler = retry (نه crash)؛ type بدون مصرف‌کننده = DONE با یادداشت (در صف نمی‌ماند).
- **دفتر پیامک:** هر handler پس از ارسال، رکورد `SmsLog` ثبت می‌کند (متن + گیرنده + وضعیت) — در حالت دمو صفحهٔ `/admin/sms` همان چیزی را نشان می‌دهد که «می‌رفت» (شیشهٔ پشت کارت‌خوان)؛ با SMS واقعی همین دفتر لاگ ارسال است.

### ۱۵.۲ فهرست Eventها

| Event | منتشرکننده | payload کلیدی | مصرف‌کننده |
|---|---|---|---|
| `OrderCreated` | CheckoutService | orderId, code, phone, grandTotal | SMS تأیید سفارش |
| `PaymentSucceeded` | PaymentService | orderId, paymentId, amount | SMS پرداخت موفق + Analytics |
| `PaymentFailed` | PaymentService | orderId, reason | Analytics (نرخ رهاسازی) |
| `OrderShipped` | ShippingService | orderId, trackingCode | SMS با کد رهگیری |
| `OrderDelivered` | ShippingService | orderId | SMS + درخواست نظر (تأخیر ۲۴س) |
| `OrderCancelled` | OrderService | orderId, reason | SMS لغو + Analytics |
| `ProductBackInStock` | InventoryService | productId, variantId | ایمیل/اطلاع‌رسانی مشتریان علاقه‌مند (آینده) |
| `ReviewSubmitted` | ReviewService | reviewId, productId | نوتیف ادمین |
| `UserRegistered` | AuthService | userId, phone | SMS خوش‌آمد + Analytics |

---

## ۱۶) Caching Strategy

### ۱۶.۱ Tagهای کانونی (entity-aware)

| Tag | چه چیزی | invalidate توسط |
|---|---|---|
| `product:{id}` | صفحه/کارت یک محصول | update/delete محصول |
| `products` | فهرست‌ها، فروشگاه | هر تغییر کاتالوگ |
| `category:{slug}` | صفحه و فهرست دسته | تغییر دسته یا محصولاتش |
| `collection:{slug}` | صفحات کالکشن | تغییر کالکشن یا پیوندها |
| `homepage` | صفحه اصلی | تغییر هر بخش اصلی (پرفروش، کالکشن ویژه…) |
| `journal:{slug}` / `journal` | مقالات و فهرست | publish/update ژورنال |
| `settings` | هر جا StoreSettings مصرف شده | settings.update |
| `reviews:{productId}` | بلوک نظرات | moderate نظر |

**قاعده:** هر mutation فقط tagهای مرتبط را invalidate می‌کند (update محصول: `product:{id}` + `products` + `homepage` اگر در بخش‌های خانه حضور دارد + `category:{slug}`).

### ۱۶.۲ چه چیزی cache می‌شود / نمی‌شود

| ISR + tag (cache) | dynamic — هرگز cache |
|---|---|
| صفحه اصلی، محصول، دسته، کالکشن، ژورنال، صفحات ثابت | `/admin/**`، `/account`، `/checkout`، سبد و علاقه‌مندی، صفحات وضعیت سفارش، همه API Routes، هر پاسخ user-specific، `/shop` (فیلترها با searchParams — SSR زنده) |

---

## ۱۷) جستجوی فارسی

- موتور v1: **PostgreSQL Full-Text Search** (GIN) روی `Product.name`, `Product.shortDescription`, `Product.description`, `Variant.sku` — کافی برای کاتالوگ چندصدتایی (ADR-006).
- **نرمال‌سازی اجباری قبل از index و قبل از query:**
  - عربی→فارسی: `ي→ی` · `ك→ک`
  - نیم‌فاصله (`ZWNJ U+200C`) → یکسان‌سازی با فاصله در tokenizing
  - فشرده‌سازی فاصله‌های تکراری · lowercase برای لاتین
  - ارقام فارسی/عربی → لاتین (۰-۹ / ٠-٩ → 0-9)
- نرمال‌سازی در یک ماژول واحد (`src/domain/text/normalize-fa.ts`) — هم index-time هم query-time از همان تابع استفاده می‌کنند.
- ارتقای آینده (فقط در صورت نیاز واقعی): Meilisearch پشت همان `SearchService` — UI تغییر نمی‌کند.

---

## ۱۸) Settings تایپ‌شده

```text
StoreSettings
├── store:      { name, phone, email, instagram, aboutSummary }
├── shipping:   { flatFee, freeThreshold, estimatedDays, returnWindowDays }
├── social:     { instagram, telegram?, whatsapp? }
├── seo:        { titleSuffix, defaultDescription, ogImage }
├── payment:    { provider, windowMinutes }
└── notifications: { smsEnabled, emailEnabled, adminPhone }
```

- ذخیره‌سازی: جدول Setting (key/value Json) — ولی UI هرگز JSON خام نمی‌بیند؛ فقط `SettingsService.getStoreSettings(): StoreSettings` با Zod در مرز خواندن.
- تغییر تنظیمات = اعتبارسنجی کامل + audit + `revalidateTag("settings")`.
- اسکیمای Zod هر بخش، خروجی تایپ‌شده را تضمین می‌کند؛ کلید ناشناخته → خطا (strict).

---

## ۱۹) Provider Abstraction

هر وابستگی خارجی پشت یک interface واحد — تعویض سرویس‌دهنده = adapter جدید، بدون تغییر Business Logic:

```text
PaymentProvider { startPayment(order) → {redirectUrl, authority}
                  verifyPayment(authority) → {ok, transactionId?, amount, raw}
                  refundPayment(transactionId, amount) → {ok, providerRef?}
                  parseCallback(req) → {authority, status} }
SmsProvider     { send(phone, message) → {ok, providerMessageId?} }
EmailProvider   { send(to, subject, html) → {ok} }
StorageProvider { put(key, buffer, mime) → {key, url}
                  delete(key) · publicUrl(key) }
```

- Adapterهای v1: زرین‌پال (پیش‌فرض درگاه) · کاوه‌نگار (SMS) · SMTP (Email) · S3-compatible (Storage) + LocalStorageProvider برای توسعه.
- تبدیل واحد پول (IRT↔واحد درگاه) فقط داخل PaymentAdapter (بخش ۱۲).
- انتخاب Provider با env (`PAYMENT_PROVIDER=...`) — قابلیت تست با `MockPaymentProvider`.
- **پیاده‌سازی M5 (پرداخت):** `ZarinpalPaymentProvider` (PG v4 REST — request/verify/refund + StartPay) با حالت sandbox/live؛ تبدیل IRT→ریال (×10) فقط داخل adapter؛ callback مطلق از هدرهای درخواست ساخته می‌شود (x-forwarded-host پس از پراکسی). **انتخاب خودکار:** `PAYMENT_PROVIDER` صریح > `ZARINPAL_MERCHANT_ID` ست‌شده → زرین‌پال > وگرنه درگاه داخلی mock (سایت هرگز بدون درگاه گیر نمی‌کند — ADR 010).
- **خطای درگاه = شکست پرداخت، نه استثنا:** verify که با کد خطای درگاه (مثل 51- زرین‌پال) روبه‌رو شود درون `confirmPayment` به `failPayment` تبدیل می‌شود — پرداخت هرگز در PENDING گیر نمی‌کند.
- `buildResumeUrl(authority)` برای ادامهٔ تلاش PENDING موجود — URL درگاه هرگز در سرویس هاردکد نمی‌شود.

---

## ۲۰) Audit Log

- هر mutation ادمین → رکورد append-only: actor، action، entityType/entityId، before/after (Json)، ip، userAgent.
- نمونه: «Admin A — product.update — Product #123 — price: 800000 → 650000».
- اکشن‌های حساس اجباری: تغییر قیمت/موجودی، refund، تغییر نقش، تغییر تنظیمات، ورود ادمین (موفق/ناموفق).
- هیچ update/delete روی AuditLog (حتی SUPER_ADMIN) — خروجی فقط read و قابل export.
- UI ادمین: فیلتر بر اساس کاربر/نوع/بازه زمانی (`audit.read`).

---

## ۲۱) مدیا و امنیت آپلود

### ۲۱.۱ Storage

```text
StorageProvider (interface)
 ├── LocalStorageProvider  → فقط توسعه
 └── S3StorageProvider     → Production: S3-compatible (آروان/MinIO) → CDN → next/image
```

Production وابستگی اصلی به دیسک داخل Docker ندارد (ADR مستقل از Provider). کلیدها random (UUIDv7)، ساختار `uploads/{yyyy}/{mm}/{key}.{ext}`.

### ۲۱.۲ خط لوله امن آپلود (ترتیب اجباری)

```text
۱. سقف حجم (۵MB) و ابعاد پیکسلی (۴۰۹۶×۴۰۹۶)
۲. MIME whitelist + بررسی magic bytes (نه اعتماد به Content-Type کلاینت)
۳. اعتبار decode کامل تصویر (sharp)
۴. Filename sanitize + نام‌گذاری مجدد با key رندوم
۵. ثبت MediaObject (sha256 برای dedup)
۶. سرو از CDN/storage با Content-Type ثابت و X-Content-Type-Options: nosniff
```

- **SVG ممنوع در v1** (ریسک XSS)؛ در صورت نیاز آینده: sanitize سخت‌گیرانه + سرو از دامنه جدا.
- هیچ فایل آپلودی در دایرکتوری اجرایی سرور قرار نمی‌گیرد؛ اجرای هیچ فایل آپلودی ممکن نیست.
- پردازش تصویر (resize/WebP) خارج از tx، در Worker (بخش ۱۵).

### ۲۱.۳ Pipeline محتوای Markdown (ژورنال)

```text
Markdown (ادمین) → تبدیل به HTML → Sanitize (allowlist تگ‌ها) → ذخیره/رندر
```

هیچ HTML تولیدی از محتوای ادمین بدون Sanitize رندر نمی‌شود — حتی اگر نویسنده SUPER_ADMIN باشد.

---

## ۲۲) Deployment Architecture

```text
VPS ایرانی (نزدیکی کاربر + درگاه)
│
├─ Caddy (reverse proxy · TLS خودکار · HSTS)
│     └─► Next.js standalone (Docker) — output:standalone ✅ فاز ۱
│           ├─ Worker درون-پروسه‌ای (Outbox + انقضای رزرو + پاک‌سازی)
│           └─ /api/health
├─ PostgreSQL 16 (Docker · volume اختصاصی · WAL archiving)
│     ├─ Backup شبانه pg_dump (افزون بر WAL/PITR)
│     └─ تست Restore ماهانه: Backup → DB موقت → Restore → Integrity Check
├─ Object Storage S3-compatible → CDN → next/image
└─ Monitoring: /api/health + uptime check + error tracking + لاگ JSON
```

- **محیط‌ها:** development / staging / production — دیتابیس و `.env` کاملاً جدا.
- **Migration و Seed جدا:** `prisma/migrations` (پیشرونده، بازبینی‌شده) + `prisma/seed.ts` فقط برای توسعه؛ Production از seed توسعه پر نمی‌شود (داده واقعی از ادمین وارد می‌شود).
- Secretها فقط در env سرور؛ در کد/Git هرگز.
- استقرار = tag گیت + compose up + migration + healthcheck — هر مرحله قابل rollback.

---

## ۲۳) Testing Strategy

| لایه | پوشش الزامی |
|---|---|
| **Unit** | قیمت/تخفیف/کوپن (Integer، گرد کردن)، گذارهای وضعیت (جدول گذارهای مجاز/غیرمجاز)، `requirePermission` و ماتریس RBAC، سیاست OTP، نرمال‌سازی فارسی، mappingهای Repository |
| **Integration** (دیتابیس تست واقعی) | Checkout کامل (خوش‌مسیر)، **رزرو همزمان دو checkout روی آخرین موجودی (race)**، **callback تکراری (idempotency)**، سقف کوپن همزمان، انقضای رزرو، ماتریس دسترسی هر نقش (هر Role × هر Action)، merge سبد |
| **E2E** (Playwright) | مشتری: مرور→سبد→checkout→پرداخت (درگاه mock)→تأیید→پیگیری. ادمین: ورود→ایجاد محصول→انتشار→ویرایش→پردازش سفارش→refund |
| **Security** | چک هدرها (هر محیط)، IDOR خودکار، آپلود مخرب (MIME جعلی، SVG، exe-with-jpg-name)، تست «هر مسیر ادمین بدون session → 401»، dependency audit |
| **CI** | هر PR: lint + tsc + unit + integration — merge فقط سبز |

---

## ۲۴) استاندارد خطاها

```json
{ "error": { "code": "OUT_OF_STOCK", "message": "…متن فارسی کاربرپسند…", "requestId": "…" } }
```

| code | HTTP | معنا |
|---|---|---|
| `VALIDATION_ERROR` | 400 | ورودی نامعتبر (Zod) |
| `UNAUTHENTICATED` | 401 | بدون session / session منقضی |
| `FORBIDDEN` | 403 | session هست، permission نیست |
| `NOT_FOUND` | 404 | — |
| `OUT_OF_STOCK` | 409 | رزرو ناموفق |
| `COUPON_INVALID` | 422 | نامعتبر/منقضی/سقف پر |
| `PAYMENT_VERIFY_FAILED` | 402/409 | verify درگاه رد شد |
| `RATE_LIMITED` | 429 | + هدر Retry-After |
| `INTERNAL` | 500 | + requestId برای لاگ |

- خطای دامنه با کلاس `DomainError(code, message)` — Actionها به پاسخ استاندارد تبدیل می‌کنند؛ stack هرگز به کلاینت نمی‌رسد.

---

## ۲۵) ساختار پوشه‌های هدف (پس از تکمیل فاز ۲)

```text
src/
├── app/                 (فاز ۱ + admin/* — صفحات)
├── core/                (زیرساخت افقی)
│   ├── auth/            (session, guard, requirePermission)
│   ├── errors/  ├── rate-limit/  ├── audit/  ├── cache/
├── domain/
│   ├── models/          (قراردادهای تایپ — از src/types توسعه)
│   ├── state-machines/  (گذارهای مجاز)
│   ├── policies/        (قوانین کسب‌وکار: مرجوعی، OTP، ارسال)
│   └── text/            (normalize-fa)
├── repositories/        (Prisma ↔ Domain mapping)
├── services/            (فاز ۱ توسعه می‌یابد — همان امضاها)
├── providers/           (payment/ · sms/ · email/ · storage/)
├── workers/             (outbox-worker, reservation-expiry, cleanup)
├── data/                (mock — پس از M1 حذف می‌شود)
├── lib/ · hooks/ · store/ · components/ · fonts/
prisma/ (schema.prisma · migrations/ · seed.ts)
docs/   tests/ (unit · integration · e2e)
```

---

## ۲۶) Mapping فاز ۱ → فاز ۲

| فاز ۱ (الان) | فاز ۲ | تغییر برای UI |
|---|---|---|
| `src/data/*.ts` (mock) | Prisma + Repository | صفر — سرویس‌ها عوض می‌شوند |
| `src/services/*` (امضای ثابت) | همان امضا، پیاده‌سازی DB | صفر |
| `src/types/index.ts` | `src/domain/models` (گسترش) | صفر تا پایان M1 |
| `src/app/api/search` | کوئری FTS | صفر |
| `revalidate = 3600` | ISR + revalidateTag entity-aware | فقط config |
| سبد localStorage (مهمان) | + سبد سروری و merge | جزایر جدید، UX یکسان |
| چک‌اوت ۳ مرحله‌ای (mock) | CheckoutService تراکنشی | فقط submit |
| `/checkout/success` | صفحه نتیجه verify واقعی | props |
| فرم تماس/پیگیری (toast فاز ۲) | Action واقعی + SMS | صفر |

---

## ۲۷) Roadmap نهایی M0 تا M6

```text
M0 — Architecture Hardening  (پیش‌نیاز: این سند ✅)
├── ثبت docs/ARCHITECTURE.md در گیت
├── Domain contracts (گسترش types: Order, Payment, Reservation, Refund, …)
├── RBAC foundation (ثابت‌های permission + requirePermission + guard)
├── Auth foundation (schema session/otp در سند، پیاده‌سازی در M1+)
├── core/errors + استاندارد پاسخ خطا
├── Zod schemas مشترک v2
├── Security headers کامل + CSP-Report-Only
├── Rate-limit abstraction (پیاده‌سازی in-memory)
└── Provider interfaces (types — بدون پیاده‌سازی)
DoD: tsc/eslint صفر · UI فاز ۱ بدون تغییر رفتار · CI scaffold سبز

M1 — Data Layer
├── Prisma schema کامل (طبق بخش ۴) + migrations + seed توسعه
├── PostgreSQL + docker-compose dev
├── Repository Layer + نگاشت Domain
├── سوییچ Serviceها به DB + revalidateTag entity-aware
└── فروشگاه دیتابیس‌محور + /api/health + حذف src/data
DoD: همه صفحات فاز ۱ روی DB · داده = داده فعلی mock · golden path دستی سبز

M2 — Admin Core
├── Admin Auth (رمز + TOTP برای SUPER_ADMIN) + Session ادمین (بخش ۹.۳)
├── RBAC کامل (Role DB + seed نقش‌ها + requirePermission فعال)
├── Products / Categories / Collections CRUD + واریانت‌ها
├── Media (خط لوله امن ۲۱.۲ + S3/Local provider)
└── AuditLog + صفحه مشاهده
DoD: تست integration ماتریس RBAC سبز · هر mutation ادمین audited

M3 — Commerce Core
├── CartService + سبد سروری
├── InventoryService + Reservation + Worker انقضا
├── CheckoutService تراکنشی (بخش ۱۰.۱)
├── Coupons (مصرف transactional) + State Machineهای کامل
└── صفحات سفارش ادمین (گذار وضعیت، چاپ فاکتور)
DoD: تست race موجودی و سقف کوپن سبز · E2E checkout با درگاه mock

M4 — Customer
├── OTP امن (سیاست ۹.۴ — rate limit همزمان با ساخت endpoint)
├── Addresses + Customer Account + Order History
├── Cart Merge (مهمان → لاگین)
└── صفحه پیگیری سفارش واقعی (code)
DoD: تست‌های OTP abuse سبز · merge بدون گم شدن آیتم

M5 — Payments & Async
├── PaymentProvider (زرین‌پال adapter + Mock) + PaymentAttempts
├── Verify + Idempotency + Refund (بخش ۱۰–۱۱)
├── Outbox + Worker + SMS/Email قالب‌ها (بخش ۱۵)
├── برچسب «پرفروش» خودکار از تجمیع OrderItem (بخش ۴.۲.۱)
└── صفحات نتیجه پرداخت + reconciliation لاگ
DoD: duplicate callback ×3 بدون اثر مضاعف · sandbox: موفق/ناموفق/لغو سبز

M6 — Production Hardening
├── Rate limits نهایی + CSP سخت‌گیرانه (nonce)
├── Monitoring (health + uptime + error tracking) + لاگ JSON
├── Backup + WAL/PITR + تست Restore
├── Load Testing + Security Testing + E2E کامل
└── Deployment Production (بخش ۲۲) + چک‌لیست go-live
DoD: همه چک‌لیست‌ها سبز · سایت عملیاتی روی دامنه واقعی
```

**وابستگی‌ها:** M0 → M1 → M2 → M3 → (M4 ∥ M5) → M6. هر مایلستون: برنچ `feat/m{N}-*` + کامیت‌های مرحله‌ای.

---

## ۲۸) تصمیم‌های معماری ثبت‌شده (ADR خلاصه)

| ADR | تصمیم | دلیل / پیامد |
|---|---|---|
| 001 | تک‌اپ Next.js فول‌استک، بدون بک‌اند جدا | SSR/SSG حفظ می‌شود؛ لایه سرویس فاز ۱ سوییچ می‌شود؛ یک استک/دیپلوی |
| 002 | RBAC با `Role.permissions: String[]` (نه جدول join) | افزودن نقش/مجوز بدون تغییر schema؛ پیچیدگی کمتر، همان انعطاف |
| 003 | Outbox دیتابیسی + Worker درون-پروسه‌ای (بدون Redis روز اول) | تضمین‌های یکسان، صفر زیرساخت اضافه؛ ارتقای بعدی فقط Worker را عوض می‌کند |
| 004 | ارز canonical = IRT Integer؛ تبدیل واحد فقط در adapter درگاه | نمایش سایت تومان است؛ Float ممنوع در پول |
| 005 | Session دیتابیسی (نه صرفاً JWT) برای ادمین | revocation واقعی + idle-timeout + audit ورود |
| 006 | PostgreSQL FTS برای جستجوی v1 | کافی برای مقیاس فعلی؛ Meilisearch مسیر ارتقا پشت همان Service |
| 007 | Soft-delete برای کاتالوگ؛ منع مطلق delete برای رکوردهای مالی/تاریخی | تاریخچه سفارش هرگز نمی‌شکند |
| 008 | ~~برچسب‌های محصول دیتابیسی و ادمین‌پذیرند~~ — **مُنسوخه با ADR 011 (v2.4)**؛ جزء محاسباتی‌اش (تخفیف زنده از قیمت) همچنان معتبر است | تاریخ تصمیم: مالک ابتدا شفافیت داده خواست؛ با آمدن فروش واقعی (M5) به خودکارسازی کامل رسید |
| 009 | مدل `ContactMessage` (kind: CONTACT\|NEWSLETTER) — فرم تماس و خبرنامه به‌جای توست فیک فاز ۱، ردیف دیتابیسی می‌سازند که ادمین از `/admin/messages` می‌بیند؛ rate limit per IP + idempotent برای خبرنامه | حذف آخرین جریان فیک کاربر-رو؛ بدون درگاه ایمیل/SMS (فقط ذخیره) — ارسال واقعی پاسخ در M5 با Outbox |
| 010 | پرداخت دموی M5: اداپتور واقعی زرین‌پال (PG v4) با حالت sandbox به‌علاوه fallback خودکار به درگاه داخلی mock وقتی `ZARINPAL_MERCHANT_ID` ست نیست + دفتر `SmsLog` برای نمایش پیامک‌های آزمایشی در `/admin/sms` | مالک بدون ثبت‌نام هم دموی کامل دارد؛ با پذیرندگی سندباکس/واقعی فقط env عوض می‌شود؛ صداقت UI: دمو همیشه برچسب «پول خیالی» دارد و کارت سلامت داشبورد درگاه فعال را نشان می‌دهد |
| 011 | برچسب‌ها کاملاً محاسباتی‌اند (new / bestseller / limited از دادهٔ واقعی + آستانه‌های `store.badgeRules` قابل تغییر از ادمین)؛ ستون `Product.badges` و فیلد دستی فرم حذف شد؛ کارت ادمین از «پیشنهاد + تأیید» به «گزارش خودکار» تبدیل شد؛ زنجیرهٔ فروش ویترین را invalidate می‌کند؛ `revalidateTag` خارج از زمینهٔ درخواست best-effort | تصمیم مالک («خودکار» برای هر سه برچسب): برچسب فقط زمانی می‌چسبد که واقعاً کسب شده باشد؛ صفر نگهداری برای ادمین؛ گزارش پرفروش‌ها در داشبورد شفافیت را حفظ می‌کند — شرح کامل: بخش ۴.۲.۱ |

---

## ۲۹) مسیرهای ارتقای آینده (خارج از scope فعلی)

- Meilisearch در صورت رشد کاتالوگ (پشت SearchService) · BullMQ/Redis در صورت رشد volume رویدادها
- چندانباردهی / کد تخفیف زنجیره‌ای / برنامه وفاداری (امتیاز)
- Multi-currency (فیلد currency از روز اول آماده است) · COD (PaymentStatus AUTHORIZED)
- Wishlist سروری کامل (جدول از روز اول هست) · اعلان In-app ادمین
- گزارش‌گیری BI پیشرفته روی رپلیکا read-only

---

## ۳۰) نگهداری و نسخه‌بندی سند

- این سند مرجع رسمی M0 تا M6 است؛ **هر تغییر معماری** فقط با ADR جدید (بخش ۲۸) و bump شماره نسخه معتبر است.
- در شروع هر مایلستون، بخش‌های مرتبط این سند مرجع بازبینی کد (code review) قرار می‌گیرد.
- اگر بین این سند و کد تعارضی دیدید، **سند ملاک است** تا زمانی که با ADR اصلاح شود.

**تاریخچهٔ نسخه‌ها:**

| نسخه | تاریخ | تغییر |
|---|---|---|
| 2.0 | ۱۴۰۴/۰۷/۰۱ | تصویب اولیهٔ سند معماری فاز ۲ |
| 2.1 | ۱۴۰۴/۰۷/۰۴ | افزوده‌شدن بخش ۴.۲.۱ (سیستم برچسب‌ها — منبع حقیقت و قواعد نمایش) + ADR 008 + ردیف M5 برای «پرفروش» خودکار |
| 2.2 | ۱۴۰۴/۰۷/۰۴ | ممیزی کامل هاردکد: اتصال UI فروشگاه به Settings دیتابیس (ارسال/تماس/کالکشن ویژه/فیلترها) + ADR 009 (ContactMessage) + Setting جدید `home.featured` |
| 2.3 | ۱۴۰۴/۰۷/۰۴ | M5 — پیاده‌سازی Worker/Outbox (claim اتمیک + backoff + بازیابی crash + تایمر انقضای رزرو) + مدل SmsLog و قالب پیامک‌های فارسی + اداپتور زرین‌پال سندباکس با fallback خودکار (ADR 010) + جریان بازگشت وجه دو-tx + پرفروش خودکار از فروش واقعی (حذف سفارش مرجوع‌شده) |
| 2.4 | ۱۴۰۴/۰۷/۰۴ | ADR 011 به‌پرسش مالک «برچسب‌ها محاسبه می‌شوند؟»: هر سه برچسب new/bestseller/limited کاملاً خودکار از دادهٔ واقعی با آستانه‌های قابل تنظیم (`store.badgeRules` + کارت تنظیمات)؛ حذف ستون `Product.badges` و فیلد دستی فرم؛ بازنویسی بخش ۴.۲.۱؛ سرویس `badge-service` + invalidation ویترین در زنجیرهٔ فروش؛ نسخهٔ قبلی «پیشنهاد + تأیید ادمین» جایگزین شد |
