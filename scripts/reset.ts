// Удаляет локальную базу PGlite. При следующем запуске приложение создаст её заново
// и загрузит 20 обращений датасета. Запускать при остановленном сервере.
import fs from "node:fs";
import path from "node:path";

if (process.env.DATABASE_URL) {
  console.error("Задан DATABASE_URL: внешний PostgreSQL этим скриптом не очищается.");
  process.exit(1);
}
const dir = path.resolve(process.env.PGLITE_DIR || ".data/pglite");
fs.rmSync(dir, { recursive: true, force: true });
console.log(`Удалено: ${dir}. База будет создана заново при следующем запуске.`);
