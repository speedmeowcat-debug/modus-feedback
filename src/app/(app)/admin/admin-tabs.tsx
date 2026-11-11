"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "@/components/ui";

const TABS = [
  { href: "/admin/categories", label: "Категории" },
  { href: "/admin/routing", label: "Маршрутизация" },
  { href: "/admin/users", label: "Пользователи" },
  { href: "/admin/settings", label: "Параметры" },
];

export function AdminTabs() {
  const pathname = usePathname();
  return (
    <nav aria-label="Разделы настроек" className="mb-5 flex gap-5 overflow-x-auto overflow-y-hidden border-b border-line">
      {TABS.map((t) => {
        const active = pathname === t.href;
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={cx(
              "shrink-0 border-b-2 px-0.5 pb-2.5 text-[15px] transition-colors",
              active ? "border-accent font-medium text-ink" : "border-transparent text-muted hover:text-ink",
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
