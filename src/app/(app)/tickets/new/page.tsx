import type { Metadata } from "next";
import { randomUUID } from "node:crypto";
import { PageHeader } from "@/components/ui";
import { getDb } from "@/db";
import { requireActor } from "@/lib/auth";
import { listFormOptions } from "@/lib/services/tickets";
import { NewTicketForm } from "./new-ticket-form";

export const metadata: Metadata = { title: "Новое обращение" };

export default async function NewTicketPage() {
  const actor = await requireActor();
  const options = await listFormOptions(await getDb());
  return (
    <div className="mx-auto max-w-[720px]">
      <PageHeader
        title="Новое обращение"
        description="После отправки обращение получит номер и ответственного. Ход рассмотрения будет виден в разделе «Мои обращения»."
        back={{ href: "/my", label: "Мои обращения" }}
      />
      <NewTicketForm
        categories={options.categories}
        departments={options.departments}
        defaultDepartmentId={actor.departmentId}
        clientToken={randomUUID()}
      />
    </div>
  );
}
