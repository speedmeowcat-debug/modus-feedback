import { redirect } from "next/navigation";
import { getActor, homeFor } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function Home() {
  const actor = await getActor();
  redirect(actor ? homeFor(actor.role) : "/login");
}
