// Миграции хранятся в коде, чтобы одинаково работать локально и в serverless-сборке.
// Диалект: PostgreSQL. Каждая миграция применяется один раз и в транзакции.

export const MIGRATIONS: { id: string; sql: string }[] = [
  {
    id: "001_init",
    sql: `
CREATE TABLE departments (
  id         SERIAL PRIMARY KEY,
  name       TEXT NOT NULL UNIQUE,
  is_active  BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE users (
  id            SERIAL PRIMARY KEY,
  login         TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('employee','responsible','manager','admin')),
  department_id INTEGER REFERENCES departments(id),
  password_hash TEXT NOT NULL,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  is_absent     BOOLEAN NOT NULL DEFAULT FALSE,
  is_demo       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE categories (
  id              SERIAL PRIMARY KEY,
  name            TEXT NOT NULL UNIQUE,
  resolution_days INTEGER NOT NULL DEFAULT 14 CHECK (resolution_days BETWEEN 1 AND 365),
  is_active       BOOLEAN NOT NULL DEFAULT TRUE
);

-- Правило маршрутизации. NULL в type или department_id означает «любой».
-- При подборе побеждает самое точное правило: совпадение типа весит 2, подразделения 1.
CREATE TABLE routing_rules (
  id            SERIAL PRIMARY KEY,
  category_id   INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  type          TEXT CHECK (type IN ('problem','suggestion','praise')),
  department_id INTEGER REFERENCES departments(id),
  assignee_id   INTEGER NOT NULL REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX routing_rules_uniq
  ON routing_rules (category_id, COALESCE(type, ''), COALESCE(department_id, 0));

CREATE TABLE settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE SEQUENCE ticket_number_seq START 1;

CREATE TABLE tickets (
  id                  SERIAL PRIMARY KEY,
  public_id           TEXT NOT NULL UNIQUE,
  type                TEXT NOT NULL CHECK (type IN ('problem','suggestion','praise')),
  category_id         INTEGER NOT NULL REFERENCES categories(id),
  department_id       INTEGER REFERENCES departments(id),
  author_id           INTEGER NOT NULL REFERENCES users(id),
  assignee_id         INTEGER REFERENCES users(id),
  title               TEXT,
  description         TEXT NOT NULL,
  proposed_solution   TEXT,
  priority            TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high')),
  status              TEXT NOT NULL DEFAULT 'new'
                      CHECK (status IN ('new','in_review','in_progress','needs_info','implemented','rejected','closed')),
  status_before_info  TEXT,
  resolution          TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  first_response_at   TIMESTAMPTZ,
  due_at              TIMESTAMPTZ,
  finished_at         TIMESTAMPTZ,
  -- Признаки импорта из демонстрационного датасета.
  is_dataset          BOOLEAN NOT NULL DEFAULT FALSE,
  dates_synthetic     BOOLEAN NOT NULL DEFAULT FALSE,
  dataset_next_action TEXT,
  -- Защита от двойной отправки формы.
  client_token        TEXT UNIQUE
);
CREATE INDEX tickets_author_idx   ON tickets (author_id);
CREATE INDEX tickets_assignee_idx ON tickets (assignee_id);
CREATE INDEX tickets_dept_idx     ON tickets (department_id);
CREATE INDEX tickets_status_idx   ON tickets (status);

CREATE TABLE ticket_events (
  id           SERIAL PRIMARY KEY,
  ticket_id    INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  actor_id     INTEGER REFERENCES users(id),
  kind         TEXT NOT NULL CHECK (kind IN (
                 'created','assigned','status','comment','clarification_request',
                 'clarification_answer','priority','due')),
  from_value   TEXT,
  to_value     TEXT,
  body         TEXT,
  is_internal  BOOLEAN NOT NULL DEFAULT FALSE,
  is_synthetic BOOLEAN NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ticket_events_ticket_idx ON ticket_events (ticket_id, created_at, id);

CREATE TABLE attachments (
  id          SERIAL PRIMARY KEY,
  ticket_id   INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  event_id    INTEGER REFERENCES ticket_events(id) ON DELETE SET NULL,
  uploader_id INTEGER NOT NULL REFERENCES users(id),
  filename    TEXT NOT NULL,
  mime        TEXT NOT NULL,
  size        INTEGER NOT NULL,
  data        BYTEA NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX attachments_ticket_idx ON attachments (ticket_id);

CREATE TABLE notifications (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ticket_id  INTEGER REFERENCES tickets(id) ON DELETE CASCADE,
  text       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  read_at    TIMESTAMPTZ
);
CREATE INDEX notifications_user_idx ON notifications (user_id, read_at, created_at DESC);

CREATE TABLE audit_log (
  id         SERIAL PRIMARY KEY,
  actor_id   INTEGER REFERENCES users(id),
  action     TEXT NOT NULL,
  details    TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
`,
  },
];
