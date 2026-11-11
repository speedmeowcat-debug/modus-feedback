import { SearchX } from "lucide-react";
import { Card, EmptyState, LinkButton } from "@/components/ui";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh items-center justify-center p-5">
      <Card className="w-full max-w-xl">
        <EmptyState
          icon={<SearchX className="size-5" aria-hidden />}
          title="Страница не найдена"
          action={
            <LinkButton href="/" variant="primary">
              На главную
            </LinkButton>
          }
        >
          Возможно, ссылка устарела или в адресе опечатка.
        </EmptyState>
      </Card>
    </main>
  );
}
