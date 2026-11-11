// Проверка пути DATABASE_URL: тот же код работает через драйвер `pg` по протоколу PostgreSQL.
// Сервером служит PGlite, открытый на локальном сокете, поэтому внешний Postgres не нужен.
// Это проверяет драйвер и типы данных, но не заменяет прогон на настоящем сервере.

import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { openDb, type Db } from "../src/db";
import type { Actor } from "../src/lib/domain";
import { computeAnalytics } from "../src/lib/services/analytics";
import { addComment, createTicket, getAttachment, getTicketDetail, listTickets, performAction } from "../src/lib/services/tickets";

let db: Db;
let server: PGLiteSocketServer;
let raw: PGlite;

async function actor(login: string): Promise<Actor> {
  const [u] = await db.query("SELECT id, login, name, role, department_id FROM users WHERE login = $1", [login]);
  return { id: u.id, login: u.login, name: u.name, role: u.role, departmentId: u.department_id, departmentName: null };
}

before(async () => {
  raw = new PGlite();
  await raw.waitReady;
  server = new PGLiteSocketServer({ db: raw, port: 54329, host: "127.0.0.1", maxConnections: 5 });
  await server.start();
  process.env.DATABASE_URL = "postgres://postgres:postgres@127.0.0.1:54329/postgres?sslmode=disable";
  db = await openDb();
});
after(async () => {
  await db.close();
  await server.stop();
  await raw.close();
});

test("через драйвер pg: миграции, сид, сценарий, вложение, аналитика", async () => {
  assert.equal(db.kind, "postgres");
  const admin = await actor("admin");
  const all = await listTickets(db, admin, "scope", {});
  assert.equal(all.total, 20);
  assert.equal(typeof all.counts.active, "number");
  assert.ok(all.rows[0].created_at instanceof Date);

  const author = await actor("zakupki");
  const [cat] = await db.query("SELECT id FROM categories WHERE name = 'Обучение'");
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3, 4]);
  const { publicId } = await createTicket(
    db,
    author,
    {
      type: "suggestion",
      categoryId: cat.id,
      departmentId: author.departmentId,
      title: "Короткие видеоинструкции",
      description: "Предлагаю записывать короткие видеоинструкции по новым товарным линейкам.",
      proposedSolution: "",
      clientToken: randomUUID(),
    },
    { name: "пример.png", bytes: png },
  );
  assert.equal(publicId, "A-021");
  const handler = await actor("obuchenie");
  await performAction(db, handler, publicId, "request_info", "Какой длительности ролики нужны?");
  await performAction(db, author, publicId, "answer", "До пяти минут.");
  await addComment(db, handler, publicId, "Берём в план.", false, null);
  await performAction(db, handler, publicId, "implement", "Записаны первые три ролика, ссылка в базе знаний.");

  const d = await getTicketDetail(db, author, publicId);
  assert.equal(d.ticket.status, "implemented");
  assert.ok(d.ticket.first_response_at instanceof Date && d.ticket.due_at instanceof Date);
  const file = await getAttachment(db, author, d.attachments[0].id);
  assert.deepEqual([...file.data], [...png]);

  const a = await computeAnalytics(db, admin, "all");
  assert.equal(a.totals.total, 21);
  assert.equal(typeof a.totals.avg_first_response_h, "number");

  // Нарушение уникальности распознаётся одинаково в обоих драйверах.
  const { saveCategory } = await import("../src/lib/services/admin");
  await assert.rejects(saveCategory(db, admin, null, { name: "Обучение", resolutionDays: "5" }), /уже есть/);
});
