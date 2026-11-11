export type ActionState = {
  ok?: boolean;
  /** Сообщение об успехе. */
  message?: string;
  /** Общая ошибка формы. */
  error?: string;
  /** Ошибки по полям. */
  fields?: Record<string, string>;
};
