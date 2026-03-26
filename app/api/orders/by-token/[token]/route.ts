import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  if (!token || typeof token !== "string" || token.length !== 12) {
    return NextResponse.json(
      { error: "Bestellung nicht gefunden." },
      { status: 404 }
    );
  }

  const order = await db.order.findUnique({
    where: { token },
    select: {
      id: true,
      orderNumber: true,
      customerName: true,
      status: true,
      requestedPickupTime: true,
      paymentMethod: true,
      paymentStatus: true,
      createdAt: true,
      readyAt: true,
      completedAt: true,
      items: {
        select: {
          id: true,
          quantity: true,
          unitPrice: true,
          menuItem: {
            select: {
              name: true,
            },
          },
        },
      },
      location: {
        select: {
          name: true,
          slug: true,
        },
      },
    },
  });

  if (!order) {
    return NextResponse.json(
      { error: "Bestellung nicht gefunden." },
      { status: 404 }
    );
  }

  return NextResponse.json(order);
}
