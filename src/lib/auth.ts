import { createHash, randomBytes } from "node:crypto";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDb, type Queryable } from "../db";
import type { Actor, Role } from "./domain";
import { verifyPassword } from "./password";

const COOKIE = "mf_session";
const TTL_HOURS = 12;

export const isDemoMode = () => process.env.DEMO_MODE?.trim().toLowerCase() === "true";

const sha = (s: string) => createHash("sha256").update(s).digest("hex");

async function startSession(q: Queryable, userId: number) {
  // В cookie лежит случайный токен, в базе хранится только его хэш.
  const token = randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + TTL_HOURS * 3600_000);
  await q.query("DELETE FROM sessions WHERE expires_at < now()");
  await q.query("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1,$2,$3)", [
    sha(token),
    userId,
    expires,
  ]);
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" && process.env.INSECURE_COOKIES !== "true",
    path: "/",
    expires,
  });
}

// Простое ограничение перебора пароля в памяти процесса: 5 неудачных попыток за 5 минут на логин.
const attempts = new Map<string, { n: number; until: number }>();

export async function loginWithPassword(login: string, password: string): Promise<string | null> {
  const key = login.trim().toLowerCase();
  if (!key || !password) return "Введите логин и пароль.";
  const a = attempts.get(key);
  if (a && a.n >= 5 && a.until > Date.now()) return "Слишком много попыток. Повторите через несколько минут.";

  const db = await getDb();
  const [u] = await db.query<{ id: number; password_hash: string }>(
    "SELECT id, password_hash FROM users WHERE login = $1 AND is_active",
    [key],
  );
  if (!u || !verifyPassword(password, u.password_hash)) {
    const cur = a && a.until > Date.now() ? a.n : 0;
    attempts.set(key, { n: cur + 1, until: Date.now() + 5 * 60_000 });
    return "Неверный логин или пароль.";
  }
  attempts.delete(key);
  await startSession(db, u.id);
  return null;
}

/** Вход под подготовленным тестовым аккаунтом. Работает только при DEMO_MODE=true. */
export async function loginAsDemo(userId: number): Promise<string | null> {
  if (!isDemoMode()) return "Демо-вход отключён.";
  const db = await getDb();
  const [u] = await db.query<{ id: number }>("SELECT id FROM users WHERE id = $1 AND is_demo AND is_active", [userId]);
  if (!u) return "Демо-аккаунт недоступен.";
  await startSession(db, u.id);
  return null;
}

export async function logout() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) {
    const db = await getDb();
    await db.query("DELETE FROM sessions WHERE token_hash = $1", [sha(token)]);
  }
  jar.delete(COOKIE);
}

/** Текущий пользователь. Роль и подразделение читаются из базы на каждый запрос. */
export const getActor = cache(async (): Promise<Actor | null> => {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const db = await getDb();
  const [u] = await db.query<{
    id: number;
    login: string;
    name: string;
    role: Role;
    department_id: number | null;
    department_name: string | null;
  }>(
    `SELECT u.id, u.login, u.name, u.role, u.department_id, d.name AS department_name
       FROM sessions s JOIN users u ON u.id = s.user_id
       LEFT JOIN departments d ON d.id = u.department_id
      WHERE s.token_hash = $1 AND s.expires_at > now() AND u.is_active`,
    [sha(token)],
  );
  if (!u) return null;
  return {
    id: u.id,
    login: u.login,
    name: u.name,
    role: u.role,
    departmentId: u.department_id,
    departmentName: u.department_name,
  };
});

export async function requireActor(): Promise<Actor> {
  const actor = await getActor();
  if (!actor) redirect("/login");
  return actor;
}

export function homeFor(role: Role): string {
  if (role === "admin" || role === "manager") return "/overview";
  if (role === "responsible") return "/queue";
  return "/my";
}
