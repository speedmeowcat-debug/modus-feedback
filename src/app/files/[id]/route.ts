import { getDb } from "@/db";
import { getActor } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { getAttachment } from "@/lib/services/tickets";

export const dynamic = "force-dynamic";

/** Отдаёт вложение только тем, кто видит обращение. Файл всегда скачивается, а не открывается в браузере. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getActor();
  if (!actor) return new Response("Требуется вход", { status: 401 });
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) return new Response("Файл не найден", { status: 404 });
  try {
    const file = await getAttachment(await getDb(), actor, id);
    const ascii = file.filename.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
    return new Response(Buffer.from(file.data), {
      headers: {
        "Content-Type": file.mime,
        "Content-Length": String(file.data.length),
        "Content-Disposition": `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(file.filename)}`,
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    if (e instanceof AppError) return new Response("Файл не найден", { status: 404 });
    throw e;
  }
}
