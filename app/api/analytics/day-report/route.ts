import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Nicht eingeloggt." }, { status: 401 });
  }

  const locationId = request.nextUrl.searchParams.get("locationId");
  const dateParam = request.nextUrl.searchParams.get("date");

  if (!locationId) {
    return NextResponse.json(
      { error: "locationId ist erforderlich." },
      { status: 400 }
    );
  }

  // Verify ownership
  const location = await db.location.findUnique({
    where: { id: locationId },
    select: { userId: true, name: true },
  });

  if (!location || location.userId !== session.user.id) {
    return NextResponse.json(
      { error: "Keine Berechtigung." },
      { status: 403 }
    );
  }

  // Parse date (default: today)
  const targetDate = dateParam ? new Date(dateParam) : new Date();
  const dayStart = new Date(targetDate);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(targetDate);
  dayEnd.setHours(23, 59, 59, 999);

  const orders = await db.order.findMany({
    where: {
      locationId,
      createdAt: { gte: dayStart, lte: dayEnd },
      status: { notIn: ["CANCELLED"] },
    },
    include: {
      items: {
        include: {
          menuItem: { select: { name: true } },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  // Compute summary
  let totalRevenue = 0;
  let cashRevenue = 0;
  let stripeRevenue = 0;
  const itemCounts = new Map<string, { name: string; count: number; revenue: number }>();

  for (const order of orders) {
    let orderTotal = 0;
    for (const item of order.items) {
      const itemRevenue = Number(item.unitPrice) * item.quantity;
      orderTotal += itemRevenue;

      const existing = itemCounts.get(item.menuItemId) ?? {
        name: item.menuItem.name,
        count: 0,
        revenue: 0,
      };
      existing.count += item.quantity;
      existing.revenue += itemRevenue;
      itemCounts.set(item.menuItemId, existing);
    }
    totalRevenue += orderTotal;

    if (order.paymentMethod === "stripe") {
      stripeRevenue += orderTotal;
    } else {
      cashRevenue += orderTotal;
    }
  }

  const totalOrders = orders.length;
  const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  // Sort items by count descending
  const items = [...itemCounts.values()].sort((a, b) => b.count - a.count);

  return NextResponse.json({
    date: dayStart.toISOString().split("T")[0],
    locationName: location.name,
    summary: {
      totalOrders,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      avgOrderValue: Math.round(avgOrderValue * 100) / 100,
      cashRevenue: Math.round(cashRevenue * 100) / 100,
      stripeRevenue: Math.round(stripeRevenue * 100) / 100,
    },
    items,
  });
}
