import type { Metadata } from "next";
import { Denied } from "@/components/denied";
import { TicketList } from "@/components/ticket-list";
import { PageHeader } from "@/components/ui";
import { requireActor } from "@/lib/auth";
import { parseFilters } from "@/lib/services/tickets";

export const metadata: Metadata = { title: "Обзор" };

export default async function OverviewPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const actor = await requireActor();
  if (actor.role !== "manager" && actor.role !== "admin") return <Denied />;
  const sp = await searchParams;
  const admin = actor.role === "admin";
  const description = admin
    ? "Обращения всех подразделений. Здесь же видны обращения без ответственного и просроченные."
    : actor.departmentName
      ? `Обращения подразделения «${actor.departmentName}» и те, где вы автор или ответственный.`
      : "За вами не закреплено подразделение, поэтому здесь только обращения, где вы автор или ответственный.";
  return (
    <>
      <PageHeader title={admin ? "Все обращения" : "Обзор подразделения"} description={description} />
      <TicketList
        actor={actor}
        view="scope"
        basePath="/overview"
        searchParams={sp}
        filters={parseFilters(sp)}
        emptyTitle="Обращений пока нет"
        emptyText="Когда сотрудники подразделения отправят обращения, они появятся в этом списке."
      />
    </>
  );
}
