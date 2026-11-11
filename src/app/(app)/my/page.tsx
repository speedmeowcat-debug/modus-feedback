import type { Metadata } from "next";
import { Plus } from "lucide-react";
import { TicketList } from "@/components/ticket-list";
import { LinkButton, PageHeader } from "@/components/ui";
import { requireActor } from "@/lib/auth";
import { parseFilters } from "@/lib/services/tickets";

export const metadata: Metadata = { title: "Мои обращения" };

export default async function MyPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const actor = await requireActor();
  const sp = await searchParams;
  return (
    <>
      <PageHeader
        title="Мои обращения"
        description="Всё, что вы отправили: текущий статус, ответственный и итог рассмотрения."
        actions={
          <LinkButton href="/tickets/new" variant="primary">
            <Plus className="size-4" aria-hidden />
            Новое обращение
          </LinkButton>
        }
      />
      <TicketList
        actor={actor}
        view="mine"
        basePath="/my"
        searchParams={sp}
        filters={parseFilters(sp)}
        emptyTitle="Вы ещё не отправляли обращений"
        emptyText="Расскажите о проблеме, предложите улучшение или отметьте то, что работает хорошо. Обращение сразу получит номер и ответственного."
      />
    </>
  );
}
