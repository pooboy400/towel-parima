# 🔄 راهنمای Rollback — بازگشت به هر مرحله

> **فایل امن است** — حاوی رمز نیست؛ فقط راهنمای گیت.
> آخرین به‌روزرسانی: پس از باتری نهایی ۶۷ (کامیت `30253c0`)

## Checkpointهای رسمی (تگ‌ها)

| تگ | مرحله | چه چیزی داخلش است |
|---|---|---|
| `phase-1-complete` | پایان فاز ۱ | امنیت حیاتی SEC-01..07 + ۸ تعقیبی — پروژهٔ قبل از هر تغییر فاز ۲+ |
| `phase-2-complete` | پایان فاز ۲ (+باتری ۱) | رفع ۵ باگ پول/دیتا + ۱۷ تست پذیرش + رفع یافته‌های باتری ۸ ایجنت اول |
| `phase-3-complete` | پایان فاز ۳ | بهداشت کد: SEC-08..14، BUG-06..16، UX-12/14 + بک‌لاگ باتری |
| `phase-4-complete` | پایان فاز ۴ | UI/UX: wishlist DB، آمار نظرات صادقانه، favicon، کنتراست، OTP paste، نام پروفایل و... |
| `phase-5-complete` | پایان فاز ۵ | سئو: FAQPage JSON-LD، ژورنال h2/تصویر، CTA اختصاصی، scroll-behavior |
| `phase-6-complete` | پایان فاز ۶ | زیرساخت: sharp 0.35، CSP nonce، HMAC proof، refund قفل‌شده، origins env-driven و... |

## وضعیت گیت‌هاب

همهٔ تگ‌ها + main روی گیت‌هاب هستند (`pooboy400/towel-parima`).
⇒ حتی اگر سندباکس دوباره ریست شود، **هیچ‌کدام از این نقاط از دست نمی‌رود**
(برخلاف تجربهٔ ریست محیط که فقط `phase-1` نجات داشت).

## بازگشت به یک مرحله — سه روش

### ۱) نگاه موقت (بدون تغییر شاخه — امن‌ترین)
```bash
git checkout phase-3-complete        # حالت detach — فقط برای دیدن/تست
# برگشت:
git checkout main
```

### ۲) برگشت واقعی main به یک مرحله (destructive — تغییرات بعدی دور ریخته می‌شود)
```bash
# ۰) بکاپ از وضعیت فعلی (همیشه اول این را بزن)
git branch backup-$(date +%Y%m%d-%H%M)

# ۱) برگشت
git reset --hard phase-3-complete

# ۲) اگر قبلاً پوش شده، گیت‌هاب هم هم‌تراز شود (تاریخچه بازنویسی می‌شود)
git push --force origin main

# ۳) برگشت از برگشت (اگر پشیمان شدی)
git reset --hard backup-YYYYMMDD-HHMM
git push --force origin main
```

### ۳) برگشت امن با حفظ تاریخچه (revert — برای محیط مشترک)
```bash
git revert --no-commit 35bc307..HEAD   # کامیت‌های بعد از فاز ۶ معکوس می‌شوند
git commit -m "revert: back to phase-6-complete state"
git push origin main
```

## برای یک فایل/پوشهٔ خاص
```bash
git checkout phase-4-complete -- src/store/cart-store.ts   # فقط این فایل از فاز ۴
git commit -m "restore: cart-store from phase-4"
```

## لیست تگ‌ها و کامیت‌ها
```bash
git tag -l                      # همهٔ checkpointها
git log --oneline -20           # تاریخچهٔ اخیر
git show phase-4-complete --stat  # محتوای یک مرحله
```

## قواعد برای آینده
- هر مرحله/فیچر جدید → `git tag <name>-complete` + push تگ (بیمه در برابر ریست سندباکس)
- رمزهای ادمین: فقط `/home/z/my-project/.secrets/` (خارج از ریپو) — هرگز در worklog/گزارش
- قبل از هر `reset --hard`: اول `git branch backup-...`
