import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Nicht eingeloggt." }, { status: 401 });
  }

  try {
    const location = await db.location.findFirst({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
    });

    if (!location) {
      return NextResponse.json(
        { error: "Kein Standort gefunden." },
        { status: 404 }
      );
    }

    const { items } = await request.json();

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "Keine Gerichte zum Importieren." },
        { status: 400 }
      );
    }

    // Filter out items with blank names
    const validItems = items.filter(
      (i: { name?: string }) => i.name && i.name.trim().length > 0
    );
    if (validItems.length === 0) {
      return NextResponse.json(
        { error: "Keine gültigen Gerichte (alle Namen leer)." },
        { status: 400 }
      );
    }

    // Get the current max sort order
    const lastItem = await db.menuItem.findFirst({
      where: { locationId: location.id },
      orderBy: { sortOrder: "desc" },
    });

    let sortOrder = (lastItem?.sortOrder ?? -1) + 1;

    // Resolve category names to IDs if provided
    const categoryNames = [
      ...new Set(
        validItems
          .map((i: { category?: string }) => i.category?.trim())
          .filter(Boolean) as string[]
      ),
    ];

    const categoryMap = new Map<string, string>();
    if (categoryNames.length > 0) {
      // Find existing categories
      const existing = await db.category.findMany({
        where: { locationId: location.id, name: { in: categoryNames } },
      });
      for (const cat of existing) {
        categoryMap.set(cat.name.toLowerCase(), cat.id);
      }

      // Create missing categories
      const lastCat = await db.category.findFirst({
        where: { locationId: location.id },
        orderBy: { sortOrder: "desc" },
      });
      let catSortOrder = (lastCat?.sortOrder ?? -1) + 1;

      for (const name of categoryNames) {
        if (!categoryMap.has(name.toLowerCase())) {
          const created = await db.category.create({
            data: {
              name,
              locationId: location.id,
              sortOrder: catSortOrder++,
            },
          });
          categoryMap.set(name.toLowerCase(), created.id);
        }
      }
    }

    const created = await db.$transaction(
      validItems.map(
        (item: {
          name: string;
          price: string | number;
          description?: string;
          category?: string;
          categoryId?: string;
          allergens?: string[];
          dietaryTags?: string[];
          taxRate?: number;
        }) => {
          const priceNum =
            typeof item.price === "number"
              ? item.price
              : parseFloat((item.price ?? "0").replace(",", "."));

          const categoryId =
            item.categoryId ??
            (item.category
              ? categoryMap.get(item.category.trim().toLowerCase())
              : undefined) ??
            null;

          // Default to 7% (food); use 19% only if explicitly set
          const taxRate = item.taxRate === 19 ? 19 : 7;

          return db.menuItem.create({
            data: {
              name: item.name.trim(),
              description: item.description?.trim() || null,
              price: isNaN(priceNum) || priceNum < 0 ? 0 : priceNum,
              locationId: location.id,
              categoryId,
              isAvailable: true,
              taxRate,
              sortOrder: sortOrder++,
              allergens: item.allergens ?? [],
              dietaryTags: item.dietaryTags ?? [],
            },
          });
        }
      )
    );

    return NextResponse.json(
      { count: created.length },
      { status: 201 }
    );
  } catch {
    return NextResponse.json(
      { error: "Ein Fehler ist aufgetreten." },
      { status: 500 }
    );
  }
}
