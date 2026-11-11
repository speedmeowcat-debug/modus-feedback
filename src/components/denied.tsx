import { Lock } from "lucide-react";
import { Card, EmptyState, LinkButton } from "./ui";

export function Denied({ text }: { text?: string }) {
  return (
    <Card className="mx-auto mt-6 max-w-xl">
      <EmptyState
        icon={<Lock className="size-5" aria-hidden />}
        title="Нет доступа"
        action={<LinkButton href="/">На главную</LinkButton>}
      >
        {text ?? "Этот раздел недоступен для вашей роли. Если доступ нужен для работы, обратитесь к администратору системы."}
      </EmptyState>
    </Card>
  );
}
