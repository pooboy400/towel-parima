/**
 * Admin Panel Navigation — منوی پنل با نگاشت مجوز (بخش ۶ سند)
 * ---------------------------------------------------------------
 * UI فقط UX است — امنیت در requirePermission هر صفحه/اکشن.
 * آیتم‌ها بر اساس مجوز کاربر فیلتر می‌شوند.
 */

import {
  LayoutDashboard,
  Package,
  Images,
  FolderTree,
  Layers,
  FileText,
  HelpCircle,
  MessageSquareQuote,
  MessageSquareText,
  Inbox,
  Settings,
  Users,
  ScrollText,
  Bell,
  ShoppingBag,
  type LucideIcon,
} from "lucide-react";
import type { Permission } from "@/core/auth/permissions";

export interface AdminNavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  permission: Permission;
  /** badge live از API اعلان‌ها */
  badgeKey?: "pendingReviews" | "lowStock";
}

export interface AdminNavSection {
  title: string;
  items: AdminNavItem[];
}

export const ADMIN_NAV: AdminNavSection[] = [
  {
    title: "نمای کلی",
    items: [
      {
        href: "/admin",
        label: "داشبورد",
        icon: LayoutDashboard,
        permission: "analytics.read",
      },
      {
        href: "/admin/notifications",
        label: "اعلان‌ها",
        icon: Bell,
        permission: "analytics.read",
        badgeKey: "pendingReviews",
      },
    ],
  },
  {
    title: "کاتالوگ",
    items: [
      {
        href: "/admin/products",
        label: "محصولات",
        icon: Package,
        permission: "products.read",
        badgeKey: "lowStock",
      },
      {
        href: "/admin/categories",
        label: "دسته‌بندی‌ها",
        icon: FolderTree,
        permission: "products.read",
      },
      {
        href: "/admin/collections",
        label: "کالکشن‌ها",
        icon: Layers,
        permission: "products.read",
      },
    ],
  },
  {
    title: "فروش",
    items: [
      {
        href: "/admin/orders",
        label: "سفارش‌ها",
        icon: ShoppingBag,
        permission: "orders.read",
      },
    ],
  },
  {
    title: "محتوا و رسانه",
    items: [
      {
        href: "/admin/media",
        label: "رسانه",
        icon: Images,
        permission: "media.read",
      },
      {
        href: "/admin/journal",
        label: "مقالات مجله",
        icon: FileText,
        permission: "content.read",
      },
      {
        href: "/admin/faq",
        label: "سوالات متداول",
        icon: HelpCircle,
        permission: "content.read",
      },
      {
        href: "/admin/reviews",
        label: "نظرات مشتریان",
        icon: MessageSquareQuote,
        permission: "reviews.read",
        badgeKey: "pendingReviews",
      },
      {
        href: "/admin/messages",
        label: "پیام‌ها و خبرنامه",
        icon: Inbox,
        permission: "content.read",
      },
    ],
  },
  {
    title: "سیستم",
    items: [
      {
        href: "/admin/settings",
        label: "تنظیمات فروشگاه",
        icon: Settings,
        permission: "settings.read",
      },
      {
        href: "/admin/sms",
        label: "پیامک‌های آزمایشی",
        icon: MessageSquareText,
        permission: "orders.read",
      },
      {
        href: "/admin/staff",
        label: "کارکنان و نقش‌ها",
        icon: Users,
        permission: "users.read",
      },
      {
        href: "/admin/audit",
        label: "دفتر رویدادها",
        icon: ScrollText,
        permission: "audit.read",
      },
    ],
  },
];
