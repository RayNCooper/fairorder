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
    });

    if (!location) {
      return NextResponse.json(
        { error: "Kein Standort gefunden." },
        { status: 404 }
      );
    }

    const body = await request.json();

    if (!body.name || typeof body.name !== "string" || body.name.trim().length < 1) {
      return NextResponse.json(
        { error: "Bitte gib einen Artikelnamen ein." },
        { status: 400 }
      );
    }

    if (body.price === undefined || body.price === null || isNaN(Number(body.price)) || Number(body.price) < 0) {
      return NextResponse.json(
        { error: "Bitte gib einen gültigen Preis ein." },
        { status: 400 }
      );
    }

    // Verify category belongs to this location if provided
    if (body.categoryId) {
      const category = await db.category.findFirst({
        where: { id: body.categoryId, locationId: location.id },
      });
      if (!category) {
        return NextResponse.json(
          { error: "Kategorie nicht gefunden." },
          { status: 404 }
        );
      }
    }

    // Get the next sort order within the category
    const lastItem = await db.menuItem.findFirst({
      where: {
        locationId: location.id,
        categoryId: body.categoryId || null,
      },
      orderBy: { sortOrder: "desc" },
    });

    // Validate vatRate if provided (must be 0, 7, or 19)
    const vatRate = body.vatRate !== undefined ? Number(body.vatRate) : 7;
    if (![0, 7, 19].includes(vatRate)) {
      return NextResponse.json(
        { error: "MwSt.-Satz muss 0, 7 oder 19 sein." },
        { status: 400 }
      );
    }

    const menuItem = await db.menuItem.create({
      data: {
        name: body.name.trim(),
        description: body.description?.trim() || null,
        price: Number(body.price),
        vatRate,
        imageUrl: body.imageUrl?.trim() || null,
        categoryId: body.categoryId || null,
        locationId: location.id,
        isAvailable: body.isAvailable ?? true,
        sortOrder: (lastItem?.sortOrder ?? -1) + 1,
        allergens: body.allergens || [],
        dietaryTags: body.dietaryTags || [],
      },
    });

    return NextResponse.json({ menuItem }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Ein Fehler ist aufgetreten." },
      { status: 500 }
    );
  }
}
