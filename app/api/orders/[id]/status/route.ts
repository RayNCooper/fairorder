import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";

type OrderStatus = "PENDING" | "PREPARING" | "READY" | "COMPLETED" | "CANCELLED";

const ALL_STATUSES: OrderStatus[] = ["PENDING", "PREPARING", "READY", "COMPLETED", "CANCELLED"];

const VALID_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ["PREPARING", "CANCELLED"],
  PREPARING: ["READY", "CANCELLED"],
  READY: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

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
    const body = await request.json();
    const newStatus = body.status as OrderStatus;

    if (!newStatus || !ALL_STATUSES.includes(newStatus)) {
      return NextResponse.json(
        { error: "Ungültiger Status." },
        { status: 400 }
      );
    }

    // Fetch the order and verify ownership via location
    const order = await db.order.findUnique({
      where: { id },
      include: { location: { select: { userId: true } } },
    });

    if (!order) {
      return NextResponse.json(
        { error: "Bestellung nicht gefunden." },
        { status: 404 }
      );
    }

    if (order.location.userId !== session.user.id) {
      return NextResponse.json(
        { error: "Keine Berechtigung." },
        { status: 403 }
      );
    }

    // Validate status transition
    const allowedTransitions = VALID_TRANSITIONS[order.status as OrderStatus];
    if (!allowedTransitions.includes(newStatus)) {
      return NextResponse.json(
        {
          error: `Ungültiger Statuswechsel: ${order.status} → ${newStatus}`,
        },
        { status: 400 }
      );
    }

    // Build update data with timestamp tracking
    const now = new Date();
    const updateData: Record<string, unknown> = { status: newStatus };

    if (newStatus === "PREPARING") updateData.prepStartedAt = now;
    if (newStatus === "READY") updateData.readyAt = now;
    if (newStatus === "COMPLETED") updateData.completedAt = now;

    const updated = await db.order.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ order: updated });
  } catch {
    return NextResponse.json(
      { error: "Ein Fehler ist aufgetreten." },
      { status: 500 }
    );
  }
}
