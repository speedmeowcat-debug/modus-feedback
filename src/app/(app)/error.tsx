"use client";

import { useEffect } from "react";
import { CircleAlert } from "lucide-react";
import { Button, Card, EmptyState } from "@/components/ui";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <Card className="mx-auto mt-6 max-w-xl">
      <EmptyState
        icon={<CircleAlert className="size-5" aria-hidden />}
        title="Не удалось загрузить страницу"
        action={
          <Button variant="primary" onClick={reset}>
            Повторить
          </Button>
        }
      >
        Данные не изменились. Попробуйте ещё раз. Если ошибка повторяется, сообщите администратору
        {error.digest ? ` код ${error.digest}` : ""}.
      </EmptyState>
    </Card>
  );
}
