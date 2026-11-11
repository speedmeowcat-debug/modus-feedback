"use client";

import { useRef, useState } from "react";
import { Paperclip } from "lucide-react";
import { commentAction, dueAction, priorityAction, reassignAction, ticketAction } from "@/app/actions";
import { ConfirmDialog, FormResult, SubmitButton, useServerForm } from "@/components/client";
import { Button, Field, Input, Select, Textarea, buttonClass, cx } from "@/components/ui";
import {
  ACTION_DEFS,
  FILE_ACCEPT,
  FILE_HINT,
  LIMITS,
  PRIORITIES,
  PRIORITY_LABEL,
  actionTextRule,
  type Priority,
  type TicketAction,
} from "@/lib/domain";

/** Кнопки смены статуса. Действия с текстом раскрывают поле, необратимые спрашивают подтверждение. */
export function StatusActions({
  idp,
  publicId,
  actions,
  hasResolution,
}: {
  /** Префикс id полей: блок может быть на странице дважды (боковая колонка и мобильная версия). */
  idp: string;
  publicId: string;
  actions: TicketAction[];
  hasResolution: boolean;
}) {
  const [open, setOpen] = useState<TicketAction | null>(null);
  const [confirm, setConfirm] = useState<TicketAction | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const confirmed = useRef(false);
  const { state, pending, onSubmit, clear } = useServerForm(ticketAction, {
    onOk: () => {
      setOpen(null);
      setConfirm(null);
    },
  });

  const start = (a: TicketAction) => {
    clear();
    const needsText = actionTextRule(a, hasResolution);
    if (needsText) setOpen(a);
    else if (ACTION_DEFS[a].confirm) {
      setOpen(null);
      setConfirm(a);
    } else {
      setOpen(null);
      submitDirect(a);
    }
  };

  // Действие без текста: отправляем скрытую форму.
  const directRef = useRef<HTMLFormElement>(null);
  const directAction = useRef<HTMLInputElement>(null);
  const submitDirect = (a: TicketAction) => {
    if (!directRef.current || !directAction.current) return;
    directAction.current.value = a;
    directRef.current.requestSubmit();
  };

  const rule = open ? actionTextRule(open, hasResolution) : null;
  const tone = (a: TicketAction, i: number) =>
    a === "reject" ? "danger" : i === 0 && a !== "resume" ? "primary" : "secondary";

  return (
    <div>
      <form ref={directRef} onSubmit={onSubmit} hidden>
        <input type="hidden" name="publicId" value={publicId} />
        <input ref={directAction} type="hidden" name="action" defaultValue="" />
        <input type="hidden" name="text" value="" />
      </form>

      {!open && (
        <div className="flex flex-col gap-2">
          {actions.map((a, i) => (
            <Button
              key={a}
              type="button"
              variant={tone(a, i)}
              onClick={() => start(a)}
              disabled={pending}
              className="w-full"
            >
              {ACTION_DEFS[a].label}
            </Button>
          ))}
        </div>
      )}

      {open && rule && (
        <form
          ref={formRef}
          onSubmit={(e) => {
            // Необратимое действие с текстом: сначала подтверждение, отправка из диалога.
            if (ACTION_DEFS[open].confirm && !confirmed.current) {
              e.preventDefault();
              setConfirm(open);
              return;
            }
            confirmed.current = false;
            onSubmit(e);
          }}
          className="animate-rise space-y-3"
          noValidate
        >
          <input type="hidden" name="publicId" value={publicId} />
          <input type="hidden" name="action" value={open} />
          <Field label={rule.label} htmlFor={`${idp}-action-text`} hint={rule.hint} error={state.fields?.text}>
            <Textarea
              id={`${idp}-action-text`}
              name="text"
              rows={4}
              maxLength={LIMITS.comment}
              autoFocus
              invalid={Boolean(state.fields?.text)}
            />
          </Field>
          <div className="flex flex-wrap gap-2">
            <SubmitButton
              pending={pending}
              className={cx(open === "reject" && "!bg-danger hover:!bg-danger-hover")}
            >
              {ACTION_DEFS[open].label}
            </SubmitButton>
            <Button type="button" variant="ghost" onClick={() => { setOpen(null); clear(); }} disabled={pending}>
              Отмена
            </Button>
          </div>
        </form>
      )}

      <FormResult state={state.fields?.text ? {} : state} className="mt-3" />

      <ConfirmDialog
        open={confirm !== null}
        title={confirm ? `${ACTION_DEFS[confirm].label}?` : ""}
        confirmLabel={confirm ? ACTION_DEFS[confirm].label : ""}
        danger={confirm === "reject"}
        pending={pending}
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          const c = confirm;
          if (!c) return;
          setConfirm(null);
          if (open === c) {
            confirmed.current = true;
            formRef.current?.requestSubmit();
          } else submitDirect(c);
        }}
      >
        {confirm ? ACTION_DEFS[confirm].confirm : null}
      </ConfirmDialog>
    </div>
  );
}

/** Ответ автора на запрос уточнения. */
export function AnswerForm({ publicId }: { publicId: string }) {
  const { state, pending, onSubmit } = useServerForm(ticketAction, { resetOnOk: true });
  return (
    <form onSubmit={onSubmit} className="space-y-3" noValidate>
      <input type="hidden" name="publicId" value={publicId} />
      <input type="hidden" name="action" value="answer" />
      <Field label="Ваш ответ" htmlFor="answer-text" error={state.fields?.text}>
        <Textarea id="answer-text" name="text" rows={4} maxLength={LIMITS.comment} invalid={Boolean(state.fields?.text)} />
      </Field>
      <FormResult state={state.fields?.text ? {} : state} />
      <SubmitButton pending={pending} pendingText="Отправляем">
        Отправить ответ
      </SubmitButton>
    </form>
  );
}

export function CommentForm({ publicId, canInternal }: { publicId: string; canInternal: boolean }) {
  const [fileName, setFileName] = useState("");
  const { state, pending, onSubmit } = useServerForm(commentAction, {
    resetOnOk: true,
    onOk: () => setFileName(""),
  });
  const err = state.fields?.body ?? state.fields?.file;
  return (
    <form onSubmit={onSubmit} className="space-y-3" noValidate>
      <input type="hidden" name="publicId" value={publicId} />
      <Field label="Комментарий" htmlFor="comment-body" error={err}>
        <Textarea
          id="comment-body"
          name="body"
          rows={3}
          maxLength={LIMITS.comment}
          placeholder="Вопрос, дополнение или промежуточный результат"
          invalid={Boolean(err)}
        />
      </Field>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <SubmitButton pending={pending} variant="secondary" pendingText="Отправляем">
          Добавить комментарий
        </SubmitButton>
        <label
          title={FILE_HINT}
          className={cx(
            buttonClass("ghost", "md"),
            "cursor-pointer text-muted has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent",
          )}
        >
          <Paperclip className="size-4" aria-hidden />
          <span className="max-w-44 truncate">{fileName || "Прикрепить файл"}</span>
          <input
            type="file"
            name="file"
            accept={FILE_ACCEPT}
            className="sr-only"
            onChange={(e) => setFileName(e.target.files?.[0]?.name ?? "")}
          />
        </label>
        {canInternal && (
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input type="checkbox" name="internal" className="size-4 accent-(--color-accent)" />
            Внутренняя заметка, автор её не увидит
          </label>
        )}
      </div>
      <FormResult state={err ? {} : state} />
    </form>
  );
}

/** Приоритет, срок и ответственный. */
export function TicketSettings({
  publicId,
  priority,
  dueDay,
  today,
  finished,
  assignable,
  assigneeId,
}: {
  publicId: string;
  priority: Priority;
  dueDay: string;
  today: string;
  finished: boolean;
  /** null, если пользователь не может менять ответственного. */
  assignable: { id: number; label: string }[] | null;
  assigneeId: number | null;
}) {
  const pr = useServerForm(priorityAction);
  const due = useServerForm(dueAction);
  const re = useServerForm(reassignAction, { resetOnOk: true });
  return (
    <div className="space-y-5">
      <form onSubmit={pr.onSubmit} onChange={(e) => e.currentTarget.requestSubmit()}>
        <input type="hidden" name="publicId" value={publicId} />
        <Field label="Приоритет" htmlFor="set-priority">
          <Select id="set-priority" name="priority" defaultValue={priority} disabled={pr.pending}>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {PRIORITY_LABEL[p]}
              </option>
            ))}
          </Select>
        </Field>
        <FormResult state={pr.state} className="mt-2" />
      </form>

      {!finished && (
        <form onSubmit={due.onSubmit} noValidate>
          <input type="hidden" name="publicId" value={publicId} />
          <Field label="Срок рассмотрения" htmlFor="set-due" error={due.state.fields?.due}>
            <div className="flex gap-2">
              <Input id="set-due" name="due" type="date" defaultValue={dueDay} min={today} invalid={Boolean(due.state.fields?.due)} />
              <SubmitButton pending={due.pending} variant="secondary" pendingText="…">
                Изменить
              </SubmitButton>
            </div>
          </Field>
          <FormResult state={due.state.fields?.due ? {} : due.state} className="mt-2" />
        </form>
      )}

      {assignable && (
        <form onSubmit={re.onSubmit} className="space-y-3" noValidate>
          <input type="hidden" name="publicId" value={publicId} />
          <Field label="Передать другому ответственному" htmlFor="set-assignee" error={re.state.fields?.assigneeId}>
            <Select id="set-assignee" name="assigneeId" defaultValue="" invalid={Boolean(re.state.fields?.assigneeId)}>
              <option value="" disabled>
                Выберите сотрудника
              </option>
              {assignable
                .filter((u) => u.id !== assigneeId)
                .map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.label}
                  </option>
                ))}
            </Select>
          </Field>
          <Field label="Причина" htmlFor="set-reason" optional>
            <Input id="set-reason" name="reason" maxLength={500} />
          </Field>
          <FormResult state={re.state.fields?.assigneeId ? {} : re.state} />
          <SubmitButton pending={re.pending} variant="secondary">
            Передать
          </SubmitButton>
        </form>
      )}
    </div>
  );
}
