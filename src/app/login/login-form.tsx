"use client";

import { useState, useTransition } from "react";
import { ArrowRight } from "lucide-react";
import { demoLoginAction, loginAction } from "@/app/actions";
import { FormResult, Spinner, SubmitButton, useServerForm } from "@/components/client";
import { Field, Input, Notice, Tag } from "@/components/ui";

export function LoginForm() {
  const { state, pending, onSubmit } = useServerForm(loginAction);
  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <Field label="Логин" htmlFor="login">
        <Input id="login" name="login" autoComplete="username" autoCapitalize="none" spellCheck={false} required />
      </Field>
      <Field label="Пароль" htmlFor="password">
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </Field>
      <FormResult state={state} />
      <SubmitButton pending={pending} pendingText="Входим" className="w-full sm:w-auto">
        Войти
      </SubmitButton>
    </form>
  );
}

export type DemoAccount = { id: number; name: string; role: string; department: string | null; note: string | null };

export function DemoAccounts({ accounts }: { accounts: DemoAccount[] }) {
  const [pendingId, setPendingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, start] = useTransition();
  const featured = accounts.filter((a) => a.note);
  const rest = accounts.filter((a) => !a.note);

  const enter = (id: number) => {
    if (pendingId !== null) return;
    setPendingId(id);
    setError(null);
    start(async () => {
      const fd = new FormData();
      fd.set("userId", String(id));
      const res = await demoLoginAction(fd);
      if (res?.error) {
        setError(res.error);
        setPendingId(null);
      }
    });
  };

  const row = (a: DemoAccount, big: boolean) => (
    <li key={a.id}>
      <button
        type="button"
        onClick={() => enter(a.id)}
        disabled={pendingId !== null}
        className="group flex w-full items-center gap-3 rounded-control px-3 py-2.5 text-left transition-colors hover:bg-sunken disabled:cursor-wait"
      >
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className="font-medium">{a.name}</span>
            <Tag>{a.role}</Tag>
          </span>
          <span className="mt-0.5 block text-sm text-muted">
            {big ? a.note : (a.department ?? "Без подразделения")}
          </span>
        </span>
        <span className="text-muted group-hover:text-ink">
          {pendingId === a.id ? <Spinner /> : <ArrowRight className="size-4" aria-hidden />}
        </span>
      </button>
    </li>
  );

  return (
    <section aria-labelledby="demo-title" className="rounded-card border border-line bg-surface p-5 shadow-card sm:p-6">
      <div className="flex flex-wrap items-center gap-2">
        <h2 id="demo-title" className="text-[17px] font-semibold">
          Демонстрационный вход
        </h2>
        <Tag tone="warn">Demo</Tag>
      </div>
      <p className="mt-1.5 text-sm text-muted">
        Тестовые аккаунты названы условными ролями из набора синтетических данных. Реальных сотрудников и реальных
        обращений в системе нет.
      </p>
      {error && (
        <Notice tone="error" className="mt-3">
          {error}
        </Notice>
      )}
      <ul className="mt-4 -mx-3 divide-y divide-line">{featured.map((a) => row(a, true))}</ul>
      {rest.length > 0 && (
        <details className="mt-3 border-t border-line pt-3">
          <summary className="cursor-pointer rounded-control py-1 text-sm font-medium text-accent-ink hover:underline">
            Остальные тестовые аккаунты ({rest.length})
          </summary>
          <ul className="-mx-3 mt-2 grid sm:grid-cols-2">{rest.map((a) => row(a, false))}</ul>
        </details>
      )}
    </section>
  );
}
