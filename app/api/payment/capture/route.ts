import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { capturePayPalPayment } from "@/lib/payment";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { orderId, paypalOrderId } = body;

    if (!orderId || typeof orderId !== "string") {
      return NextResponse.json(
        { error: "Bestell-ID ist erforderlich." },
        { status: 400 }
      );
    }

    if (!paypalOrderId || typeof paypalOrderId !== "string") {
      return NextResponse.json(
        { error: "PayPal-Bestell-ID ist erforderlich." },
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

    if (order.paymentMethod !== "paypal") {
      return NextResponse.json(
        { error: "Diese Bestellung verwendet kein PayPal." },
        { status: 403 }
      );
    }

    // Auth gate: verify the paypalOrderId matches what we stored
    if (order.paymentIntentId !== paypalOrderId) {
      return NextResponse.json(
        { error: "PayPal-Bestell-ID stimmt nicht überein." },
        { status: 403 }
      );
    }

    // Idempotency: already paid
    if (order.paymentStatus === "paid") {
      return NextResponse.json({ status: "paid" });
    }

    const result = await capturePayPalPayment(paypalOrderId);

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

    // PENDING — compliance/risk hold, cron sweep will follow up
    return NextResponse.json({ status: "pending" });
  } catch (error) {
    console.error("Failed to capture PayPal payment:", error);
    return NextResponse.json(
      { error: "Fehler bei der PayPal-Zahlung." },
      { status: 500 }
    );
  }
}
