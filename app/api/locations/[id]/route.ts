import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Nicht eingeloggt." }, { status: 401 });
  }

  const { id } = await params;

  try {
    // Verify ownership
    const location = await db.location.findUnique({
      where: { id },
      select: { userId: true },
    });

    if (!location) {
      return NextResponse.json(
        { error: "Standort nicht gefunden." },
        { status: 404 }
      );
    }

    if (location.userId !== session.user.id) {
      return NextResponse.json(
        { error: "Keine Berechtigung." },
        { status: 403 }
      );
    }

    const body = await request.json();

    // Validate and sanitize input
    const updateData: Record<string, unknown> = {};

    if (body.name !== undefined) {
      if (typeof body.name !== "string" || body.name.trim().length < 2) {
        return NextResponse.json(
          { error: "Name muss mindestens 2 Zeichen lang sein." },
          { status: 400 }
        );
      }
      updateData.name = body.name.trim();
    }

    if (body.operatingHours !== undefined) {
      updateData.operatingHours = body.operatingHours;
    }

    if (body.orderingEnabled !== undefined) {
      if (typeof body.orderingEnabled !== "boolean") {
        return NextResponse.json(
          { error: "orderingEnabled muss ein Boolean sein." },
          { status: 400 }
        );
      }
      updateData.orderingEnabled = body.orderingEnabled;
    }

    if (body.maxActiveOrders !== undefined) {
      const max = Number(body.maxActiveOrders);
      if (isNaN(max) || max < 1 || max > 999) {
        return NextResponse.json(
          { error: "Maximale Bestellungen muss zwischen 1 und 999 liegen." },
          { status: 400 }
        );
      }
      updateData.maxActiveOrders = max;
    }

    if (body.paymentEnabled !== undefined) {
      if (typeof body.paymentEnabled !== "boolean") {
        return NextResponse.json(
          { error: "paymentEnabled muss ein Boolean sein." },
          { status: 400 }
        );
      }
      updateData.paymentEnabled = body.paymentEnabled;
    }

    if (body.acceptedPayments !== undefined) {
      if (
        !Array.isArray(body.acceptedPayments) ||
        !body.acceptedPayments.every(
          (p: unknown) => typeof p === "string" && ["cash", "stripe"].includes(p as string)
        )
      ) {
        return NextResponse.json(
          { error: "acceptedPayments muss ein Array aus 'cash' und/oder 'stripe' sein." },
          { status: 400 }
        );
      }
      updateData.acceptedPayments = body.acceptedPayments;
    }

    const updated = await db.location.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ location: updated });
  } catch {
    return NextResponse.json(
      { error: "Ein Fehler ist aufgetreten." },
      { status: 500 }
    );
  }
}
