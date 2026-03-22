import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
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

    const categories = await db.category.findMany({
      where: { locationId: location.id },
      include: {
        menuItems: {
          orderBy: { sortOrder: "asc" },
        },
      },
      orderBy: { sortOrder: "asc" },
    });

    return NextResponse.json({ categories });
  } catch {
    return NextResponse.json(
      { error: "Ein Fehler ist aufgetreten." },
      { status: 500 }
    );
  }
}

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

    const { name } = await request.json();

    if (!name || typeof name !== "string" || name.trim().length < 1) {
      return NextResponse.json(
        { error: "Bitte gib einen Kategorienamen ein." },
        { status: 400 }
      );
    }

    // Get the next sort order
    const lastCategory = await db.category.findFirst({
      where: { locationId: location.id },
      orderBy: { sortOrder: "desc" },
    });

    const category = await db.category.create({
      data: {
        name: name.trim(),
        locationId: location.id,
        sortOrder: (lastCategory?.sortOrder ?? -1) + 1,
      },
      include: {
        menuItems: true,
      },
    });

    return NextResponse.json({ category }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Ein Fehler ist aufgetreten." },
      { status: 500 }
    );
  }
}
