import { Metadata } from "next";
import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import { PublicMenu } from "@/components/public/public-menu";

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
      menuItems: {
        where: { isAvailable: true, categoryId: null },
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  if (!location || !location.isPublic) notFound();

  // Serialize Decimal fields for client component
  const categories = location.categories.map((cat) => ({
    id: cat.id,
    name: cat.name,
    menuItems: cat.menuItems.map((item) => ({
      id: item.id,
      name: item.name,
      description: item.description,
      price: Number(item.price),
      imageUrl: item.imageUrl,
      allergens: item.allergens,
      dietaryTags: item.dietaryTags,
    })),
  }));

  const uncategorizedItems = location.menuItems.map((item) => ({
    id: item.id,
    name: item.name,
    description: item.description,
    price: Number(item.price),
    imageUrl: item.imageUrl,
    allergens: item.allergens,
    dietaryTags: item.dietaryTags,
  }));

  return (
    <PublicMenu
      locationId={location.id}
      locationName={location.name}
      orderingEnabled={location.orderingEnabled}
      paymentEnabled={location.paymentEnabled}
      acceptedPayments={location.acceptedPayments}
      categories={categories}
      uncategorizedItems={uncategorizedItems}
      operatingHours={location.operatingHours as Record<string, { open: string; close: string }[] | null> | null}
      timezone={location.timezone}
    />
  );
}
