import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendEmail, buildOrderReadyEmail } from "@/lib/email";

type OrderStatus =
  | "PENDING"
  | "PREPARING"
  | "READY"
  | "COMPLETED"
  | "CANCELLED";

const ALL_STATUSES: OrderStatus[] = [
  "PENDING",
  "PREPARING",
  "READY",
  "COMPLETED",
  "CANCELLED",
];

const VALID_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ["PREPARING", "CANCELLED"],
  PREPARING: ["READY", "CANCELLED"],
  READY: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ token: string; id: string }> }
) {
  const { token, id } = await params;

  try {
    // Authenticate via display token
    const location = await db.location.findUnique({
      where: { displayToken: token },
      select: { id: true },
    });

    if (!location) {
      return NextResponse.json(
        { error: "Ungültiges Display-Token." },
        { status: 401 }
      );
    }

    const body = await request.json();
    const newStatus = body.status as OrderStatus;

    if (!newStatus || !ALL_STATUSES.includes(newStatus)) {
      return NextResponse.json(
        { error: "Ungültiger Status." },
        { status: 400 }
      );
    }

    // Fetch the order and verify it belongs to this location
    const order = await db.order.findUnique({
      where: { id },
    });

    if (!order) {
      return NextResponse.json(
        { error: "Bestellung nicht gefunden." },
        { status: 404 }
      );
    }

    if (order.locationId !== location.id) {
      return NextResponse.json(
        { error: "Bestellung gehört nicht zu diesem Standort." },
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

    // Atomic status transition — WHERE includes current status to prevent races
    const now = new Date();
    const updateData: Record<string, unknown> = { status: newStatus };

    if (newStatus === "PREPARING") updateData.prepStartedAt = now;
    if (newStatus === "READY") updateData.readyAt = now;
    if (newStatus === "COMPLETED") updateData.completedAt = now;

    const updated = await db.order.updateMany({
      where: { id, locationId: location.id, status: order.status as OrderStatus },
      data: updateData,
    });

    if (updated.count === 0) {
      return NextResponse.json(
        { error: "Status wurde bereits geändert. Bitte aktualisiere die Anzeige." },
        { status: 409 }
      );
    }

    const refreshed = await db.order.findUnique({
      where: { id },
      include: { location: { select: { name: true } } },
    });

    // Send order-ready notification email (fire-and-forget)
    if (newStatus === "READY" && refreshed?.customerEmail && !order.readyAt) {
      buildOrderReadyEmail(
        refreshed.orderNumber,
        refreshed.customerName,
        refreshed.location.name
      )
        .then(({ subject, body: emailBody }) =>
          sendEmail({ to: refreshed.customerEmail!, subject, body: emailBody })
        )
        .catch((err) => console.error("Failed to send order-ready email:", err));
    }

    return NextResponse.json({ order: refreshed });
  } catch {
    return NextResponse.json(
      { error: "Ein Fehler ist aufgetreten." },
      { status: 500 }
    );
  }
}
