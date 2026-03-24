import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyPayment } from "@/lib/payment";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { orderId } = body;

    if (!orderId || typeof orderId !== "string") {
      return NextResponse.json(
        { error: "Bestell-ID ist erforderlich." },
        { status: 400 }
      );
    }

    const order = await db.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        paymentIntentId: true,
        paymentStatus: true,
        paymentMethod: true,
      },
    });

    if (!order) {
      return NextResponse.json(
        { error: "Bestellung nicht gefunden." },
        { status: 404 }
      );
    }

    // Short-circuit if already paid
    if (order.paymentStatus === "paid") {
      return NextResponse.json({ status: "paid" });
    }

    if (!order.paymentIntentId) {
      return NextResponse.json(
        { error: "Keine Zahlung für diese Bestellung." },
        { status: 400 }
      );
    }

    const result = await verifyPayment(order.paymentIntentId);

    if (result === "paid") {
      await db.order.updateMany({
        where: {
          id: orderId,
          paymentStatus: { not: "paid" },
        },
        data: {
          paymentStatus: "paid",
          paidAt: new Date(),
        },
      });
      return NextResponse.json({ status: "paid" });
    }

    if (result === "failed") {
      await db.order.updateMany({
        where: {
          id: orderId,
          paymentStatus: { not: "paid" },
        },
        data: {
          paymentStatus: "failed",
        },
      });
      return NextResponse.json({ status: "failed" });
    }

    return NextResponse.json({ status: "pending" });
  } catch (error) {
    console.error("Failed to verify payment:", error);
    return NextResponse.json(
      { error: "Fehler bei der Zahlungsüberprüfung." },
      { status: 500 }
    );
  }
}
