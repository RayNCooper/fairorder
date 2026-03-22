import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";

async function verifyOwnership(menuItemId: string, userId: string) {
  const menuItem = await db.menuItem.findUnique({
    where: { id: menuItemId },
    include: { location: { select: { userId: true } } },
  });

  if (!menuItem || menuItem.location.userId !== userId) {
    return null;
  }

  return menuItem;
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Nicht eingeloggt." }, { status: 401 });
  }

  try {
    const { id } = await params;
    const menuItem = await verifyOwnership(id, session.user.id);
    if (!menuItem) {
      return NextResponse.json(
        { error: "Artikel nicht gefunden." },
        { status: 404 }
      );
    }

    const body = await request.json();
    const data: Record<string, unknown> = {};

    if (body.name !== undefined) {
      if (typeof body.name !== "string" || body.name.trim().length < 1) {
        return NextResponse.json(
          { error: "Bitte gib einen gültigen Namen ein." },
          { status: 400 }
        );
      }
      data.name = body.name.trim();
    }

    if (body.description !== undefined) {
      data.description = body.description?.trim() || null;
    }

    if (body.price !== undefined) {
      if (isNaN(Number(body.price)) || Number(body.price) < 0) {
        return NextResponse.json(
          { error: "Bitte gib einen gültigen Preis ein." },
          { status: 400 }
        );
      }
      data.price = Number(body.price);
    }

    if (body.categoryId !== undefined) {
      // Verify new category belongs to the same location
      if (body.categoryId) {
        const category = await db.category.findFirst({
          where: { id: body.categoryId, locationId: menuItem.locationId },
        });
        if (!category) {
          return NextResponse.json(
            { error: "Kategorie nicht gefunden." },
            { status: 404 }
          );
        }
      }
      data.categoryId = body.categoryId || null;
    }

    if (body.isAvailable !== undefined) {
      data.isAvailable = Boolean(body.isAvailable);
    }

    if (body.sortOrder !== undefined) {
      data.sortOrder = Number(body.sortOrder);
    }

    if (body.allergens !== undefined) {
      data.allergens = body.allergens;
    }

    if (body.dietaryTags !== undefined) {
      data.dietaryTags = body.dietaryTags;
    }

    const updated = await db.menuItem.update({
      where: { id },
      data,
    });

    return NextResponse.json({ menuItem: updated });
  } catch {
    return NextResponse.json(
      { error: "Ein Fehler ist aufgetreten." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Nicht eingeloggt." }, { status: 401 });
  }

  try {
    const { id } = await params;
    const menuItem = await verifyOwnership(id, session.user.id);
    if (!menuItem) {
      return NextResponse.json(
        { error: "Artikel nicht gefunden." },
        { status: 404 }
      );
    }

    await db.menuItem.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Ein Fehler ist aufgetreten." },
      { status: 500 }
    );
  }
}
