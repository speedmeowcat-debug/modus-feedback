import type { Metadata } from "next";
import { Card, SectionTitle } from "@/components/ui";
import { getDb } from "@/db";
import { requireActor } from "@/lib/auth";
import { listCategories } from "@/lib/services/admin";
import { CategoryCreateForm, CategoryRowForm } from "../admin-forms";

export const metadata: Metadata = { title: "Категории" };

export default async function CategoriesPage() {
  const actor = await requireActor();
  if (actor.role !== "admin") return null;
  const categories = await listCategories(await getDb(), actor);
  return (
    <div className="space-y-5">
      <Card className="p-5 sm:p-6">
        <SectionTitle>Новая категория</SectionTitle>
        <CategoryCreateForm />
      </Card>
      <Card>
        <div className="px-4 pt-5 sm:px-5">
          <SectionTitle hint="Отключённая категория не показывается в форме, прежние обращения сохраняются">
            Категории ({categories.length})
          </SectionTitle>
        </div>
        <ul className="divide-y divide-line border-t border-line">
          {categories.map((c) => (
            <li key={c.id} className={c.is_active ? undefined : "bg-sunken/60"}>
              <CategoryRowForm c={c} />
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
