import type { Metadata } from "next";
import { Card, SectionTitle } from "@/components/ui";
import { getDb } from "@/db";
import { requireActor } from "@/lib/auth";
import { fmtDateTime } from "@/lib/format";
import { getAdminSettings, listAudit } from "@/lib/services/admin";
import { listAssignable } from "@/lib/services/tickets";
import { SettingsForm } from "../admin-forms";

export const metadata: Metadata = { title: "Параметры" };

export default async function SettingsPage() {
  const actor = await requireActor();
  if (actor.role !== "admin") return null;
  const db = await getDb();
  const [settings, assignable, audit] = await Promise.all([
    getAdminSettings(db, actor),
    listAssignable(db),
    listAudit(db, actor),
  ]);
  return (
    <div className="space-y-5">
      <Card className="p-5 sm:p-6">
        <SectionTitle>Параметры рассмотрения</SectionTitle>
        <SettingsForm
          assignees={assignable.map((u) => ({ id: u.id, name: u.is_absent ? `${u.name} (отсутствует)` : u.name }))}
          fallbackAssigneeId={settings.fallbackAssigneeId}
          firstResponseHours={settings.firstResponseHours}
        />
        <p className="mt-4 text-sm text-muted">
          Срок рассмотрения задаётся отдельно для каждой категории на вкладке «Категории». Время в системе: Павлодар,
          UTC+5.
        </p>
      </Card>
      <Card className="p-5 sm:p-6">
        <SectionTitle hint="Последние 30 записей">Журнал изменений настроек</SectionTitle>
        {audit.length === 0 ? (
          <p className="text-muted">Настройки ещё не менялись.</p>
        ) : (
          <ul className="divide-y divide-line">
            {audit.map((a) => (
              <li key={a.id} className="flex flex-wrap items-baseline gap-x-4 gap-y-0.5 py-2.5">
                <span className="min-w-0 flex-1">
                  <span className="font-medium">{a.action}</span>
                  {a.details && <span className="text-muted">: {a.details}</span>}
                </span>
                <span className="num text-sm whitespace-nowrap text-muted">
                  {a.actor_name ?? "Система"} · {fmtDateTime(a.created_at)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
