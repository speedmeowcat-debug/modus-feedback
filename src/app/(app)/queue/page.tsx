import type { Metadata } from "next";
import { Denied } from "@/components/denied";
import { TicketList } from "@/components/ticket-list";
import { PageHeader } from "@/components/ui";
import { requireActor } from "@/lib/auth";
import { parseFilters } from "@/lib/services/tickets";

export const metadata: Metadata = { title: "Моя очередь" };

export default async function QueuePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const actor = await requireActor();
  if (actor.role === "employee") return <Denied text="Очередь доступна сотрудникам, которым назначают обращения на рассмотрение." />;
  const sp = await searchParams;
  return (
    <>
      <PageHeader
        title="Моя очередь"
        description="Обращения, где вы назначены ответственным. По умолчанию сверху те, у которых срок ближе."
      />
      <TicketList
        actor={actor}
        view="queue"
        basePath="/queue"
        searchParams={sp}
        filters={parseFilters(sp)}
        emptyTitle="Очередь пуста"
        emptyText="Вам пока не назначено ни одного обращения. Новые появятся здесь автоматически, и вы получите уведомление."
      />
    </>
  );
}
