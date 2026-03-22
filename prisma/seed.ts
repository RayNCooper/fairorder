import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DATABASE_URL ?? "";
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  // Upsert demo location (idempotent — safe to re-run)
  const location = await prisma.location.upsert({
    where: { slug: "demo-kantine" },
    update: {},
    create: {
      name: "Demo-Kantine",
      slug: "demo-kantine",
      orderingEnabled: true,
      isPublic: true,
      timezone: "Europe/Berlin",
    },
  });

  console.log(`✅ Location: ${location.name} (${location.slug})`);

  // Upsert categories
  const categoryData = [
    { name: "Vorspeisen", sortOrder: 0 },
    { name: "Hauptgerichte", sortOrder: 1 },
    { name: "Desserts", sortOrder: 2 },
  ];

  const categories: Record<string, string> = {};
  for (const cat of categoryData) {
    const existing = await prisma.category.findFirst({
      where: { locationId: location.id, name: cat.name },
    });
    if (existing) {
      categories[cat.name] = existing.id;
    } else {
      const created = await prisma.category.create({
        data: { ...cat, locationId: location.id },
      });
      categories[cat.name] = created.id;
    }
    console.log(`  📂 ${cat.name}`);
  }

  // Upsert menu items
  const menuItems = [
    { name: "Tagessuppe", price: 3.5, categoryName: "Vorspeisen", sortOrder: 0 },
    { name: "Gemischter Salat", price: 4.2, categoryName: "Vorspeisen", sortOrder: 1 },
    { name: "Brötchen mit Aufschnitt", price: 2.8, categoryName: "Vorspeisen", sortOrder: 2 },
    { name: "Schnitzel mit Pommes", price: 7.9, categoryName: "Hauptgerichte", sortOrder: 0 },
    { name: "Currywurst mit Brötchen", price: 5.5, categoryName: "Hauptgerichte", sortOrder: 1 },
    { name: "Gemüsepfanne mit Reis", price: 6.5, categoryName: "Hauptgerichte", sortOrder: 2 },
    { name: "Apfelstrudel", price: 3.2, categoryName: "Desserts", sortOrder: 0 },
    { name: "Vanillepudding", price: 2.5, categoryName: "Desserts", sortOrder: 1 },
    { name: "Obstsalat", price: 3.0, categoryName: "Desserts", sortOrder: 2 },
  ];

  for (const item of menuItems) {
    const existing = await prisma.menuItem.findFirst({
      where: { locationId: location.id, name: item.name },
    });
    if (!existing) {
      await prisma.menuItem.create({
        data: {
          name: item.name,
          price: item.price,
          sortOrder: item.sortOrder,
          locationId: location.id,
          categoryId: categories[item.categoryName],
          isAvailable: true,
        },
      });
    }
    console.log(`    🍽️  ${item.name} — ${item.price.toFixed(2)} €`);
  }

  console.log("\n✅ Seed complete!");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
