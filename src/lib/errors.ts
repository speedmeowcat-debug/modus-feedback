export type ErrorCode = "validation" | "forbidden" | "not_found" | "conflict";

/** Ожидаемая ошибка с текстом, который можно показать пользователю. */
export class AppError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public fields?: Record<string, string>,
  ) {
    super(message);
  }
}

export const forbidden = (msg = "Недостаточно прав для этого действия.") => new AppError("forbidden", msg);
export const notFound = (msg = "Объект не найден или у вас нет к нему доступа.") => new AppError("not_found", msg);
export const invalid = (msg: string, fields?: Record<string, string>) => new AppError("validation", msg, fields);
