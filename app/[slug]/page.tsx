import { Metadata } from "next";
import { db } from "@/lib/db";
import { notFound } from "next/navigation";

interface MenuPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: MenuPageProps): Promise<Metadata> {
  const { slug } = await params;
  const location = await db.location.findUnique({
    where: { slug },
    select: { name: true },
  });

  if (!location) return { title: "Speisekarte nicht gefunden" };

  return {
    title: `${location.name} — Speisekarte`,
    description: `Aktuelle Speisekarte von ${location.name}. Powered by FairOrder.`,
  };
}

export default async function PublicMenuPage({ params }: MenuPageProps) {
  const { slug } = await params;

  const location = await db.location.findUnique({
    where: { slug },
    include: {
      categories: {
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
        include: {
          menuItems: {
            where: { isAvailable: true },
            orderBy: { sortOrder: "asc" },
          },
        },
      },
      // Also fetch uncategorized items
      menuItems: {
        where: { isAvailable: true, categoryId: null },
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  if (!location || !location.isPublic) notFound();

  const hasItems =
    location.categories.some((c) => c.menuItems.length > 0) ||
    location.menuItems.length > 0;

  return (
    <div className="min-h-dvh bg-[#FAFAF8]">
      {/* Header */}
      <header className="border-b border-stone-200 bg-white px-4 py-6 text-center">
        <h1 className="text-2xl font-extrabold tracking-tight text-stone-900">
          {location.name}
        </h1>
        <p className="mt-1 font-mono text-[11px] uppercase tracking-wider text-stone-400">
          Speisekarte
        </p>
      </header>

      {/* Menu content */}
      <main className="mx-auto max-w-2xl px-4 py-8">
        {!hasItems ? (
          <div className="py-16 text-center">
            <p className="text-sm text-stone-500">
              Die Speisekarte wird gerade aktualisiert.
            </p>
          </div>
        ) : (
          <div className="space-y-10">
            {/* Categorized items */}
            {location.categories.map((category) => {
              if (category.menuItems.length === 0) return null;
              return (
                <section key={category.id}>
                  <h2 className="border-b border-stone-200 pb-2 text-lg font-extrabold tracking-tight text-stone-900">
                    {category.name}
                  </h2>
                  <div className="mt-4 space-y-3">
                    {category.menuItems.map((item) => (
                      <MenuItemCard key={item.id} item={item} />
                    ))}
                  </div>
                </section>
              );
            })}

            {/* Uncategorized items */}
            {location.menuItems.length > 0 && (
              <section>
                <h2 className="border-b border-stone-200 pb-2 text-lg font-extrabold tracking-tight text-stone-900">
                  Weitere Gerichte
                </h2>
                <div className="mt-4 space-y-3">
                  {location.menuItems.map((item) => (
                    <MenuItemCard key={item.id} item={item} />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-stone-200 py-6 text-center">
        <p className="font-mono text-[11px] uppercase tracking-wider text-stone-400">
          Powered by FairOrder
        </p>
      </footer>
    </div>
  );
}

function MenuItemCard({
  item,
}: {
  item: {
    id: string;
    name: string;
    description: string | null;
    price: unknown;
    imageUrl: string | null;
    allergens: string[];
    dietaryTags: string[];
  };
}) {
  const price = Number(item.price);

  return (
    <div className="flex gap-4 border border-stone-200 bg-white p-4">
      {/* Image thumbnail */}
      {item.imageUrl && (
        <div className="h-16 w-16 shrink-0 overflow-hidden bg-stone-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={item.imageUrl}
            alt={item.name}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        </div>
      )}

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-bold text-stone-900">{item.name}</h3>
          <span className="shrink-0 font-mono text-sm font-semibold tabular-nums text-stone-900">
            {price.toFixed(2).replace(".", ",")}&nbsp;&euro;
          </span>
        </div>
        {item.description && (
          <p className="mt-1 line-clamp-2 text-xs text-stone-500">
            {item.description}
          </p>
        )}
        {(item.dietaryTags.length > 0 || item.allergens.length > 0) && (
          <div className="mt-2 flex flex-wrap gap-1">
            {item.dietaryTags.map((tag) => (
              <span
                key={tag}
                className="bg-stone-100 px-1.5 py-0 font-mono text-[10px] text-stone-600"
              >
                {tag}
              </span>
            ))}
            {item.allergens.map((allergen) => (
              <span
                key={allergen}
                className="border border-stone-200 px-1.5 py-0 font-mono text-[10px] text-stone-500"
              >
                {allergen}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
