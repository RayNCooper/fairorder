import { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { MenuImport } from "@/components/dashboard/menu-import";

export const metadata: Metadata = {
  title: "Import",
};

export default async function ImportPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const location = await db.location.findFirst({
    where: { userId: session.user.id },
  });

  if (!location) redirect("/setup");

  const categories = await db.category.findMany({
    where: { locationId: location.id },
    orderBy: { sortOrder: "asc" },
    select: { id: true, name: true },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">
          Speisekarte importieren
        </h1>
        <p className="mt-1 text-sm text-stone-500">
          Importiere Gerichte aus einem Bild, einer Website oder erstelle sie manuell.
        </p>
      </div>

      <MenuImport categories={categories} />
    </div>
  );
}
