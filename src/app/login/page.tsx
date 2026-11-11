import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { getActor, homeFor, isDemoMode } from "@/lib/auth";
import { ROLE_LABEL, type Role } from "@/lib/domain";
import { DemoAccounts, LoginForm, type DemoAccount } from "./login-form";

export const metadata: Metadata = { title: "Вход" };
export const dynamic = "force-dynamic";

// Аккаунты, которые нужны для основного сценария демонстрации, показываются первыми.
const FEATURED: Record<string, string> = {
  zakupki: "Подаёт обращения и следит за их статусом",
  "ruk.zakupok": "Рассматривает обращения, видит подразделение «Закупки»",
  it: "Работает со своей очередью обращений",
  admin: "Категории, маршрутизация, пользователи, вся аналитика",
};

export default async function LoginPage() {
  const actor = await getActor();
  if (actor) redirect(homeFor(actor.role));

  let demo: DemoAccount[] = [];
  if (isDemoMode()) {
    const db = await getDb();
    const rows = await db.query<{ id: number; login: string; name: string; role: Role; department: string | null }>(
      `SELECT u.id, u.login, u.name, u.role, d.name AS department
         FROM users u LEFT JOIN departments d ON d.id = u.department_id
        WHERE u.is_demo AND u.is_active ORDER BY u.id`,
    );
    const order = Object.keys(FEATURED);
    demo = rows
      .map((r) => ({
        id: r.id,
        name: r.name,
        role: ROLE_LABEL[r.role],
        department: r.department,
        note: FEATURED[r.login] ?? null,
        rank: order.indexOf(r.login),
      }))
      .sort((a, b) => (a.rank < 0 ? 99 : a.rank) - (b.rank < 0 ? 99 : b.rank));
  }

  return (
    <main className="mx-auto grid min-h-dvh max-w-[1080px] items-start gap-10 px-5 py-10 sm:px-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-center lg:gap-16 lg:py-16">
      <div className="max-w-md">
        <div className="flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-[8px] bg-accent text-base font-semibold text-white" aria-hidden>
            М
          </span>
          <span className="text-sm text-muted">ГК «Модус Трейд»</span>
        </div>
        <h1 className="mt-6 text-[32px] leading-[1.15] font-semibold tracking-[-0.015em]">Обратная связь и предложения сотрудников</h1>
        <p className="mt-3 text-muted">
          Сообщите о проблеме, предложите улучшение или оставьте отзыв. Обращение получит номер и ответственного, а вы
          увидите ход рассмотрения и итог.
        </p>
        <div className="mt-8">
          <LoginForm />
        </div>
      </div>

      {demo.length > 0 && <DemoAccounts accounts={demo} />}
    </main>
  );
}
