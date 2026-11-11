"use client";

// Клиентские примитивы: отправка форм без потери введённого, подтверждение, автоотправка фильтров.

import { useEffect, useRef, useState, useSyncExternalStore, useTransition, type FormEvent, type ReactNode } from "react";
import { LoaderCircle, SlidersHorizontal } from "lucide-react";
import type { ActionState } from "@/lib/action-state";
import { Button, Notice, buttonClass, cx } from "./ui";

/**
 * Отправляет форму в серверное действие.
 * - Введённые данные (включая выбранный файл) остаются в полях, если сервер вернул ошибку.
 * - Повторная отправка блокируется, пока идёт запрос.
 * - Обрыв связи превращается в понятное сообщение, а не в «белый экран».
 */
export function useServerForm<S extends ActionState>(
  action: (fd: FormData) => Promise<S>,
  opts: { resetOnOk?: boolean; onOk?: (s: S) => void } = {},
) {
  const [state, setState] = useState<S | ActionState>({});
  const [pending, start] = useTransition();
  const busy = useRef(false);

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (busy.current) return;
    busy.current = true;
    const form = e.currentTarget;
    const fd = new FormData(form);
    start(async () => {
      try {
        const res = await action(fd);
        if (!res) return; // действие завершилось переходом на другую страницу
        setState(res);
        if (res.ok) {
          if (opts.resetOnOk) form.reset();
          opts.onOk?.(res);
        }
      } catch (err) {
        // redirect() из серверного действия пробрасывается как служебная ошибка: её не трогаем
        if (typeof err === "object" && err && "digest" in err && String((err as { digest: unknown }).digest).startsWith("NEXT_"))
          throw err;
        setState({ error: "Нет связи с сервером. Введённые данные сохранены в форме, попробуйте ещё раз." });
      } finally {
        busy.current = false;
      }
    });
  };

  return { state: state as S & ActionState, pending, onSubmit, clear: () => setState({}) };
}

export function Spinner() {
  return <LoaderCircle className="size-4 animate-spin" aria-hidden />;
}

const subscribeNoop = () => () => {};

export function SubmitButton({
  pending,
  children,
  pendingText = "Сохраняем",
  ...rest
}: React.ComponentProps<typeof Button> & { pending: boolean; pendingText?: string }) {
  // До загрузки скриптов браузер отправил бы форму обычным GET-запросом: данные формы,
  // включая пароль на странице входа, попали бы в адресную строку. Поэтому до гидратации
  // кнопка неактивна; при неактивной кнопке браузер не отправляет форму и по Enter.
  const hydrated = useSyncExternalStore(subscribeNoop, () => true, () => false);
  return (
    <Button type="submit" variant="primary" {...rest} disabled={!hydrated || pending || rest.disabled} aria-busy={pending}>
      {pending && <Spinner />}
      {pending ? pendingText : children}
    </Button>
  );
}

/** Сообщение о результате формы: ошибка или успех. */
export function FormResult({ state, className }: { state: ActionState; className?: string }) {
  if (state.error) {
    return (
      <Notice tone="error" className={className}>
        {state.error}
      </Notice>
    );
  }
  if (state.ok && state.message) {
    return (
      <Notice tone="success" className={className}>
        {state.message}
      </Notice>
    );
  }
  return null;
}

/** Модальное подтверждение на нативном dialog: фокус удерживается внутри, Esc закрывает. */
export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  danger,
  pending,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  children?: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  pending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        onCancel();
      }}
      onClick={(e) => e.target === ref.current && onCancel()}
      className="m-auto w-[min(440px,calc(100vw-32px))] rounded-card border border-line bg-surface p-0 text-ink shadow-pop"
    >
      <div className="p-5">
        <h2 className="text-[17px] font-semibold">{title}</h2>
        {children && <div className="mt-2 text-muted">{children}</div>}
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <Button type="button" onClick={onCancel} disabled={pending} autoFocus>
            Отмена
          </Button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={pending}
            className={cx(
              buttonClass("primary"),
              danger && "!bg-danger hover:!bg-danger-hover",
            )}
          >
            {pending && <Spinner />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}

/** Форма фильтров: выпадающие списки применяются сразу, поиск по Enter или кнопке. */
export function AutoSubmitForm({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <form
      method="get"
      className={className}
      onChange={(e) => {
        const el = e.target as HTMLElement;
        if (el instanceof HTMLSelectElement) e.currentTarget.requestSubmit();
      }}
    >
      {children}
    </form>
  );
}

/** На телефоне фильтры свёрнуты под кнопку, чтобы список был виден сразу. На широком экране всегда раскрыты. */
export function FilterPanel({ children, active }: { children: ReactNode; active: number }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={cx(buttonClass("secondary", "sm"), "!h-9 md:hidden")}
      >
        <SlidersHorizontal className="size-4" aria-hidden />
        Фильтры
        {active > 0 && <span className="num rounded-full bg-accent px-1.5 text-xs leading-5 text-white">{active}</span>}
      </button>
      <div className={cx(open ? "grid" : "hidden", "w-full grid-cols-2 gap-2 max-[420px]:grid-cols-1 md:contents")}>{children}</div>
    </>
  );
}
