import type { Metadata } from "next";
import Link from "next/link";
import { Card, SectionTitle, Tag } from "@/components/ui";
import { getDb } from "@/db";
import { requireActor } from "@/lib/auth";
import { TYPE_LABEL } from "@/lib/domain";
import { getAdminSettings, listRules } from "@/lib/services/admin";
import { listAssignable, listFormOptions } from "@/lib/services/tickets";
import { RouteTester, RuleCreateForm, RuleDeleteButton } from "../admin-forms";

export const metadata: Metadata = { title: "Маршрутизация" };

export default async function RoutingPage() {
  const actor = await requireActor();
  if (actor.role !== "admin") return null;
  const db = await getDb();
  const [rules, options, assignable, settings] = await Promise.all([
    listRules(db, actor),
    listFormOptions(db),
    listAssignable(db),
    getAdminSettings(db, actor),
  ]);
  const assignees = assignable.map((u) => ({ id: u.id, name: u.is_absent ? `${u.name} (отсутствует)` : u.name }));
  const fallback = assignable.find((u) => u.id === settings.fallbackAssigneeId);

  return (
    <div className="space-y-5">
      <Card className="p-5 sm:p-6">
        <SectionTitle>Как назначается ответственный</SectionTitle>
        <ol className="max-w-3xl list-decimal space-y-1.5 pl-5 text-muted marker:text-faint">
          <li>Берутся правила выбранной категории. Правило с указанным типом или подразделением важнее общего.</li>
          <li>Обращение получает первый доступный ответственный: активный и не отмеченный как отсутствующий.</li>
          <li>
            Если правила нет или ответственный недоступен, обращение получает резервный ответственный:{" "}
            <span className="text-ink">{fallback?.name ?? "не выбран"}</span>.{" "}
            <Link href="/admin/settings" className="text-accent-ink underline underline-offset-2">
              Изменить
            </Link>
          </li>
          <li>Причина назначения записывается в историю обращения.</li>
        </ol>
      </Card>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card className="p-5 sm:p-6">
          <SectionTitle>Новое правило</SectionTitle>
          <RuleCreateForm categories={options.categories} departments={options.departments} assignees={assignees} />
        </Card>
        <Card className="p-5 sm:p-6">
          <SectionTitle hint="Ничего не сохраняет">Проверка: кто получит обращение</SectionTitle>
          <RouteTester categories={options.categories} departments={options.departments} />
        </Card>
      </div>

      <Card>
        <div className="px-4 pt-5 sm:px-5">
          <SectionTitle>Правила ({rules.length})</SectionTitle>
        </div>
        <div
          aria-hidden
          className="hidden grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1.2fr)_40px] gap-4 border-y border-line px-5 py-2 text-xs font-medium tracking-wide text-muted uppercase md:grid"
        >
          <span>Категория</span>
          <span>Условия</span>
          <span>Ответственный</span>
          <span />
        </div>
        <ul className="divide-y divide-line max-md:border-t max-md:border-line">
          {rules.map((r) => {
            const cond = [r.type ? TYPE_LABEL[r.type] : null, r.department_name].filter(Boolean).join(", ") || "Любое обращение";
            return (
              <li
                key={r.id}
                className="grid grid-cols-[minmax(0,1fr)_40px] items-center gap-x-4 gap-y-0.5 px-4 py-2.5 sm:px-5 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1.2fr)_40px]"
              >
                <span className="font-medium max-md:col-start-1">
                  {r.category_name}
                  {!r.category_active && <span className="ml-2"><Tag>Отключена</Tag></span>}
                </span>
                <span className="text-muted max-md:col-start-1 max-md:text-sm">{cond}</span>
                <span className="flex flex-wrap items-center gap-2 max-md:col-start-1">
                  {r.assignee_name}
                  {r.assignee_absent && <Tag tone="warn">Отсутствует</Tag>}
                  {!r.assignee_active && <Tag tone="danger">Отключён</Tag>}
                </span>
                <span className="max-md:col-start-2 max-md:row-span-3 max-md:row-start-1">
                  <RuleDeleteButton id={r.id} label={`${r.category_name} → ${r.assignee_name}`} />
                </span>
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
}
