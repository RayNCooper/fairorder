import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyPayment } from "@/lib/payment";
import crypto from "crypto";

function isAuthorized(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;

  const authHeader = request.headers.get("authorization");
  if (!authHeader) return false;

  const token = authHeader.replace(/^Bearer\s+/i, "");

  // Constant-time comparison to prevent timing attacks
  try {
    const expected = Buffer.from(cronSecret, "utf-8");
    const actual = Buffer.from(token, "utf-8");
    if (expected.length !== actual.length) return false;
    return crypto.timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { error: "Nicht autorisiert." },
      { status: 401 }
    );
  }

  try {
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);

    const pendingOrders = await db.order.findMany({
      where: {
        paymentStatus: "pending",
        paymentIntentId: { not: null },
        createdAt: { lt: twoMinutesAgo },
      },
      select: {
        id: true,
        paymentIntentId: true,
      },
    });

    let confirmed = 0;
    let failed = 0;

    for (const order of pendingOrders) {
      if (!order.paymentIntentId) continue;

      try {
        const result = await verifyPayment(order.paymentIntentId);

        if (result === "paid") {
          await db.order.updateMany({
            where: {
              id: order.id,
              paymentStatus: { not: "paid" },
            },
            data: {
              paymentStatus: "paid",
              paidAt: new Date(),
            },
          });
          confirmed++;
        } else if (result === "failed") {
          await db.order.updateMany({
            where: {
              id: order.id,
              paymentStatus: { not: "paid" },
            },
            data: {
              paymentStatus: "failed",
            },
          });
          failed++;
        }
        // "pending" — skip, will be retried next sweep
      } catch (error) {
        console.error(
          `Failed to verify payment for order ${order.id}:`,
          error
        );
        // Continue processing other orders
      }
    }

    return NextResponse.json({
      checked: pendingOrders.length,
      confirmed,
      failed,
    });
  } catch (error) {
    console.error("Payment sweep failed:", error);
    return NextResponse.json(
      { error: "Zahlungsüberprüfung fehlgeschlagen." },
      { status: 500 }
    );
  }
}
