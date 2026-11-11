import Link from "next/link";
import { Bell, LogOut, Plus } from "lucide-react";
import { logoutAction } from "@/app/actions";
import { BottomNav, SideNav, type NavItem } from "@/components/nav";
import { buttonClass } from "@/components/ui";
import { getDb } from "@/db";
import { isDemoMode, requireActor } from "@/lib/auth";
import { ROLE_LABEL } from "@/lib/domain";
import { unreadCount } from "@/lib/services/notifications";

export const dynamic = "force-dynamic";

function Brand() {
  return (
    <Link href="/" className="flex min-w-0 items-center gap-2 rounded-control sm:gap-2.5">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-[7px] bg-accent text-[15px] font-semibold text-white" aria-hidden>
        М
      </span>
      <span className="leading-tight">
        <span className="block text-sm font-semibold whitespace-nowrap sm:text-[15px]">Обратная связь</span>
        <span className="block text-xs whitespace-nowrap text-muted max-sm:hidden">ГК «Модус Трейд»</span>
      </span>
    </Link>
  );
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const actor = await requireActor();
  const db = await getDb();
  const [unread, [{ c: queueCount }]] = await Promise.all([
    unreadCount(db, actor),
    db.query<{ c: number }>(
      "SELECT count(*)::int AS c FROM tickets WHERE assignee_id = $1 AND status IN ('new','in_review','in_progress')",
      [actor.id],
    ),
  ]);

  const handles = actor.role !== "employee";
  const supervises = actor.role === "manager" || actor.role === "admin";
  const items: NavItem[] = [
    supervises && {
      key: "overview" as const,
      href: "/overview",
      label: actor.role === "admin" ? "Все обращения" : "Обзор",
      short: actor.role === "admin" ? "Все" : "Обзор",
    },
    handles && { key: "queue" as const, href: "/queue", label: "Моя очередь", short: "Очередь", count: queueCount },
    supervises && { key: "analytics" as const, href: "/analytics", label: "Аналитика", short: "Аналитика" },
    actor.role === "admin" && { key: "admin" as const, href: "/admin/categories", label: "Настройки", short: "Настройки" },
    { key: "my" as const, href: "/my", label: "Мои обращения", short: "Мои" },
  ].filter(Boolean) as NavItem[];
  const bell: NavItem = { key: "notifications", href: "/notifications", label: "Уведомления", short: "Увед.", count: unread };

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[248px_minmax(0,1fr)]">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-control focus:bg-surface focus:px-3 focus:py-2 focus:shadow-pop"
      >
        Перейти к содержимому
      </a>

      {/* Боковая панель: от 1024 px */}
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-line bg-surface px-3 py-4 lg:flex">
        <div className="px-1.5">
          <Brand />
        </div>
        <Link href="/tickets/new" className={buttonClass("primary", "md", "mt-5 w-full")}>
          <Plus className="size-4" aria-hidden />
          Новое обращение
        </Link>
        <div className="mt-5 flex-1 overflow-y-auto">
          <SideNav items={[...items, bell]} />
        </div>
        <div className="border-t border-line pt-3">
          <div className="px-2.5">
            <p className="truncate text-sm font-medium" title={actor.name}>
              {actor.name}
            </p>
            <p className="truncate text-xs text-muted">
              {ROLE_LABEL[actor.role]}
              {actor.departmentName ? ` · ${actor.departmentName}` : ""}
            </p>
            {isDemoMode() && <p className="mt-1 text-xs text-muted">Тестовый аккаунт</p>}
          </div>
          <form action={logoutAction} className="mt-2">
            <button type="submit" className={buttonClass("ghost", "sm", "w-full justify-start !px-2.5 text-muted")}>
              <LogOut className="size-4" aria-hidden />
              Выйти
            </button>
          </form>
        </div>
      </aside>

      {/* Верхняя панель: телефон и планшет */}
      <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-line bg-surface px-3 sm:px-4 lg:hidden">
        <Brand />
        <div className="ml-auto flex items-center gap-1">
          <Link href="/notifications" className={buttonClass("ghost", "sm", "relative !w-8 !px-0 sm:!w-9")} aria-label={`Уведомления${unread ? `, непрочитанных: ${unread}` : ""}`}>
            <Bell className="size-[18px]" aria-hidden />
            {unread > 0 && <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-danger" aria-hidden />}
          </Link>
          <form action={logoutAction}>
            <button type="submit" className={buttonClass("ghost", "sm", "!w-8 !px-0 sm:!w-9")} aria-label={`Выйти (${actor.name})`}>
              <LogOut className="size-[18px]" aria-hidden />
            </button>
          </form>
          <Link href="/tickets/new" className={buttonClass("primary", "sm", "ml-1 !px-2.5 sm:!px-3")}>
            <Plus className="size-4" aria-hidden />
            Создать
          </Link>
        </div>
      </header>

      <main id="main" className="min-w-0 px-4 pt-6 pb-28 sm:px-6 lg:px-10 lg:pt-9 lg:pb-16">
        <div className="mx-auto max-w-[1160px]">{children}</div>
      </main>

      <BottomNav items={items.length < 4 ? [...items, bell] : items} />
    </div>
  );
}
