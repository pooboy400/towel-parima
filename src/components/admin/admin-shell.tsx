"use client";

/**
 * AdminShell — اسکلت پنل: سایدبار راست (RTL) + نوار بالا + محتوا (M2)
 * فیلتر منو بر اساس مجوزها فقط UX است — امنیت واقعی در requirePermission (§2.2).
 */

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { toast } from "sonner";
import { Menu, X, LogOut, KeyRound, ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ROLE_TITLES } from "@/lib/admin/role-titles";
import { ADMIN_NAV } from "@/lib/admin/nav";
import { adminLogoutAction } from "@/app/admin/login/actions";
import { NotificationsBell } from "./notifications-bell";

interface AdminShellProps {
  actorName: string;
  actorRole: string;
  actorEmail: string | null;
  children: React.ReactNode;
}

export function AdminShell({ actorName, actorRole, children }: AdminShellProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const roleTitle = ROLE_TITLES[actorRole] ?? actorRole;

  const sidebar = (
    <div className="flex h-full flex-col bg-deep text-cream">
      {/* برند */}
      <div className="px-6 py-6 border-b border-white/10">
        <Link href="/admin" className="block">
          <p className="text-xl font-bold tracking-tight">پریما</p>
          <p className="text-[11px] text-sand mt-0.5">پنل مدیریت فروشگاه</p>
        </Link>
      </div>

      {/* منو */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6" aria-label="منوی پنل">
        {ADMIN_NAV.map((section) => {
          const items = section.items;
          if (!items.length) return null;
          return (
            <div key={section.title}>
              <p className="px-3 mb-2 text-[11px] font-medium text-cream/40">{section.title}</p>
              <ul className="space-y-1">
                {items.map((item) => {
                  const active =
                    item.href === "/admin"
                      ? pathname === "/admin"
                      : pathname.startsWith(item.href);
                  const Icon = item.icon;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={() => setMobileOpen(false)}
                        className={cn(
                          "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
                          active
                            ? "bg-white/10 text-cream font-semibold"
                            : "text-cream/70 hover:bg-white/5 hover:text-cream",
                        )}
                      >
                        <Icon className="size-4.5 shrink-0" />
                        <span className="flex-1">{item.label}</span>
                        {active && <ChevronLeft className="size-3.5 text-sand" />}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>

      <div className="px-4 py-4 border-t border-white/10 text-[11px] text-cream/40">
        دسترسی‌ها بر اساس نقش شما محدود شده است
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-cream text-ink">
      {/* سایدبار دسکتاپ — در RTL سمت راست */}
      <aside className="hidden lg:fixed lg:inset-y-0 lg:right-0 lg:w-64 lg:block z-30">
        {sidebar}
      </aside>

      {/* منوی موبایل */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-ink/50"
            onClick={() => setMobileOpen(false)}
            aria-hidden
          />
          <div className="absolute inset-y-0 right-0 w-72 shadow-xl">
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute top-4 left-3 z-10 text-cream/70 hover:text-cream"
              aria-label="بستن منو"
            >
              <X className="size-5" />
            </button>
            {sidebar}
          </div>
        </div>
      )}

      <div className="lg:mr-64 flex flex-col min-h-screen">
        {/* نوار بالا */}
        <header className="sticky top-0 z-20 bg-cream/90 backdrop-blur border-b border-line">
          <div className="flex items-center gap-3 px-4 sm:px-6 h-16">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="باز کردن منو"
            >
              <Menu className="size-5" />
            </Button>

            <div className="flex-1" />

            <NotificationsBell />

            {/* منوی کاربر */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 rounded-xl px-2 py-1.5 hover:bg-sand-soft transition-colors">
                  <span className="size-9 rounded-xl bg-terracotta text-white flex items-center justify-center text-sm font-bold">
                    {(actorName || "م").slice(0, 1)}
                  </span>
                  <span className="hidden sm:block text-right">
                    <span className="block text-sm font-semibold leading-4">{actorName}</span>
                    <span className="block text-[11px] text-stone-muted">{roleTitle}</span>
                  </span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuLabel>
                  <span className="block font-semibold">{actorName}</span>
                  <span className="block text-xs text-stone-muted font-normal">{roleTitle}</span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/admin/account" className="cursor-pointer">
                    <KeyRound className="size-4" />
                    تغییر رمز عبور
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="cursor-pointer text-destructive focus:text-destructive"
                  onSelect={(e) => {
                    e.preventDefault();
                    void adminLogoutAction();
                  }}
                >
                  <LogOut className="size-4" />
                  خروج از پنل
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="flex-1 px-4 sm:px-6 py-6">{children}</main>

        <footer className="px-6 py-4 text-center text-[11px] text-stone-muted border-t border-line">
          پنل مدیریت پریما — همه فعالیت‌ها در دفتر رویدادها ثبت می‌شود
        </footer>
      </div>
    </div>
  );
}
