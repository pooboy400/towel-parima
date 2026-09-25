import Link from "next/link";
import { Instagram, Mail, MapPin, Phone } from "lucide-react";
import { Logo } from "./logo";
import { getCategories, getCollections } from "@/services/category-service";
import { getAllJournalSlugs } from "@/services/content-service";
import { getStoreSettingsSafe } from "@/services/settings-service";
import { toLatinDigits } from "@/lib/format";

/** سال جاری شمسی برای خط کپی‌رایت — دیگر عدد ثابت ۱۴۰۴ نیست */
function jalaliYear(): string {
  return new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
    year: "numeric",
  }).format(new Date());
}

/**
 * Footer — پرامپت 60: Shop / Help / Company / Legal / Contact / Social
 * اطلاعات تماس و آستانه‌ها از Settings دیتابیس؛ لینک‌های ژورنال داینامیک
 * (اگر مقاله حذف شده باشد به‌جای 404، به آرشیو ژورنال می‌رود).
 */
export async function Footer() {
  const [categories, collections, { config }, journalSlugs] = await Promise.all([
    getCategories(),
    getCollections(),
    getStoreSettingsSafe(),
    getAllJournalSlugs().catch(() => [] as string[]),
  ]);

  const telHref = `tel:${toLatinDigits(config.contact.phone)}`;
  const instagramHandle = `@${config.contact.instagram
    .replace(/\/+$/, "")
    .split(/[\\/]/)
    .pop()}`;
  const CARE_GUIDE_SLUG = "how-to-wash-towels";
  const careGuideHref = journalSlugs.includes(CARE_GUIDE_SLUG)
    ? `/journal/${CARE_GUIDE_SLUG}`
    : "/journal";

  return (
    <footer className="mt-auto border-t border-line bg-surface pb-[env(safe-area-inset-bottom)]">
      <div className="container-brand">
        <div className="grid grid-cols-2 gap-x-6 gap-y-10 py-12 md:grid-cols-4 lg:grid-cols-6 lg:py-16">
          {/* برند */}
          <div className="col-span-2 flex flex-col gap-4 lg:col-span-2">
            <Logo />
            <p className="max-w-xs text-[13px] leading-6 text-muted-foreground">
              حوله‌هایی با تمرکز بر کیفیت، نرمی و تجربه‌ای که هر روز لمس می‌کنید.
              پریما از پنبه شانه‌شده و بافت حلقه‌ای متراکم ساخته می‌شود.
            </p>
            <div className="flex flex-col gap-2.5 text-[13px] text-muted-foreground">
              <a
                href={telHref}
                className="flex items-center gap-2 transition-colors hover:text-foreground"
              >
                <Phone className="size-4" aria-hidden />
                {config.contact.phone}
              </a>
              <a
                href={`mailto:${config.contact.email}`}
                className="flex items-center gap-2 transition-colors hover:text-foreground"
              >
                <Mail className="size-4" aria-hidden />
                {config.contact.email}
              </a>
              <p className="flex items-start gap-2">
                <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden />
                {config.contact.address}
              </p>
            </div>
          </div>

          {/* فروشگاه */}
          <nav aria-label="فروشگاه">
            <h3 className="text-sm font-semibold">فروشگاه</h3>
            <ul className="mt-4 flex flex-col gap-2.5 text-[13px] text-muted-foreground">
              {categories.map((c) => (
                <li key={c.slug}>
                  <Link
                    href={`/shop/${c.slug}`}
                    className="transition-colors hover:text-foreground"
                  >
                    {c.name}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* کالکشن‌ها */}
          <nav aria-label="کالکشن‌ها">
            <h3 className="text-sm font-semibold">کالکشن‌ها</h3>
            <ul className="mt-4 flex flex-col gap-2.5 text-[13px] text-muted-foreground">
              {collections.map((c) => (
                <li key={c.slug}>
                  <Link
                    href={`/collections/${c.slug}`}
                    className="transition-colors hover:text-foreground"
                  >
                    {c.name}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* راهنما */}
          <nav aria-label="راهنما">
            <h3 className="text-sm font-semibold">راهنما</h3>
            <ul className="mt-4 flex flex-col gap-2.5 text-[13px] text-muted-foreground">
              <li>
                <Link href="/faq" className="transition-colors hover:text-foreground">
                  سؤالات پرتکرار
                </Link>
              </li>
              <li>
                <Link href="/shipping" className="transition-colors hover:text-foreground">
                  ارسال و تحویل
                </Link>
              </li>
              <li>
                <Link href="/returns" className="transition-colors hover:text-foreground">
                  مرجوعی و تعویض
                </Link>
              </li>
              <li>
                <Link href={careGuideHref} className="transition-colors hover:text-foreground">
                  راهنمای نگهداری
                </Link>
              </li>
              <li>
                <Link href="/order-tracking" className="transition-colors hover:text-foreground">
                  پیگیری سفارش
                </Link>
              </li>
            </ul>
          </nav>

          {/* شرکت */}
          <nav aria-label="پریما">
            <h3 className="text-sm font-semibold">پریما</h3>
            <ul className="mt-4 flex flex-col gap-2.5 text-[13px] text-muted-foreground">
              <li>
                <Link href="/about" className="transition-colors hover:text-foreground">
                  داستان برند
                </Link>
              </li>
              <li>
                <Link href="/contact" className="transition-colors hover:text-foreground">
                  تماس با ما
                </Link>
              </li>
              <li>
                <Link href="/journal" className="transition-colors hover:text-foreground">
                  ژورنال
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="transition-colors hover:text-foreground">
                  حریم خصوصی
                </Link>
              </li>
              <li>
                <Link href="/terms" className="transition-colors hover:text-foreground">
                  شرایط استفاده
                </Link>
              </li>
            </ul>
          </nav>
        </div>

        <div className="flex flex-col items-center justify-between gap-4 border-t border-line py-6 sm:flex-row">
          <p className="text-xs text-muted-foreground">
            © {jalaliYear()} پریما — همه حقوق محفوظ است.
          </p>
          <a
            href={config.contact.instagram}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            <Instagram className="size-4" aria-hidden />
            {instagramHandle}
          </a>
        </div>
      </div>
    </footer>
  );
}
