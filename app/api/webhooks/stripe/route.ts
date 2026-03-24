import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(request: NextRequest) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("STRIPE_WEBHOOK_SECRET is not set");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
  }

  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event;
  try {
    const { default: Stripe } = await import("stripe");
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "payment_intent.succeeded": {
        const paymentIntent = event.data.object;
        await db.order.updateMany({
          where: {
            paymentIntentId: paymentIntent.id,
            paymentStatus: { not: "paid" },
          },
          data: {
            paymentStatus: "paid",
            paidAt: new Date(),
          },
        });
        break;
      }

      case "payment_intent.payment_failed": {
        const paymentIntent = event.data.object;
        await db.order.updateMany({
          where: {
            paymentIntentId: paymentIntent.id,
            paymentStatus: { not: "paid" }, // Don't overwrite paid status
          },
          data: {
            paymentStatus: "failed",
          },
        });
        break;
      }

      default:
        // Acknowledge all other events
        break;
    }
  } catch (error) {
    console.error(`Error processing webhook event ${event.type}:`, error);
    // Still return 200 to avoid Stripe retries for processing errors
  }

  return NextResponse.json({ received: true });
}
