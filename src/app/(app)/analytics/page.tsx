import type { Metadata } from "next";
import Link from "next/link";
import { ChartColumn } from "lucide-react";
import { Denied } from "@/components/denied";
import { BarRow, Card, EmptyState, Notice, PageHeader, SectionTitle, StatusBadge, cx } from "@/components/ui";
import { getDb } from "@/db";
import { requireActor } from "@/lib/auth";
import { STATUSES, STATUS_LABEL, TYPE_LABEL } from "@/lib/domain";
import { fmtHours, plural } from "@/lib/format";
import { computeAnalytics, type Source } from "@/lib/services/analytics";

export const metadata: Metadata = { title: "Аналитика" };

const SOURCES: { key: Source; label: string }[] = [
  { key: "all", label: "Все обращения" },
  { key: "live", label: "Без демо-набора" },
  { key: "dataset", label: "Только демо-набор" },
];

const pct = (part: number, total: number) => (total ? `${Math.round((part / total) * 100)}%` : "—");

function Kpi({ label, value, note, tone }: { label: string; value: string; note?: string; tone?: "danger" }) {
  return (
    <div className="bg-surface p-5">
      <p className="text-sm text-muted">{label}</p>
      <p className={cx("num mt-1 text-[28px] leading-none font-semibold tracking-[-0.01em]", tone === "danger" && "text-danger")}>
        {value}
      </p>
      {note && <p className="mt-2 text-sm text-muted">{note}</p>}
    </div>
  );
}

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<{ source?: string }> }) {
  const actor = await requireActor();
  if (actor.role !== "manager" && actor.role !== "admin") return <Denied />;
  const sp = await searchParams;
  const source = SOURCES.find((s) => s.key === sp.source)?.key ?? "all";
  const a = await computeAnalytics(await getDb(), actor, source);
  const { totals: t } = a;
  const scope =
    actor.role === "admin"
      ? "По всем подразделениям."
      : actor.departmentName
        ? `По подразделению «${actor.departmentName}» и обращениям, где вы автор или ответственный.`
        : "По обращениям, где вы автор или ответственный.";
  const maxOf = (rows: { c: number }[]) => Math.max(1, ...rows.map((r) => r.c));
  const statusRows = STATUSES.map((s) => ({ status: s, c: a.byStatus.find((r) => r.status === s)?.c ?? 0 }));
  const repeatCats = a.byCategory.filter((c) => c.problems >= 2);

  return (
    <>
      <PageHeader title="Аналитика" description={`${scope} Все показатели считаются по сохранённым обращениям на момент открытия страницы.`} />

      <nav aria-label="Источник данных" className="mb-4 flex flex-wrap gap-1">
        {SOURCES.map((s) => (
          <Link
            key={s.key}
            href={s.key === "all" ? "/analytics" : `/analytics?source=${s.key}`}
            aria-current={source === s.key ? "page" : undefined}
            className={cx(
              "flex h-8 items-center rounded-control px-3 text-sm transition-colors",
              source === s.key ? "bg-ink font-medium text-white" : "text-muted hover:bg-neutral-soft hover:text-ink",
            )}
          >
            {s.label}
          </Link>
        ))}
      </nav>

      {t.total === 0 ? (
        <Card>
          <EmptyState icon={<ChartColumn className="size-5" aria-hidden />} title="Пока нечего считать">
            В выбранном источнике нет обращений. Показатели появятся, когда сотрудники отправят первые обращения.
          </EmptyState>
        </Card>
      ) : (
        <div className="space-y-5">
          <Card className="grid gap-px overflow-hidden !bg-line sm:grid-cols-2 lg:grid-cols-4">
            <Kpi label="Всего обращений" value={String(t.total)} note={`С зафиксированным итогом: ${t.with_resolution} (${pct(t.with_resolution, t.total)})`} />
            <Kpi
              label="Рассмотрение завершено"
              value={pct(t.finished, t.total)}
              note={`${t.finished} из ${t.total}: реализовано ${t.implemented}, отклонено ${t.rejected}, закрыто ${t.closed}`}
            />
            <Kpi
              label="Среднее время до первого ответа"
              value={t.avg_first_response_h === null ? "—" : fmtHours(t.avg_first_response_h)}
              note={
                t.responded
                  ? `По ${t.responded} ${plural(t.responded, "обращению", "обращениям", "обращениям")} с ответом`
                  : "Ответов пока не было"
              }
            />
            <Kpi
              label="Просрочено сейчас"
              value={String(t.overdue)}
              tone={t.overdue ? "danger" : undefined}
              note={`Без первого ответа дольше нормы: ${t.no_response}`}
            />
          </Card>

          {t.synthetic_in_response > 0 && (
            <Notice tone="info">
              Время до первого ответа и сроки у {t.synthetic_in_response} из {t.responded} обращений рассчитаны по
              синтетическим датам: в демонстрационном датасете дат нет. Чтобы видеть только реальные действия в системе,
              выберите «Без демо-набора».
            </Notice>
          )}

          <div className="grid gap-5 lg:grid-cols-2">
            <Card className="p-5 sm:p-6">
              <SectionTitle hint="в скобках: рассмотрение завершено">По типам</SectionTitle>
              {a.byType.map((r) => (
                <BarRow
                  key={r.type}
                  label={TYPE_LABEL[r.type]}
                  value={r.c}
                  note={`(${r.finished})`}
                  share={r.c / maxOf(a.byType)}
                  href={`/overview?type=${r.type}`}
                />
              ))}
            </Card>

            <Card className="p-5 sm:p-6">
              <SectionTitle>По статусам</SectionTitle>
              <ul className="divide-y divide-line">
                {statusRows.map((r) => (
                  <li key={r.status}>
                    <Link href={`/overview?status=${r.status}`} className="-mx-2 flex items-center justify-between gap-3 rounded-control px-2 py-2 hover:bg-sunken">
                      <StatusBadge status={r.status} />
                      <span className="num font-medium">
                        {r.c}
                        <span className="ml-2 inline-block w-10 text-right font-normal text-muted">{pct(r.c, t.total)}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>

            <Card className="p-5 sm:p-6">
              <SectionTitle hint="в скобках: ещё не завершены">По категориям</SectionTitle>
              {a.byCategory.map((r) => (
                <BarRow
                  key={r.id}
                  label={r.name}
                  value={r.c}
                  note={`(${r.open})`}
                  share={r.c / maxOf(a.byCategory)}
                  href={`/overview?category=${r.id}`}
                />
              ))}
            </Card>

            <Card className="p-5 sm:p-6">
              <SectionTitle hint="в скобках: просрочено">По подразделениям</SectionTitle>
              {a.byDepartment.map((r) => (
                <BarRow
                  key={r.id ?? 0}
                  label={r.name ?? "Без подразделения"}
                  value={r.c}
                  note={`(${r.overdue})`}
                  share={r.c / maxOf(a.byDepartment)}
                  href={r.id && actor.role === "admin" ? `/overview?department=${r.id}` : undefined}
                />
              ))}
            </Card>
          </div>

          <Card className="p-5 sm:p-6">
            <SectionTitle hint="правило: не менее трёх общих значимых слов, без машинного обучения">
              Повторяющиеся темы
            </SectionTitle>
            {a.groups.length === 0 && repeatCats.length === 0 ? (
              <p className="text-muted">
                Похожих по формулировкам обращений и категорий с несколькими проблемами пока нет.
              </p>
            ) : (
              <div className="grid gap-x-10 gap-y-6 lg:grid-cols-2">
                <div>
                  <h3 className="mb-2 text-sm font-medium text-muted">Обращения с похожими формулировками</h3>
                  {a.groups.length === 0 ? (
                    <p className="text-muted">Не найдено.</p>
                  ) : (
                    <ol className="space-y-3">
                      {a.groups.map((g, i) => (
                        <li key={i} className="rounded-control border border-line">
                          <ul className="divide-y divide-line">
                            {g.map((x) => (
                              <li key={x.public_id}>
                                <Link href={`/tickets/${x.public_id}`} className="flex items-start gap-3 px-3 py-2 hover:bg-sunken">
                                  <span className="num mt-px w-12 shrink-0 text-sm font-medium text-muted">{x.public_id}</span>
                                  <span className="min-w-0 flex-1">
                                    <span className="line-clamp-2 text-sm">{x.excerpt}</span>
                                    <span className="text-xs text-muted">
                                      {x.category_name} · {STATUS_LABEL[x.status]}
                                    </span>
                                  </span>
                                </Link>
                              </li>
                            ))}
                          </ul>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
                <div>
                  <h3 className="mb-2 text-sm font-medium text-muted">Категории, где проблем две и больше</h3>
                  {repeatCats.length === 0 ? (
                    <p className="text-muted">Таких категорий нет: каждая проблема пока в своей категории.</p>
                  ) : (
                    repeatCats.map((c) => (
                      <BarRow
                        key={c.id}
                        label={c.name}
                        value={c.problems}
                        share={c.problems / Math.max(...repeatCats.map((x) => x.problems))}
                        href={`/overview?category=${c.id}&type=problem`}
                      />
                    ))
                  )}
                </div>
              </div>
            )}
          </Card>
        </div>
      )}
    </>
  );
}
