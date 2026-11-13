import { openDb } from "../src/db";

async function main() {
  if (!process.env.DATABASE_URL?.trim()) {
    throw new Error("DATABASE_URL is required to initialize the deployment database.");
  }
  const db = await openDb();
  try {
    const [result] = await db.query<{ tickets: number; users: number }>(
      "SELECT (SELECT count(*)::int FROM tickets) AS tickets, (SELECT count(*)::int FROM users) AS users",
    );
    console.log(JSON.stringify({ database: db.kind, ...result }));
  } finally {
    await db.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Database initialization failed");
  process.exitCode = 1;
});
