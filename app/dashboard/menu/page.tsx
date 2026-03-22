import { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { MenuManager } from "@/components/dashboard/menu-manager";

export const metadata: Metadata = {
  title: "Speisekarte",
};

export default async function MenuPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const location = await db.location.findFirst({
    where: { userId: session.user.id },
  });

  if (!location) {
    redirect("/setup");
  }

  const categories = await db.category.findMany({
    where: { locationId: location.id },
    include: {
      menuItems: {
        orderBy: { sortOrder: "asc" },
      },
    },
    orderBy: { sortOrder: "asc" },
  });

  // Serialize Decimal fields to strings for client component
  const serializedCategories = categories.map((cat: typeof categories[number]) => ({
    ...cat,
    menuItems: cat.menuItems.map((item: typeof cat.menuItems[number]) => ({
      ...item,
      price: item.price.toString(),
    })),
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">
            Speisekarte
          </h1>
          <p className="mt-1 text-sm text-stone-500">
            Verwalte Kategorien und Artikel für{" "}
            <span className="font-semibold text-stone-700">
              {location.name}
            </span>
          </p>
        </div>
      </div>

      <MenuManager initialCategories={serializedCategories} />
    </div>
  );
}
