import { isFinal, type Status } from "./domain";

// Вся компания в одном часовом поясе: Павлодар, UTC+5.
const TZ = "Etc/GMT-5";

const dt = new Intl.DateTimeFormat("ru-RU", {
  timeZone: TZ,
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});
const d = new Intl.DateTimeFormat("ru-RU", { timeZone: TZ, day: "numeric", month: "short", year: "numeric" });
const dShort = new Intl.DateTimeFormat("ru-RU", { timeZone: TZ, day: "numeric", month: "short" });
const iso = new Intl.DateTimeFormat("sv-SE", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });

export const fmtDateTime = (v: Date) => dt.format(v).replace(",", "");
export const fmtDate = (v: Date) => d.format(v).replace(" г.", "");
export const fmtDay = (v: Date) => dShort.format(v);
/** YYYY-MM-DD в поясе Павлодара, для полей type="date". */
export const isoDay = (v: Date) => iso.format(v);

export function fmtHours(h: number): string {
  if (h < 1) return "меньше часа";
  if (h < 48) return `${Math.round(h)} ч`;
  return `${(h / 24).toFixed(1).replace(".", ",")} дн.`;
}

export function fmtBytes(n: number): string {
  if (n < 1024) return `${n} Б`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} КБ`;
  return `${(n / 1024 / 1024).toFixed(1).replace(".", ",")} МБ`;
}

export type Tone = "danger" | "warn" | "muted";

/** Что показать в колонке «Срок»: просрочку, остаток или дату завершения. */
export function deadlineInfo(
  t: { status: Status; due_at: Date | null; finished_at: Date | null; created_at: Date; first_response_at: Date | null },
  firstResponseHours: number,
  now = new Date(),
): { label: string; tone: Tone; overdue: boolean; noResponse: boolean } {
  if (isFinal(t.status)) {
    return {
      label: t.finished_at ? `Завершено ${fmtDay(t.finished_at)}` : "Завершено",
      tone: "muted",
      overdue: false,
      noResponse: false,
    };
  }
  const noResponse =
    t.status === "new" && !t.first_response_at && now.getTime() - t.created_at.getTime() > firstResponseHours * 3600_000;
  if (!t.due_at) return { label: noResponse ? "Нет первого ответа" : "Без срока", tone: noResponse ? "warn" : "muted", overdue: false, noResponse };
  const days = (t.due_at.getTime() - now.getTime()) / 86400_000;
  if (days < 0) {
    const n = Math.max(1, Math.ceil(-days));
    return { label: `Просрочено на ${n} дн.`, tone: "danger", overdue: true, noResponse };
  }
  if (days < 1) return { label: "Срок сегодня", tone: "warn", overdue: false, noResponse };
  if (days < 3) return { label: `Осталось ${Math.ceil(days)} дн.`, tone: "warn", overdue: false, noResponse };
  return { label: noResponse ? "Нет первого ответа" : `До ${fmtDay(t.due_at)}`, tone: noResponse ? "warn" : "muted", overdue: false, noResponse };
}

export function plural(n: number, one: string, few: string, many: string): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}
