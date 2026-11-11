// Интеграционные тесты серверного слоя на настоящей схеме (PGlite в памяти).
// Запуск: npm test

import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { openDb, type Db } from "../src/db";
import dataset from "../src/db/dataset.json";
import { PRIORITY_LABEL, STATUS_LABEL, TYPE_LABEL, type Actor, type TicketType } from "../src/lib/domain";
import { AppError } from "../src/lib/errors";
import { resolveAssignee } from "../src/lib/services/routing";
import {
  addComment,
  createTicket,
  getAttachment,
  getTicketDetail,
  listTickets,
  performAction,
  reassign,
  setDueDate,
  setPriority,
} from "../src/lib/services/tickets";
import { computeAnalytics } from "../src/lib/services/analytics";
import { createRule, listRules, listUsers, saveCategory, updateUser } from "../src/lib/services/admin";
import { listNotifications } from "../src/lib/services/notifications";

let db: Db;

async function actor(login: string): Promise<Actor> {
  const [u] = await db.query(
    `SELECT u.id, u.login, u.name, u.role, u.department_id, d.name AS department_name
       FROM users u LEFT JOIN departments d ON d.id = u.department_id WHERE u.login = $1`,
    [login],
  );
  assert.ok(u, `нет пользователя ${login}`);
  return { id: u.id, login: u.login, name: u.name, role: u.role, departmentId: u.department_id, departmentName: u.department_name };
}

async function rejects(p: Promise<unknown>, code: string) {
  await assert.rejects(p, (e: unknown) => e instanceof AppError && e.code === code, `ожидалась ошибка ${code}`);
}

const newInput = (over: Record<string, unknown> = {}) => ({
  type: "problem",
  categoryId: 0,
  departmentId: null,
  title: "Долгое согласование заявок",
  description: "Заявка на оборудование проходит согласование несколько дней, сроки поставки сдвигаются.",
  proposedSolution: "",
  clientToken: randomUUID(),
  ...over,
});

async function categoryId(name: string): Promise<number> {
  const [c] = await db.query("SELECT id FROM categories WHERE name = $1", [name]);
  return c.id;
}

before(async () => {
  db = await openDb({ memory: true });
});
after(async () => {
  await db.close();
});

test("датасет загружен без искажений: 20 обращений, поля совпадают с исходником", async () => {
  const rows = await db.query(
    `SELECT t.public_id, t.type, t.priority, t.status, t.description, t.dataset_next_action,
            c.name AS category, au.name AS author, asg.name AS responsible, t.is_dataset, t.dates_synthetic
       FROM tickets t JOIN categories c ON c.id = t.category_id
       JOIN users au ON au.id = t.author_id JOIN users asg ON asg.id = t.assignee_id
      ORDER BY t.id`,
  );
  assert.equal(rows.length, 20);
  for (const [i, src] of dataset.entries()) {
    const r = rows[i];
    assert.equal(r.public_id, src.id);
    assert.equal(TYPE_LABEL[r.type as TicketType], src.type);
    assert.equal(r.category, src.category);
    assert.equal(r.author, src.author);
    assert.equal(PRIORITY_LABEL[r.priority as keyof typeof PRIORITY_LABEL], src.priority);
    assert.equal(STATUS_LABEL[r.status as keyof typeof STATUS_LABEL], src.status);
    assert.equal(r.description, src.text);
    assert.equal(r.responsible, src.responsible);
    assert.equal(r.dataset_next_action, src.nextAction);
    assert.equal(r.is_dataset && r.dates_synthetic, true);
  }
});

test("правила маршрутизации воспроизводят ответственных из датасета", async () => {
  const types = Object.fromEntries(Object.entries(TYPE_LABEL).map(([k, v]) => [v, k]));
  for (const src of dataset) {
    const [t] = await db.query("SELECT category_id, department_id FROM tickets WHERE public_id = $1", [src.id]);
    const r = await resolveAssignee(db, {
      categoryId: t.category_id,
      type: types[src.type] as TicketType,
      departmentId: t.department_id,
    });
    assert.equal(r.assigneeName, src.responsible, src.id);
    assert.equal(r.viaFallback, false);
  }
});

test("новое произвольное обращение: номер, маршрутизация, срок, уведомление, защита от дубля", async () => {
  const author = await actor("prodazhi");
  const input = newInput({ categoryId: await categoryId("Интеграции и IT"), departmentId: author.departmentId });
  const first = await createTicket(db, author, input, null);
  assert.equal(first.publicId, "A-021");
  const again = await createTicket(db, author, input, null);
  assert.deepEqual(again, { publicId: "A-021", duplicate: true });

  const { ticket, events } = await getTicketDetail(db, author, "A-021");
  assert.equal(ticket.assignee_name, "IT-специалист");
  assert.equal(ticket.status, "new");
  assert.equal(ticket.department_name, "Продажи");
  assert.ok(ticket.due_at && ticket.due_at > new Date());
  assert.deepEqual(events.map((e) => e.kind), ["created", "assigned"]);
  const notes = await listNotifications(db, await actor("it"));
  assert.ok(notes.some((n) => n.public_id === "A-021"));
});

test("серверная валидация формы", async () => {
  const author = await actor("prodazhi");
  await rejects(createTicket(db, author, newInput({ categoryId: 1, description: "коротко" }), null), "validation");
  await rejects(createTicket(db, author, newInput({ categoryId: 99999 }), null), "validation");
  await rejects(createTicket(db, author, newInput({ categoryId: 1, type: "spam" }), null), "validation");
  await rejects(createTicket(db, author, newInput({ categoryId: 1, title: "" }), null), "validation");
});

test("доступ: чужое обращение неотличимо от несуществующего", async () => {
  // A-021: автор из продаж, ответственный IT-специалист, подразделение «Продажи».
  await rejects(getTicketDetail(db, await actor("zakupki"), "A-021"), "not_found");
  await rejects(getTicketDetail(db, await actor("ruk.zakupok"), "A-021"), "not_found");
  await rejects(getTicketDetail(db, await actor("nomenklatura"), "A-021"), "not_found");
  await rejects(getTicketDetail(db, await actor("zakupki"), "A-999"), "not_found");
  for (const login of ["prodazhi", "it", "ruk.prodazh", "admin"]) {
    const d = await getTicketDetail(db, await actor(login), "A-021");
    assert.equal(d.ticket.public_id, "A-021");
  }
  // Списки: сотрудник видит только свои, обзор ему недоступен.
  const mine = await listTickets(db, await actor("zakupki"), "mine", {});
  assert.ok(mine.rows.length > 0 && mine.rows.every((r) => r.author_name === "Сотрудник закупок"));
  await rejects(listTickets(db, await actor("zakupki"), "scope", {}), "forbidden");
  await rejects(listTickets(db, await actor("it"), "scope", {}), "forbidden");
  const dept = await listTickets(db, await actor("ruk.zakupok"), "scope", {});
  const me = await actor("ruk.zakupok");
  assert.ok(dept.rows.every((r) => r.department_name === "Закупки" || r.assignee_id === me.id || r.author_id === me.id));
  const all = await listTickets(db, await actor("admin"), "scope", {});
  assert.equal(all.total, 21);
});

test("сквозной сценарий: уточнение, ответ автора, решение, закрытие", async () => {
  const author = await actor("prodazhi");
  const handler = await actor("it");

  await rejects(performAction(db, author, "A-021", "take_review", ""), "conflict");
  await rejects(performAction(db, handler, "A-021", "request_info", ""), "validation");
  await performAction(db, handler, "A-021", "request_info", "О каких заявках речь и сколько длится согласование?");
  let d = await getTicketDetail(db, author, "A-021");
  assert.equal(d.ticket.status, "needs_info");
  assert.ok(d.ticket.first_response_at, "зафиксировано время первого ответа");
  assert.ok((await listNotifications(db, author)).some((n) => n.text.includes("нужен ваш ответ")));

  await performAction(db, author, "A-021", "answer", "Заявки на закупку под проект, в среднем четыре рабочих дня.");
  d = await getTicketDetail(db, handler, "A-021");
  assert.equal(d.ticket.status, "in_review");

  await rejects(performAction(db, handler, "A-021", "implement", "ок"), "validation");
  await performAction(db, handler, "A-021", "start_work", "");
  await performAction(db, handler, "A-021", "implement", "Согласование переведено на один шаг, срок сокращён до одного дня.");
  d = await getTicketDetail(db, author, "A-021");
  assert.equal(d.ticket.status, "implemented");
  assert.match(d.ticket.resolution ?? "", /один шаг/);
  assert.ok(d.ticket.finished_at);

  // Повтор того же действия из устаревшей вкладки не проходит.
  await rejects(performAction(db, handler, "A-021", "implement", "Повторная отправка той же формы."), "conflict");
  await performAction(db, author, "A-021", "confirm_close", "");
  d = await getTicketDetail(db, author, "A-021");
  assert.equal(d.ticket.status, "closed");
  await rejects(addComment(db, author, "A-021", "Спасибо", false, null), "conflict");
  await rejects(performAction(db, handler, "A-021", "reopen", "Нужно доработать"), "conflict");
  await performAction(db, await actor("ruk.prodazh"), "A-021", "reopen", "Нужно доработать");
  assert.equal((await getTicketDetail(db, author, "A-021")).ticket.status, "in_review");
});

test("мотивированный отказ обязателен и виден автору", async () => {
  const author = await actor("ofis");
  const { publicId } = await createTicket(
    db,
    author,
    newInput({ type: "suggestion", categoryId: await categoryId("Корпоративная среда"), title: "Вторая переговорная" }),
    null,
  );
  const handler = await actor("adm.rukovoditel");
  await rejects(performAction(db, handler, publicId, "reject", ""), "validation");
  await performAction(db, handler, publicId, "reject", "Свободных помещений нет, вернёмся к вопросу при перепланировке.");
  const d = await getTicketDetail(db, author, publicId);
  assert.equal(d.ticket.status, "rejected");
  assert.match(d.ticket.resolution ?? "", /перепланировке/);
});

test("тип обращения меняет маршрут внутри одной категории", async () => {
  const author = await actor("ofis");
  const { publicId } = await createTicket(
    db,
    author,
    newInput({ type: "praise", categoryId: await categoryId("Корпоративная среда"), title: "Спасибо за встречу" }),
    null,
  );
  assert.equal((await getTicketDetail(db, author, publicId)).ticket.assignee_name, "HR / внутренние коммуникации");
});

test("резервное назначение, если ответственный отсутствует или правила нет", async () => {
  const admin = await actor("admin");
  const users = await listUsers(db, admin);
  const it = users.find((u) => u.login === "it")!;
  await updateUser(db, admin, it.id, { name: it.name, role: it.role, departmentId: String(it.department_id), isActive: true, isAbsent: true });

  const author = await actor("buhgalteria");
  const a = await createTicket(db, author, newInput({ categoryId: await categoryId("Интеграции и IT"), departmentId: author.departmentId }), null);
  let d = await getTicketDetail(db, admin, a.publicId);
  assert.equal(d.ticket.assignee_name, "Администратор системы");
  assert.match(d.events.find((e) => e.kind === "assigned")?.body ?? "", /отсутствует/);

  await saveCategory(db, admin, null, { name: "Склад и логистика", resolutionDays: "7" });
  const b = await createTicket(db, author, newInput({ categoryId: await categoryId("Склад и логистика") }), null);
  d = await getTicketDetail(db, admin, b.publicId);
  assert.equal(d.ticket.assignee_name, "Администратор системы");
  assert.match(d.events.find((e) => e.kind === "assigned")?.body ?? "", /нет подходящего правила/);

  await updateUser(db, admin, it.id, { name: it.name, role: it.role, departmentId: String(it.department_id), isActive: true, isAbsent: false });
  // Руководитель бухгалтерии передаёт обращение своего подразделения; ответственный так не может.
  await rejects(reassign(db, await actor("it"), a.publicId, it.id, ""), "not_found");
  await reassign(db, await actor("ruk.buhgalterii"), a.publicId, it.id, "Вернулся из отпуска");
  assert.equal((await getTicketDetail(db, author, a.publicId)).ticket.assignee_name, "IT-специалист");
  await rejects(reassign(db, await actor("it"), a.publicId, admin.id, ""), "forbidden");
});

test("внутренние заметки и вложения", async () => {
  const author = await actor("zakupki");
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
  const { publicId } = await createTicket(
    db,
    author,
    newInput({ categoryId: await categoryId("Межотдельное взаимодействие") }),
    { name: "C:\\fake\\скрин заявки.png", bytes: png },
  );
  const handler = await actor("ruk.zakupok");
  await addComment(db, handler, publicId, "Проверить, есть ли шаблон в 1С.", true, { name: "note.txt", bytes: new TextEncoder().encode("черновик") });
  await addComment(db, handler, publicId, "Приняли, посмотрим на этой неделе.", false, null);
  await rejects(addComment(db, author, publicId, "заметка", true, null), "forbidden");

  const forAuthor = await getTicketDetail(db, author, publicId);
  assert.equal(forAuthor.events.filter((e) => e.kind === "comment").length, 1);
  assert.deepEqual(forAuthor.attachments.map((a) => a.filename), ["скрин заявки.png"]);
  const forHandler = await getTicketDetail(db, handler, publicId);
  assert.equal(forHandler.events.filter((e) => e.kind === "comment").length, 2);
  assert.equal(forHandler.attachments.length, 2);

  const internalFile = forHandler.attachments.find((a) => a.filename === "note.txt")!;
  await rejects(getAttachment(db, author, internalFile.id), "not_found");
  await rejects(getAttachment(db, await actor("prodazhi"), forAuthor.attachments[0].id), "not_found");
  const got = await getAttachment(db, author, forAuthor.attachments[0].id);
  assert.equal(got.mime, "image/png");
  assert.equal(got.data.length, png.length);

  const bad = (name: string, bytes: Uint8Array) => createTicket(db, author, newInput({ categoryId: 1 }), { name, bytes });
  await rejects(bad("run.exe", png), "validation");
  await rejects(bad("fake.pdf", png), "validation");
  await rejects(bad("big.png", new Uint8Array(5 * 1024 * 1024 + 1)), "validation");

  await setPriority(db, handler, publicId, "high");
  await rejects(setPriority(db, author, publicId, "low"), "forbidden");
  await rejects(setDueDate(db, handler, publicId, "2020-01-01"), "validation");
  await setDueDate(db, handler, publicId, "2031-01-15");
  const d = await getTicketDetail(db, author, publicId);
  assert.equal(d.ticket.priority, "high");
  assert.equal(d.ticket.due_at?.toISOString(), "2031-01-15T18:59:59.000Z");
});

test("фильтры и просрочка", async () => {
  const admin = await actor("admin");
  const problems = await listTickets(db, admin, "scope", { type: "problem", status: "new" });
  assert.ok(problems.rows.length > 0 && problems.rows.every((r) => r.type === "problem" && r.status === "new"));
  const found = await listTickets(db, admin, "scope", { q: "спецификац" });
  assert.ok(found.rows.some((r) => r.public_id === "A-003"));
  const byId = await listTickets(db, admin, "scope", { q: "A-017" });
  assert.deepEqual(byId.rows.map((r) => r.public_id), ["A-017"]);
  await db.query("UPDATE tickets SET due_at = now() - interval '1 day' WHERE public_id = 'A-001'");
  const overdue = await listTickets(db, admin, "scope", { due: "overdue" });
  assert.ok(overdue.rows.some((r) => r.public_id === "A-001"));
  assert.ok(overdue.rows.every((r) => !["implemented", "rejected", "closed"].includes(r.status)));
  const none = await listTickets(db, admin, "scope", { q: "такого текста нет нигде" });
  assert.equal(none.total, 0);
});

test("аналитика считается по сохранённым данным и в пределах прав", async () => {
  const admin = await actor("admin");
  const ds = await computeAnalytics(db, admin, "dataset");
  assert.equal(ds.totals.total, 20);
  const expectType = (label: string) => dataset.filter((t) => t.type === label).length;
  for (const row of ds.byType) assert.equal(row.c, expectType(TYPE_LABEL[row.type]));
  const finals = dataset.filter((t) => ["Реализовано", "Отклонено", "Закрыто"].includes(t.status)).length;
  assert.equal(ds.totals.finished, finals);
  assert.equal(ds.totals.responded, dataset.filter((t) => t.status !== "Новое").length);
  assert.equal(ds.totals.synthetic_in_response, ds.totals.responded);

  const all = await computeAnalytics(db, admin, "all");
  const live = await computeAnalytics(db, admin, "live");
  assert.equal(all.totals.total, ds.totals.total + live.totals.total);

  const mgr = await computeAnalytics(db, await actor("ruk.zakupok"), "all");
  assert.ok(mgr.totals.total > 0 && mgr.totals.total < all.totals.total);
  await rejects(computeAnalytics(db, await actor("zakupki"), "all"), "forbidden");
  await rejects(computeAnalytics(db, await actor("it"), "all"), "forbidden");
  console.log("  группы похожих обращений в датасете:", ds.groups.map((g) => g.map((t) => t.public_id).join("+")).join("; ") || "нет");
});

test("администрирование закрыто для остальных ролей и защищено от опасных изменений", async () => {
  const admin = await actor("admin");
  for (const login of ["zakupki", "it", "ruk.zakupok"]) {
    await rejects(listUsers(db, await actor(login)), "forbidden");
    await rejects(saveCategory(db, await actor(login), null, { name: "Взлом", resolutionDays: "1" }), "forbidden");
  }
  await rejects(saveCategory(db, admin, null, { name: "Обучение", resolutionDays: "5" }), "validation");
  const users = await listUsers(db, admin);
  const hr = users.find((u) => u.login === "hr")!;
  // За HR закреплено правило: понизить до сотрудника нельзя, пока оно не передано.
  await rejects(updateUser(db, admin, hr.id, { name: hr.name, role: "employee", departmentId: null, isActive: true, isAbsent: false }), "conflict");
  await rejects(updateUser(db, admin, admin.id, { name: admin.name, role: "manager", departmentId: null, isActive: true, isAbsent: false }), "conflict");
  const emp = users.find((u) => u.login === "ofis")!;
  const rules = await listRules(db, admin);
  await rejects(createRule(db, admin, { categoryId: String(rules[0].category_id), type: "problem", departmentId: null, assigneeId: String(emp.id) }), "validation");
  await rejects(createRule(db, admin, { categoryId: String(rules[0].category_id), type: null, departmentId: null, assigneeId: String(hr.id) }), "validation");
});

test("создание пользователя: пароль хранится хэшем, логин уникален", async () => {
  const admin = await actor("admin");
  const { createUser } = await import("../src/lib/services/admin");
  const { verifyPassword } = await import("../src/lib/password");
  const password = `test-${randomUUID()}`;
  await createUser(db, admin, { login: "New.User", name: "Новый сотрудник", role: "employee", departmentId: null, password });
  const [u] = await db.query("SELECT login, role, password_hash FROM users WHERE login = 'new.user'");
  assert.equal(u.role, "employee");
  assert.ok(!u.password_hash.includes(password) && verifyPassword(password, u.password_hash));
  assert.equal(verifyPassword("wrong-password", u.password_hash), false);
  await rejects(createUser(db, admin, { login: "new.user", name: "Дубль", role: "employee", departmentId: null, password }), "validation");
  await rejects(createUser(db, admin, { login: "x", name: "Короткий логин", role: "employee", departmentId: null, password }), "validation");
  await rejects(createUser(db, admin, { login: "weak.pass", name: "Слабый пароль", role: "employee", departmentId: null, password: "12345" }), "validation");
  await rejects(createUser(db, await actor("ruk.zakupok"), { login: "hack.er", name: "Чужой", role: "admin", departmentId: null, password }), "forbidden");
});
