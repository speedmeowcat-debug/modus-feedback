"use server";

// Все изменения данных идут через эти серверные действия.
// Каждое действие заново определяет пользователя по сессии и передаёт его в сервис,
// где проверяются права. Интерфейс только скрывает недоступное, но ничего не разрешает.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb, type Db } from "@/db";
import type { ActionState } from "@/lib/action-state";
import { getActor, homeFor, loginAsDemo, loginWithPassword, logout } from "@/lib/auth";
import { ACTIONS, MAX_FILE_BYTES, type Actor, type TicketAction } from "@/lib/domain";
import { AppError } from "@/lib/errors";
import * as admin from "@/lib/services/admin";
import { markAllRead } from "@/lib/services/notifications";
import type { RouteResult } from "@/lib/services/routing";
import * as tickets from "@/lib/services/tickets";

const str = (fd: FormData, k: string) => {
  const v = fd.get(k);
  return typeof v === "string" ? v : "";
};

async function fileFrom(fd: FormData, k: string): Promise<tickets.UploadedFile | null> {
  const f = fd.get(k);
  // Пустое поле выбора файла приходит как файл нулевого размера.
  if (!(f instanceof File) || f.size === 0) return null;
  if (f.size > MAX_FILE_BYTES) throw new AppError("validation", "Файл не принят.", { file: "Файл больше 5 МБ." });
  return { name: f.name, bytes: new Uint8Array(await f.arrayBuffer()) };
}

async function run<T extends ActionState>(fn: (actor: Actor, db: Db) => Promise<T | void>): Promise<T | ActionState> {
  const actor = await getActor();
  if (!actor) return { error: "Сессия истекла. Обновите страницу и войдите снова." };
  try {
    const result = await fn(actor, await getDb());
    revalidatePath("/", "layout");
    return result ?? { ok: true };
  } catch (e) {
    if (e instanceof AppError) return { error: e.message, fields: e.fields };
    console.error("[action] непредвиденная ошибка", e);
    return { error: "Не удалось выполнить действие. Данные не изменены, попробуйте ещё раз." };
  }
}

// ---------- Вход ----------

export async function loginAction(fd: FormData): Promise<ActionState> {
  const error = await loginWithPassword(str(fd, "login"), str(fd, "password"));
  if (error) return { error };
  const actor = await getActor();
  redirect(actor ? homeFor(actor.role) : "/");
}

export async function demoLoginAction(fd: FormData): Promise<ActionState> {
  const error = await loginAsDemo(Number(str(fd, "userId")));
  if (error) return { error };
  const actor = await getActor();
  redirect(actor ? homeFor(actor.role) : "/");
}

export async function logoutAction(): Promise<void> {
  await logout();
  redirect("/login");
}

// ---------- Обращения ----------

export async function createTicketAction(fd: FormData): Promise<ActionState> {
  let publicId = "";
  const state = await run(async (actor, db) => {
    const file = await fileFrom(fd, "file");
    const res = await tickets.createTicket(
      db,
      actor,
      {
        type: str(fd, "type"),
        categoryId: str(fd, "categoryId"),
        departmentId: str(fd, "departmentId") || null,
        title: str(fd, "title"),
        description: str(fd, "description"),
        proposedSolution: str(fd, "proposedSolution"),
        clientToken: str(fd, "clientToken"),
      },
      file,
    );
    publicId = res.publicId;
  });
  if (!publicId) return state;
  redirect(`/tickets/${publicId}?created=1`);
}

export async function ticketAction(fd: FormData): Promise<ActionState> {
  const action = str(fd, "action") as TicketAction;
  if (!ACTIONS.includes(action)) return { error: "Неизвестное действие." };
  return run(async (actor, db) => {
    await tickets.performAction(db, actor, str(fd, "publicId"), action, str(fd, "text"));
    return { ok: true, message: "Сохранено." };
  });
}

export async function commentAction(fd: FormData): Promise<ActionState> {
  return run(async (actor, db) => {
    const file = await fileFrom(fd, "file");
    await tickets.addComment(db, actor, str(fd, "publicId"), str(fd, "body"), str(fd, "internal") === "on", file);
    return { ok: true, message: "Комментарий добавлен." };
  });
}

export async function priorityAction(fd: FormData): Promise<ActionState> {
  return run(async (actor, db) => {
    await tickets.setPriority(db, actor, str(fd, "publicId"), str(fd, "priority"));
    return { ok: true, message: "Приоритет обновлён." };
  });
}

export async function dueAction(fd: FormData): Promise<ActionState> {
  return run(async (actor, db) => {
    await tickets.setDueDate(db, actor, str(fd, "publicId"), str(fd, "due"));
    return { ok: true, message: "Срок обновлён." };
  });
}

export async function reassignAction(fd: FormData): Promise<ActionState> {
  return run(async (actor, db) => {
    await tickets.reassign(db, actor, str(fd, "publicId"), str(fd, "assigneeId"), str(fd, "reason"));
    return { ok: true, message: "Ответственный изменён." };
  });
}

export async function markAllReadAction(): Promise<void> {
  await run(async (actor, db) => {
    await markAllRead(db, actor);
  });
}

// ---------- Администрирование ----------

export async function saveCategoryAction(fd: FormData): Promise<ActionState> {
  return run(async (actor, db) => {
    const id = Number(str(fd, "id")) || null;
    await admin.saveCategory(db, actor, id, {
      name: str(fd, "name"),
      resolutionDays: str(fd, "resolutionDays"),
      isActive: id === null ? true : str(fd, "isActive") === "on",
    });
    return { ok: true, message: id === null ? "Категория добавлена." : "Сохранено." };
  });
}

export async function createRuleAction(fd: FormData): Promise<ActionState> {
  return run(async (actor, db) => {
    await admin.createRule(db, actor, {
      categoryId: str(fd, "categoryId"),
      type: str(fd, "type") || null,
      departmentId: str(fd, "departmentId") || null,
      assigneeId: str(fd, "assigneeId"),
    });
    return { ok: true, message: "Правило добавлено." };
  });
}

export async function deleteRuleAction(fd: FormData): Promise<ActionState> {
  return run(async (actor, db) => {
    await admin.deleteRule(db, actor, Number(str(fd, "id")));
    return { ok: true, message: "Правило удалено." };
  });
}

export async function previewRouteAction(fd: FormData): Promise<ActionState & { route?: RouteResult }> {
  return run(async (actor, db) => {
    const route = await admin.previewRoute(db, actor, {
      categoryId: str(fd, "categoryId"),
      type: str(fd, "type"),
      departmentId: str(fd, "departmentId") || null,
    });
    return { ok: true, route };
  });
}

export async function updateUserAction(fd: FormData): Promise<ActionState> {
  return run(async (actor, db) => {
    await admin.updateUser(db, actor, Number(str(fd, "id")), {
      name: str(fd, "name"),
      role: str(fd, "role"),
      departmentId: str(fd, "departmentId") || null,
      isActive: str(fd, "isActive") === "on",
      isAbsent: str(fd, "isAbsent") === "on",
    });
    return { ok: true, message: "Сохранено." };
  });
}

export async function createUserAction(fd: FormData): Promise<ActionState> {
  return run(async (actor, db) => {
    await admin.createUser(db, actor, {
      login: str(fd, "login"),
      name: str(fd, "name"),
      role: str(fd, "role"),
      departmentId: str(fd, "departmentId") || null,
      password: str(fd, "password"),
    });
    return { ok: true, message: "Пользователь создан." };
  });
}

export async function saveSettingsAction(fd: FormData): Promise<ActionState> {
  return run(async (actor, db) => {
    await admin.saveSettings(db, actor, {
      fallbackAssigneeId: str(fd, "fallbackAssigneeId"),
      firstResponseHours: str(fd, "firstResponseHours"),
    });
    return { ok: true, message: "Параметры сохранены." };
  });
}
