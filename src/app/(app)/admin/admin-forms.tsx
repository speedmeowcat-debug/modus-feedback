"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import {
  createRuleAction,
  createUserAction,
  deleteRuleAction,
  previewRouteAction,
  saveCategoryAction,
  saveSettingsAction,
  updateUserAction,
} from "@/app/actions";
import { ConfirmDialog, FormResult, SubmitButton, useServerForm } from "@/components/client";
import { Button, Field, Input, Notice, Select, cx } from "@/components/ui";
import { ROLES, ROLE_LABEL, TYPES, TYPE_LABEL, type Role } from "@/lib/domain";

type Option = { id: number; name: string };

function Check({ name, label, defaultChecked }: { name: string; label: string; defaultChecked?: boolean }) {
  return (
    <label className="flex h-10 cursor-pointer items-center gap-2 text-sm whitespace-nowrap">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="size-4 accent-(--color-accent)" />
      {label}
    </label>
  );
}

// ---------- Категории ----------

export function CategoryCreateForm() {
  const { state, pending, onSubmit } = useServerForm(saveCategoryAction, { resetOnOk: true });
  return (
    <form onSubmit={onSubmit} noValidate>
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Название" htmlFor="cat-new-name" className="min-w-[220px] flex-1">
          <Input id="cat-new-name" name="name" maxLength={60} invalid={Boolean(state.fields?.name)} />
        </Field>
        <Field label="Срок рассмотрения, дней" htmlFor="cat-new-days" className="w-48">
          <Input id="cat-new-days" name="resolutionDays" type="number" min={1} max={365} defaultValue={14} invalid={Boolean(state.fields?.resolutionDays)} />
        </Field>
        <SubmitButton pending={pending}>Добавить</SubmitButton>
      </div>
      <FormResult state={state} className="mt-3" />
    </form>
  );
}

export function CategoryRowForm({
  c,
}: {
  c: { id: number; name: string; resolution_days: number; is_active: boolean; tickets: number; rules: number };
}) {
  const { state, pending, onSubmit } = useServerForm(saveCategoryAction);
  return (
    <form onSubmit={onSubmit} className="px-4 py-3 sm:px-5" noValidate>
      <input type="hidden" name="id" value={c.id} />
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Input name="name" defaultValue={c.name} maxLength={60} aria-label="Название категории" className="min-w-[200px] flex-[3_1_220px]" />
        <label className="flex items-center gap-2 text-sm text-muted">
          <span>Срок, дней</span>
          <Input name="resolutionDays" type="number" min={1} max={365} defaultValue={c.resolution_days} className="!w-20" />
        </label>
        <Check name="isActive" label="Активна" defaultChecked={c.is_active} />
        <SubmitButton pending={pending} variant="secondary" size="sm" className="!h-10">
          Сохранить
        </SubmitButton>
      </div>
      <p className={cx("mt-1.5 text-sm", c.rules === 0 && c.is_active ? "text-warn" : "text-muted")}>
        Обращений: {c.tickets} · правил маршрутизации: {c.rules}
        {c.rules === 0 && c.is_active ? ". Без правила обращения уходят резервному ответственному." : ""}
      </p>
      <FormResult state={state} className="mt-2" />
    </form>
  );
}

// ---------- Маршрутизация ----------

function RouteSelectors({ categories, departments, idp }: { categories: Option[]; departments: Option[]; idp: string }) {
  return (
    <>
      <Field label="Категория" htmlFor={`${idp}-cat`}>
        <Select id={`${idp}-cat`} name="categoryId" defaultValue="">
          <option value="" disabled>
            Выберите
          </option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Тип обращения" htmlFor={`${idp}-type`}>
        <Select id={`${idp}-type`} name="type" defaultValue={idp === "test" ? "problem" : ""}>
          {idp !== "test" && <option value="">Любой</option>}
          {TYPES.map((t) => (
            <option key={t} value={t}>
              {TYPE_LABEL[t]}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Подразделение" htmlFor={`${idp}-dep`}>
        <Select id={`${idp}-dep`} name="departmentId" defaultValue="">
          <option value="">{idp === "test" ? "Не указано" : "Любое"}</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </Select>
      </Field>
    </>
  );
}

export function RuleCreateForm({
  categories,
  departments,
  assignees,
}: {
  categories: Option[];
  departments: Option[];
  assignees: Option[];
}) {
  const { state, pending, onSubmit } = useServerForm(createRuleAction, { resetOnOk: true });
  return (
    <form onSubmit={onSubmit} noValidate>
      <div className="grid gap-3 sm:grid-cols-2">
        <RouteSelectors categories={categories} departments={departments} idp="rule" />
        <Field label="Ответственный" htmlFor="rule-assignee">
          <Select id="rule-assignee" name="assigneeId" defaultValue="">
            <option value="" disabled>
              Выберите
            </option>
            {assignees.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <FormResult state={state} className="mt-3" />
      <SubmitButton pending={pending} className="mt-4">
        Добавить правило
      </SubmitButton>
    </form>
  );
}

export function RuleDeleteButton({ id, label }: { id: number; label: string }) {
  const [open, setOpen] = useState(false);
  const { state, pending, onSubmit } = useServerForm(deleteRuleAction, { onOk: () => setOpen(false) });
  return (
    <form onSubmit={onSubmit} id={`rule-del-${id}`}>
      <input type="hidden" name="id" value={id} />
      <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(true)} aria-label={`Удалить правило: ${label}`} className="!w-8 !px-0 text-muted hover:text-danger">
        <Trash2 className="size-4" aria-hidden />
      </Button>
      <ConfirmDialog
        open={open}
        title="Удалить правило?"
        confirmLabel="Удалить"
        danger
        pending={pending}
        onCancel={() => setOpen(false)}
        onConfirm={() => (document.getElementById(`rule-del-${id}`) as HTMLFormElement | null)?.requestSubmit()}
      >
        {label}. Уже назначенные обращения не изменятся. Новые обращения без подходящего правила уйдут резервному
        ответственному.
        {state.error && <span className="mt-2 block text-danger">{state.error}</span>}
      </ConfirmDialog>
    </form>
  );
}

export function RouteTester({ categories, departments }: { categories: Option[]; departments: Option[] }) {
  const { state, pending, onSubmit } = useServerForm(previewRouteAction);
  return (
    <form onSubmit={onSubmit} noValidate>
      <div className="grid gap-3 sm:grid-cols-3">
        <RouteSelectors categories={categories} departments={departments} idp="test" />
      </div>
      <SubmitButton pending={pending} variant="secondary" className="mt-4" pendingText="Проверяем">
        Проверить
      </SubmitButton>
      {state.error && (
        <Notice tone="error" className="mt-3">
          {state.error}
        </Notice>
      )}
      {state.route && (
        <Notice
          tone={state.route.viaFallback ? "warn" : "success"}
          title={state.route.assigneeName ? `Получит: ${state.route.assigneeName}` : "Ответственный не будет назначен"}
          className="mt-3"
        >
          {state.route.reason}
        </Notice>
      )}
    </form>
  );
}

// ---------- Пользователи ----------

export type UserRow = {
  id: number;
  login: string;
  name: string;
  role: Role;
  department_id: number | null;
  is_active: boolean;
  is_absent: boolean;
};

function RoleDept({ idp, role, departmentId, departments }: { idp: string; role?: Role; departmentId?: number | null; departments: Option[] }) {
  return (
    <>
      <Field label="Роль" htmlFor={`${idp}-role`}>
        <Select id={`${idp}-role`} name="role" defaultValue={role ?? "employee"}>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABEL[r]}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Подразделение" htmlFor={`${idp}-dep`}>
        <Select id={`${idp}-dep`} name="departmentId" defaultValue={departmentId ?? ""}>
          <option value="">Не закреплено</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </Select>
      </Field>
    </>
  );
}

export function UserEditForm({ u, departments, isSelf }: { u: UserRow; departments: Option[]; isSelf: boolean }) {
  const { state, pending, onSubmit } = useServerForm(updateUserAction);
  const idp = `user-${u.id}`;
  return (
    <form onSubmit={onSubmit} className="border-t border-line bg-sunken/50 px-4 py-4 sm:px-5" noValidate>
      <input type="hidden" name="id" value={u.id} />
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Имя или должность" htmlFor={`${idp}-name`}>
          <Input id={`${idp}-name`} name="name" defaultValue={u.name} maxLength={80} />
        </Field>
        <RoleDept idp={idp} role={u.role} departmentId={u.department_id} departments={departments} />
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-6">
        <Check name="isAbsent" label="Отсутствует: новые обращения уходят резервному" defaultChecked={u.is_absent} />
        <Check name="isActive" label="Учётная запись активна" defaultChecked={u.is_active} />
      </div>
      {isSelf && <p className="text-sm text-muted">Это ваша учётная запись: роль и активность изменить нельзя.</p>}
      <FormResult state={state} className="mt-3" />
      <SubmitButton pending={pending} className="mt-3">
        Сохранить
      </SubmitButton>
    </form>
  );
}

export function UserCreateForm({ departments }: { departments: Option[] }) {
  const { state, pending, onSubmit } = useServerForm(createUserAction, { resetOnOk: true });
  return (
    <form onSubmit={onSubmit} noValidate autoComplete="off">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Имя или должность" htmlFor="nu-name" error={state.fields?.name}>
          <Input id="nu-name" name="name" maxLength={80} invalid={Boolean(state.fields?.name)} />
        </Field>
        <Field label="Логин" htmlFor="nu-login" error={state.fields?.login} hint="Латиница, цифры, точка, дефис">
          <Input id="nu-login" name="login" maxLength={40} autoCapitalize="none" spellCheck={false} invalid={Boolean(state.fields?.login)} />
        </Field>
        <Field label="Временный пароль" htmlFor="nu-password" error={state.fields?.password} hint="Не короче 10 символов">
          <Input id="nu-password" name="password" type="password" autoComplete="new-password" invalid={Boolean(state.fields?.password)} />
        </Field>
        <RoleDept idp="nu" departments={departments} />
      </div>
      <FormResult state={state.fields && Object.keys(state.fields).length ? {} : state} className="mt-3" />
      <SubmitButton pending={pending} className="mt-4">
        Создать пользователя
      </SubmitButton>
    </form>
  );
}

// ---------- Параметры ----------

export function SettingsForm({
  assignees,
  fallbackAssigneeId,
  firstResponseHours,
}: {
  assignees: Option[];
  fallbackAssigneeId: number | null;
  firstResponseHours: number;
}) {
  const { state, pending, onSubmit } = useServerForm(saveSettingsAction);
  return (
    <form onSubmit={onSubmit} noValidate>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          label="Резервный ответственный"
          htmlFor="set-fallback"
          error={state.fields?.fallbackAssigneeId}
          hint="Получает обращение, если для категории нет правила или ответственный по правилу отсутствует."
        >
          <Select id="set-fallback" name="fallbackAssigneeId" defaultValue={fallbackAssigneeId ?? ""} invalid={Boolean(state.fields?.fallbackAssigneeId)}>
            <option value="" disabled>
              Выберите
            </option>
            {assignees.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field
          label="Норма первого ответа, часов"
          htmlFor="set-frh"
          error={state.fields?.firstResponseHours}
          hint="Новое обращение без реакции дольше этого времени помечается в списках и аналитике."
        >
          <Input id="set-frh" name="firstResponseHours" type="number" min={1} max={720} defaultValue={firstResponseHours} invalid={Boolean(state.fields?.firstResponseHours)} />
        </Field>
      </div>
      <FormResult state={state.fields && Object.keys(state.fields).length ? {} : state} className="mt-4" />
      <SubmitButton pending={pending} className="mt-4">
        Сохранить параметры
      </SubmitButton>
    </form>
  );
}
