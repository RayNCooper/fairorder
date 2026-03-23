import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createPaymentIntent } from "@/lib/payment";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { locationId, orderId } = body;

    if (!locationId || typeof locationId !== "string") {
      return NextResponse.json(
        { error: "Standort-ID ist erforderlich." },
        { status: 400 }
      );
    }

    if (!orderId || typeof orderId !== "string") {
      return NextResponse.json(
        { error: "Bestell-ID ist erforderlich." },
        { status: 400 }
      );
    }

    // Verify location exists and has stripe enabled
    const location = await db.location.findUnique({
      where: { id: locationId },
      select: { acceptedPayments: true, paymentEnabled: true },
    });

    if (!location) {
      return NextResponse.json(
        { error: "Standort nicht gefunden." },
        { status: 404 }
      );
    }

    if (!location.paymentEnabled || !location.acceptedPayments.includes("stripe")) {
      return NextResponse.json(
        { error: "Online-Zahlung ist für diesen Standort nicht aktiviert." },
        { status: 403 }
      );
    }

    // Load order and verify it belongs to this location
    const order = await db.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });

    if (!order || order.locationId !== locationId) {
      return NextResponse.json(
        { error: "Bestellung nicht gefunden." },
        { status: 404 }
      );
    }

    if (order.paymentStatus === "paid") {
      return NextResponse.json(
        { error: "Bestellung wurde bereits bezahlt." },
        { status: 400 }
      );
    }

    // Compute amount server-side from order items (in cents)
    const amount = order.items.reduce(
      (sum, item) =>
        sum + Math.round(Number(item.unitPrice) * 100) * item.quantity,
      0
    );

    if (amount <= 0) {
      return NextResponse.json(
        { error: "Ungültiger Bestellbetrag." },
        { status: 400 }
      );
    }

    const result = await createPaymentIntent({
      amount,
      currency: "eur",
      orderId,
      customerName: order.customerName || "Gast",
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Zahlungsdienst nicht erreichbar." },
        { status: 502 }
      );
    }

    // Update order with payment intent ID
    await db.order.update({
      where: { id: orderId },
      data: {
        paymentIntentId: result.transactionId,
        paymentMethod: "stripe",
        paymentStatus: "pending",
      },
    });

    return NextResponse.json({
      clientSecret: result.clientSecret,
      transactionId: result.transactionId,
    });
  } catch (error) {
    console.error("Failed to create payment intent:", error);
    return NextResponse.json(
      { error: "Fehler beim Erstellen der Zahlung." },
      { status: 500 }
    );
  }
}
