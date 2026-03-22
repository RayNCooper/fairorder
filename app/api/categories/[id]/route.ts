import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";

async function verifyOwnership(categoryId: string, userId: string) {
  const category = await db.category.findUnique({
    where: { id: categoryId },
    include: { location: { select: { userId: true } } },
  });

  if (!category || category.location.userId !== userId) {
    return null;
  }

  return category;
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
    const category = await verifyOwnership(id, session.user.id);
    if (!category) {
      return NextResponse.json(
        { error: "Kategorie nicht gefunden." },
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

    if (body.sortOrder !== undefined) {
      data.sortOrder = Number(body.sortOrder);
    }

    if (body.isActive !== undefined) {
      data.isActive = Boolean(body.isActive);
    }

    const updated = await db.category.update({
      where: { id },
      data,
      include: { menuItems: { orderBy: { sortOrder: "asc" } } },
    });

    return NextResponse.json({ category: updated });
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
    const category = await verifyOwnership(id, session.user.id);
    if (!category) {
      return NextResponse.json(
        { error: "Kategorie nicht gefunden." },
        { status: 404 }
      );
    }

    await db.category.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Ein Fehler ist aufgetreten." },
      { status: 500 }
    );
  }
}
