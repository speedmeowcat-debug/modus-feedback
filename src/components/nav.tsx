"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, ChartColumn, Inbox, LayoutDashboard, ListChecks, Settings, type LucideIcon } from "lucide-react";
import { cx } from "./ui";

export type NavKey = "overview" | "queue" | "analytics" | "admin" | "my" | "notifications";
export type NavItem = { key: NavKey; href: string; label: string; short: string; count?: number };

const ICONS: Record<NavKey, LucideIcon> = {
  overview: LayoutDashboard,
  queue: ListChecks,
  analytics: ChartColumn,
  admin: Settings,
  my: Inbox,
  notifications: Bell,
};

const isActive = (pathname: string, item: NavItem) =>
  item.key === "admin" ? pathname.startsWith("/admin") : pathname === item.href || pathname.startsWith(`${item.href}/`);

function Count({ n, active }: { n?: number; active: boolean }) {
  if (!n) return null;
  return (
    <span
      className={cx(
        "num ml-auto min-w-5 rounded-full px-1.5 text-center text-xs leading-5 font-medium",
        active ? "bg-accent text-white" : "bg-neutral-soft text-ink",
      )}
    >
      {n > 99 ? "99+" : n}
    </span>
  );
}

export function SideNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Разделы" className="flex flex-col gap-0.5">
      {items.map((item) => {
        const Icon = ICONS[item.key];
        const active = isActive(pathname, item);
        return (
          <Link
            key={item.key}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cx(
              "flex h-9 items-center gap-2.5 rounded-control px-2.5 text-[15px] transition-colors",
              active ? "bg-accent-soft font-medium text-accent-ink" : "text-ink hover:bg-sunken",
            )}
          >
            <Icon className={cx("size-[18px] shrink-0", active ? "text-accent" : "text-muted")} aria-hidden />
            {item.label}
            <Count n={item.count} active={active} />
            {item.count ? <span className="sr-only">, требуют внимания</span> : null}
          </Link>
        );
      })}
    </nav>
  );
}

export function BottomNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Разделы"
      className="fixed inset-x-0 bottom-0 z-30 flex border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      {items.map((item) => {
        const Icon = ICONS[item.key];
        const active = isActive(pathname, item);
        return (
          <Link
            key={item.key}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cx(
              "relative flex min-w-0 flex-1 flex-col items-center gap-0.5 px-1 pt-2 pb-1.5 text-[11px]",
              active ? "font-medium text-accent-ink" : "text-muted",
            )}
          >
            <span className="relative">
              <Icon className="size-5" aria-hidden />
              {item.count ? (
                <span className="num absolute -top-1.5 left-3 min-w-4 rounded-full bg-accent px-1 text-center text-[10px] leading-4 font-medium text-white">
                  {item.count > 99 ? "99+" : item.count}
                </span>
              ) : null}
            </span>
            <span className="max-w-full truncate">{item.short}</span>
          </Link>
        );
      })}
    </nav>
  );
}
