// Базовые компоненты интерфейса. Серверные и клиентские страницы собираются только из них.

import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { CircleAlert, CircleCheck, Info } from "lucide-react";
import {
  PRIORITY_LABEL,
  STATUS_LABEL,
  TYPE_LABEL,
  type Priority,
  type Status,
  type TicketType,
} from "@/lib/domain";

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

// ---------- Кнопки ----------

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "md" | "sm";

const BTN_BASE =
  "inline-flex items-center justify-center gap-2 rounded-control font-medium whitespace-nowrap select-none " +
  "transition-colors duration-150 disabled:opacity-55 disabled:cursor-not-allowed";
const BTN_VARIANT: Record<Variant, string> = {
  primary: "bg-accent text-white hover:bg-accent-hover",
  secondary: "bg-surface text-ink border border-line-strong hover:bg-sunken",
  ghost: "text-ink hover:bg-sunken",
  danger: "bg-surface text-danger border border-danger/40 hover:bg-danger-soft",
};
const BTN_SIZE: Record<Size, string> = { md: "h-10 px-4 text-[15px]", sm: "h-8 px-3 text-sm" };

export const buttonClass = (variant: Variant = "secondary", size: Size = "md", extra?: string) =>
  cx(BTN_BASE, BTN_VARIANT[variant], BTN_SIZE[size], extra);

export function Button({
  variant = "secondary",
  size = "md",
  className,
  ...rest
}: ComponentProps<"button"> & { variant?: Variant; size?: Size }) {
  return <button {...rest} className={buttonClass(variant, size, className)} />;
}

export function LinkButton({
  variant = "secondary",
  size = "md",
  className,
  ...rest
}: ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return <Link {...rest} className={buttonClass(variant, size, className)} />;
}

// ---------- Метки ----------

const STATUS_STYLE: Record<Status, string> = {
  new: "bg-info-soft text-info",
  in_review: "bg-neutral-soft text-ink",
  in_progress: "bg-accent-soft text-accent-ink",
  needs_info: "bg-warn-soft text-warn",
  implemented: "bg-accent text-white",
  rejected: "bg-danger-soft text-danger",
  closed: "bg-transparent text-muted border border-line-strong",
};

export function StatusBadge({ status }: { status: Status }) {
  return (
    <span
      className={cx(
        "inline-flex h-6 items-center rounded-[5px] px-2 text-[13px] font-medium whitespace-nowrap",
        STATUS_STYLE[status],
      )}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

export function TypeLabel({ type }: { type: TicketType }) {
  return <span className="whitespace-nowrap">{TYPE_LABEL[type]}</span>;
}

/** Приоритет: три деления шкалы и подпись, цвет не единственный носитель смысла. */
export function PriorityMark({ priority, compact }: { priority: Priority; compact?: boolean }) {
  const level = priority === "high" ? 3 : priority === "medium" ? 2 : 1;
  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap text-sm">
      <span className="flex items-end gap-[2px]" aria-hidden>
        {[1, 2, 3].map((i) => (
          <span
            key={i}
            className={cx(
              "w-[3px] rounded-[1px]",
              i === 1 ? "h-[6px]" : i === 2 ? "h-[9px]" : "h-[12px]",
              i <= level ? (priority === "high" ? "bg-danger" : "bg-ink") : "bg-line-strong",
            )}
          />
        ))}
      </span>
      <span className={cx(compact && "sr-only", priority === "high" && "text-danger font-medium")}>
        {PRIORITY_LABEL[priority]}
      </span>
    </span>
  );
}

export function Tag({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "warn" | "danger" | "info" }) {
  const style = {
    neutral: "bg-neutral-soft text-muted",
    warn: "bg-warn-soft text-warn",
    danger: "bg-danger-soft text-danger",
    info: "bg-info-soft text-info",
  }[tone];
  return (
    <span className={cx("inline-flex h-5 items-center rounded-[4px] px-1.5 text-xs font-medium whitespace-nowrap", style)}>
      {children}
    </span>
  );
}

// ---------- Контейнеры ----------

export function Card({ className, ...rest }: ComponentProps<"section">) {
  return <section {...rest} className={cx("rounded-card border border-line bg-surface shadow-card", className)} />;
}

export function PageHeader({
  title,
  description,
  actions,
  back,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  back?: { href: string; label: string };
}) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
      <div className="min-w-0">
        {back && (
          <Link href={back.href} className="mb-2 inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
            <span aria-hidden>←</span> {back.label}
          </Link>
        )}
        <h1 className="text-[26px] leading-tight font-semibold tracking-[-0.01em]">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-muted">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

export function SectionTitle({ children, hint }: { children: ReactNode; hint?: ReactNode }) {
  return (
    <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
      <h2 className="text-[17px] font-semibold">{children}</h2>
      {hint && <p className="text-sm text-muted">{hint}</p>}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  children,
  action,
}: {
  icon?: ReactNode;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      {icon && <div className="mb-4 flex size-11 items-center justify-center rounded-full bg-sunken text-muted">{icon}</div>}
      <p className="text-[17px] font-semibold">{title}</p>
      {children && <p className="mt-1.5 max-w-md text-muted">{children}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Notice({
  tone,
  title,
  children,
  className,
}: {
  tone: "success" | "error" | "info" | "warn";
  title?: string;
  children?: ReactNode;
  className?: string;
}) {
  const style = {
    success: "border-accent/30 bg-accent-soft text-accent-ink",
    error: "border-danger/30 bg-danger-soft text-danger",
    warn: "border-warn/30 bg-warn-soft text-warn",
    info: "border-line bg-sunken text-ink",
  }[tone];
  const Icon = tone === "success" ? CircleCheck : tone === "info" ? Info : CircleAlert;
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cx("flex gap-3 rounded-control border px-3.5 py-3 text-sm", style, className)}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="min-w-0">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={cx(title && "mt-0.5", "text-ink/90")}>{children}</div>}
      </div>
    </div>
  );
}

// ---------- Поля форм ----------

const CONTROL =
  "w-full rounded-control border border-line-strong bg-surface px-3 text-[15px] text-ink placeholder:text-faint " +
  "transition-colors hover:border-muted focus:border-accent focus:outline-2 focus:outline-offset-0 focus:outline-accent/25 " +
  "aria-[invalid=true]:border-danger disabled:bg-sunken disabled:text-muted";

export function Field({
  label,
  htmlFor,
  hint,
  error,
  optional,
  children,
  className,
}: {
  label: string;
  htmlFor: string;
  hint?: ReactNode;
  error?: string;
  optional?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="mb-1.5 flex items-baseline gap-2 text-sm font-medium">
        {label}
        {optional && <span className="font-normal text-muted">необязательно</span>}
      </label>
      {children}
      {error ? (
        <p id={`${htmlFor}-error`} className="mt-1.5 flex items-start gap-1.5 text-sm text-danger">
          <CircleAlert className="mt-[3px] size-3.5 shrink-0" aria-hidden />
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${htmlFor}-hint`} className="mt-1.5 text-sm text-muted">
            {hint}
          </p>
        )
      )}
    </div>
  );
}

const describe = (id?: string, error?: boolean) => (id ? `${id}-${error ? "error" : "hint"}` : undefined);

export function Input({ invalid, className, ...rest }: ComponentProps<"input"> & { invalid?: boolean }) {
  return (
    <input
      {...rest}
      aria-invalid={invalid || undefined}
      aria-describedby={describe(rest.id, invalid)}
      className={cx(CONTROL, "h-10", className)}
    />
  );
}

export function Textarea({ invalid, className, ...rest }: ComponentProps<"textarea"> & { invalid?: boolean }) {
  return (
    <textarea
      {...rest}
      aria-invalid={invalid || undefined}
      aria-describedby={describe(rest.id, invalid)}
      className={cx(CONTROL, "min-h-24 resize-y py-2.5 leading-relaxed", className)}
    />
  );
}

export function Select({ invalid, className, ...rest }: ComponentProps<"select"> & { invalid?: boolean }) {
  return (
    <select
      {...rest}
      aria-invalid={invalid || undefined}
      aria-describedby={describe(rest.id, invalid)}
      className={cx(
        CONTROL,
        "h-10 appearance-none bg-[length:16px] bg-[right_10px_center] bg-no-repeat pr-9",
        "bg-[url('data:image/svg+xml;utf8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2016%2016%22%20fill%3D%22none%22%20stroke%3D%22%235c6360%22%20stroke-width%3D%221.6%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22m4%206%204%204%204-4%22%2F%3E%3C%2Fsvg%3E')]",
        className,
      )}
    />
  );
}

/** Горизонтальная шкала для сводок: подпись, значение и полоса, длина которой задана долей. */
export function BarRow({
  label,
  value,
  share,
  note,
  href,
}: {
  label: ReactNode;
  value: number;
  share: number;
  note?: ReactNode;
  href?: string;
}) {
  const body = (
    <>
      <div className="flex items-baseline justify-between gap-3">
        <span className="min-w-0 truncate">{label}</span>
        <span className="num shrink-0 font-medium">
          {value}
          {note && <span className="ml-2 font-normal text-muted">{note}</span>}
        </span>
      </div>
      <div className="mt-1.5 h-1.5 rounded-full bg-sunken">
        <div className="h-full rounded-full bg-accent" style={{ width: `${Math.max(share * 100, value > 0 ? 2 : 0)}%` }} />
      </div>
    </>
  );
  return href ? (
    <Link href={href} className="-mx-2 block rounded-control px-2 py-2 hover:bg-sunken">
      {body}
    </Link>
  ) : (
    <div className="py-2">{body}</div>
  );
}
