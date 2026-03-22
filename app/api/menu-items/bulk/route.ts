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

    // Get the current max sort order
    const lastItem = await db.menuItem.findFirst({
      where: { locationId: location.id },
      orderBy: { sortOrder: "desc" },
    });

    let sortOrder = (lastItem?.sortOrder ?? -1) + 1;

    const created = await db.$transaction(
      items.map((item: { name: string; price: string }) => {
        const priceNum = parseFloat(
          (item.price ?? "0").replace(",", ".")
        );
        return db.menuItem.create({
          data: {
            name: item.name.trim(),
            price: isNaN(priceNum) || priceNum < 0 ? 0 : priceNum,
            locationId: location.id,
            isAvailable: true,
            sortOrder: sortOrder++,
          },
        });
      })
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
