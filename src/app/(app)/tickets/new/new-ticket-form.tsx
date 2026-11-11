"use client";

import { useEffect, useRef, useState } from "react";
import { Paperclip, X } from "lucide-react";
import { createTicketAction } from "@/app/actions";
import { SubmitButton, useServerForm } from "@/components/client";
import { Card, Field, Input, LinkButton, Notice, Select, Textarea, cx } from "@/components/ui";
import { FILE_ACCEPT, FILE_HINT, LIMITS, MAX_FILE_BYTES, TYPES, TYPE_LABEL, type TicketType } from "@/lib/domain";
import { fmtBytes } from "@/lib/format";

const TYPE_HINT: Record<TicketType, string> = {
  problem: "Что-то мешает работе или работает не так",
  suggestion: "Идея, как сделать процесс лучше",
  praise: "То, что работает хорошо и стоит сохранить",
};
const DESCRIPTION: Record<TicketType, { label: string; placeholder: string }> = {
  problem: {
    label: "Что происходит",
    placeholder: "Опишите ситуацию: где возникает, как часто, чему мешает.",
  },
  suggestion: {
    label: "Что предлагаете",
    placeholder: "Опишите идею и то, что она изменит в работе.",
  },
  praise: {
    label: "Что хотите отметить",
    placeholder: "Расскажите, что получилось хорошо и почему это важно.",
  },
};

type Option = { id: number; name: string };

export function NewTicketForm({
  categories,
  departments,
  defaultDepartmentId,
  clientToken,
}: {
  categories: Option[];
  departments: Option[];
  defaultDepartmentId: number | null;
  clientToken: string;
}) {
  const { state, pending, onSubmit } = useServerForm(createTicketAction);
  const [type, setType] = useState<TicketType>("problem");
  const [descLen, setDescLen] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [dirty, setDirty] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const f = state.fields ?? {};

  // Предупреждение при закрытии вкладки с заполненной формой.
  useEffect(() => {
    if (!dirty || pending) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, pending]);

  useEffect(() => {
    if (state.error) errorRef.current?.focus();
  }, [state]);

  const fileTooBig = file !== null && file.size > MAX_FILE_BYTES;
  const clearFile = () => {
    if (fileRef.current) fileRef.current.value = "";
    setFile(null);
  };

  return (
    <form onSubmit={onSubmit} onChange={() => setDirty(true)} noValidate>
      <input type="hidden" name="clientToken" value={clientToken} />
      <Card className="divide-y divide-line">
        <fieldset className="p-5 sm:p-6">
          <legend className="float-left mb-3 w-full text-sm font-medium">Тип обращения</legend>
          <div className="clear-both grid gap-2 sm:grid-cols-3">
            {TYPES.map((t) => (
              <label
                key={t}
                className={cx(
                  "cursor-pointer rounded-control border px-3.5 py-3 transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent",
                  type === t ? "border-accent bg-accent-soft" : "border-line-strong hover:bg-sunken",
                )}
              >
                <input
                  type="radio"
                  name="type"
                  value={t}
                  checked={type === t}
                  onChange={() => setType(t)}
                  className="sr-only"
                />
                <span className={cx("block font-medium", type === t && "text-accent-ink")}>{TYPE_LABEL[t]}</span>
                <span className="mt-0.5 block text-sm text-muted">{TYPE_HINT[t]}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="grid gap-5 p-5 sm:grid-cols-2 sm:p-6">
          <Field label="Категория" htmlFor="categoryId" error={f.categoryId} hint="От категории зависит, кто рассмотрит обращение.">
            <Select id="categoryId" name="categoryId" defaultValue="" invalid={Boolean(f.categoryId)} required>
              <option value="" disabled>
                Выберите категорию
              </option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label="Подразделение"
            htmlFor="departmentId"
            error={f.departmentId}
            hint="К чьей работе относится вопрос. По умолчанию ваше."
          >
            <Select id="departmentId" name="departmentId" defaultValue={defaultDepartmentId ?? ""} invalid={Boolean(f.departmentId)}>
              <option value="">Не относится к одному подразделению</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="space-y-5 p-5 sm:p-6">
          <Field label="Заголовок" htmlFor="title" error={f.title} hint="Одна фраза, по которой обращение легко узнать в списке.">
            <Input id="title" name="title" maxLength={LIMITS.title} invalid={Boolean(f.title)} required autoComplete="off" />
          </Field>
          <Field
            label={DESCRIPTION[type].label}
            htmlFor="description"
            error={f.description}
            hint={
              <span className="flex justify-between gap-3">
                <span>Не указывайте персональные данные и коммерческие условия.</span>
                <span className="num shrink-0">
                  {descLen} / {LIMITS.description}
                </span>
              </span>
            }
          >
            <Textarea
              id="description"
              name="description"
              rows={6}
              maxLength={LIMITS.description}
              placeholder={DESCRIPTION[type].placeholder}
              invalid={Boolean(f.description)}
              onChange={(e) => setDescLen(e.target.value.length)}
              required
            />
          </Field>
          {type !== "praise" && (
            <Field label="Предполагаемое решение" htmlFor="proposedSolution" optional error={f.proposedSolution}>
              <Textarea
                id="proposedSolution"
                name="proposedSolution"
                rows={3}
                maxLength={LIMITS.solution}
                placeholder="Если есть идея, как это исправить или внедрить."
                invalid={Boolean(f.proposedSolution)}
              />
            </Field>
          )}

          <Field label="Файл" htmlFor="file" optional error={fileTooBig ? "Файл больше 5 МБ. Выберите другой." : f.file} hint={FILE_HINT}>
            <div className="flex flex-wrap items-center gap-3">
              <label
                htmlFor="file"
                className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-control border border-line-strong bg-surface px-4 font-medium hover:bg-sunken has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent"
              >
                <Paperclip className="size-4" aria-hidden />
                {file ? "Заменить файл" : "Выбрать файл"}
                <input
                  ref={fileRef}
                  id="file"
                  name="file"
                  type="file"
                  accept={FILE_ACCEPT}
                  className="sr-only"
                  aria-describedby={fileTooBig || f.file ? "file-error" : "file-hint"}
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </label>
              {file && (
                <span className="flex min-w-0 items-center gap-2 text-sm">
                  <span className="truncate">{file.name}</span>
                  <span className="num shrink-0 text-muted">{fmtBytes(file.size)}</span>
                  <button
                    type="button"
                    onClick={clearFile}
                    className="rounded p-1 text-muted hover:bg-sunken hover:text-ink"
                    aria-label="Убрать файл"
                  >
                    <X className="size-4" aria-hidden />
                  </button>
                </span>
              )}
            </div>
          </Field>
        </div>

        <div className="flex flex-col gap-4 p-5 sm:p-6">
          {state.error && (
            <div ref={errorRef} tabIndex={-1} className="outline-none">
              <Notice tone="error" title={state.error}>
                {Object.keys(f).length > 0 ? "Введённые данные сохранены. Исправьте отмеченные поля и отправьте снова." : undefined}
              </Notice>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <SubmitButton pending={pending} pendingText="Отправляем" disabled={fileTooBig}>
              Отправить обращение
            </SubmitButton>
            <LinkButton href="/my" variant="ghost">
              Отмена
            </LinkButton>
          </div>
        </div>
      </Card>
    </form>
  );
}
