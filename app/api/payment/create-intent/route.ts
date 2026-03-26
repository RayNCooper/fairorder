import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  createPaymentIntent,
  retrieveStripePaymentIntent,
  isStripeEnabled,
  isPayPalEnabled,
  type PaymentMethod,
} from "@/lib/payment";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { locationId, orderId, method } = body;

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

    // Determine payment method — explicit param or default to "stripe" for backward compat
    const validMethods: PaymentMethod[] = ["stripe", "paypal"];
    if (method && !validMethods.includes(method)) {
      return NextResponse.json(
        { error: "Ungültige Zahlungsart." },
        { status: 400 }
      );
    }
    const paymentMethod: PaymentMethod = method === "paypal" ? "paypal" : "stripe";

    // Verify location exists and has the requested payment method enabled
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

    if (!location.paymentEnabled) {
      return NextResponse.json(
        { error: "Online-Zahlung ist für diesen Standort nicht aktiviert." },
        { status: 403 }
      );
    }

    // Check that the requested method is accepted by this location
    if (paymentMethod === "stripe" && !location.acceptedPayments.includes("stripe")) {
      return NextResponse.json(
        { error: "Kartenzahlung ist für diesen Standort nicht aktiviert." },
        { status: 403 }
      );
    }

    if (paymentMethod === "paypal" && !location.acceptedPayments.includes("paypal")) {
      return NextResponse.json(
        { error: "PayPal ist für diesen Standort nicht aktiviert." },
        { status: 403 }
      );
    }

    // Check that the provider is actually configured
    if (paymentMethod === "stripe" && !isStripeEnabled()) {
      return NextResponse.json(
        { error: "Stripe ist nicht konfiguriert." },
        { status: 403 }
      );
    }

    if (paymentMethod === "paypal" && !isPayPalEnabled()) {
      return NextResponse.json(
        { error: "PayPal ist nicht konfiguriert." },
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

    // Idempotency: if a payment intent already exists, try to retrieve it
    if (order.paymentIntentId && order.paymentStatus === "pending") {
      if (order.paymentMethod === "stripe") {
        const existing = await retrieveStripePaymentIntent(order.paymentIntentId);
        if (existing) {
          return NextResponse.json(existing);
        }
      } else if (order.paymentMethod === "paypal") {
        // For PayPal, the order ID is still valid — return it
        return NextResponse.json({
          paypalOrderId: order.paymentIntentId,
          transactionId: order.paymentIntentId,
        });
      }
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

    const result = await createPaymentIntent(
      {
        amount,
        currency: "eur",
        orderId,
        customerName: order.customerName || "Gast",
      },
      paymentMethod
    );

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
        paymentMethod,
        paymentStatus: "pending",
      },
    });

    if (paymentMethod === "paypal" && result.paypalOrderId) {
      return NextResponse.json({
        paypalOrderId: result.paypalOrderId,
        transactionId: result.transactionId,
      });
    }

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
