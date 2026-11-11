import { Denied } from "@/components/denied";
import { PageHeader } from "@/components/ui";
import { requireActor } from "@/lib/auth";
import { AdminTabs } from "./admin-tabs";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const actor = await requireActor();
  if (actor.role !== "admin") return <Denied text="Настройки системы доступны только администратору." />;
  return (
    <>
      <PageHeader title="Настройки" description="Категории, правила назначения ответственных, пользователи и параметры сроков." />
      <AdminTabs />
      {children}
    </>
  );
}
