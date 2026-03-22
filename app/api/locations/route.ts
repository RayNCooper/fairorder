import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Nicht eingeloggt." }, { status: 401 });
  }

  try {
    const { name, slug } = await request.json();

    if (!name || typeof name !== "string" || name.trim().length < 2) {
      return NextResponse.json(
        { error: "Bitte gib einen gültigen Namen ein (mind. 2 Zeichen)." },
        { status: 400 }
      );
    }

    if (!slug || typeof slug !== "string" || !/^[a-z0-9-]+$/.test(slug)) {
      return NextResponse.json(
        { error: "Ungültiges URL-Kürzel. Nur Kleinbuchstaben, Zahlen und Bindestriche." },
        { status: 400 }
      );
    }

    // Check slug uniqueness
    const existing = await db.location.findUnique({ where: { slug } });
    if (existing) {
      return NextResponse.json(
        { error: "Dieser Name ist vergeben. Bitte wähle ein anderes Kürzel." },
        { status: 409 }
      );
    }

    const location = await db.location.create({
      data: {
        name: name.trim(),
        slug,
        userId: session.user.id,
        orderingEnabled: false,
        isPublic: true,
      },
    });

    return NextResponse.json({ location }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Ein Fehler ist aufgetreten." },
      { status: 500 }
    );
  }
}
