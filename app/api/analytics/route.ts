import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";

const RANGE_DAYS: Record<string, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
};

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Nicht eingeloggt." }, { status: 401 });
  }

  const locationId = request.nextUrl.searchParams.get("locationId");
  const range = request.nextUrl.searchParams.get("range") ?? "30d";

  if (!locationId) {
    return NextResponse.json(
      { error: "locationId ist erforderlich." },
      { status: 400 }
    );
  }

  // Verify ownership
  const location = await db.location.findUnique({
    where: { id: locationId },
    select: { userId: true },
  });

  if (!location || location.userId !== session.user.id) {
    return NextResponse.json(
      { error: "Keine Berechtigung." },
      { status: 403 }
    );
  }

  const days = Math.min(RANGE_DAYS[range] ?? 30, 365);
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  startDate.setHours(0, 0, 0, 0);

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  // Run all queries in parallel
  const [ordersInRange, ordersToday, totalOrders, topItemsRaw, revenueResult] =
    await Promise.all([
      // Orders with items for daily breakdown
      db.order.findMany({
        where: {
          locationId,
          createdAt: { gte: startDate },
          status: { notIn: ["CANCELLED"] },
        },
        select: {
          createdAt: true,
          items: {
            select: { unitPrice: true, quantity: true, vatRate: true },
          },
        },
        orderBy: { createdAt: "asc" },
      }),

      // Orders today
      db.order.count({
        where: {
          locationId,
          createdAt: { gte: todayStart },
          status: { notIn: ["CANCELLED"] },
        },
      }),

      // Total orders all time
      db.order.count({
        where: { locationId, status: { notIn: ["CANCELLED"] } },
      }),

      // Top items by quantity
      db.orderItem.groupBy({
        by: ["menuItemId"],
        where: {
          order: {
            locationId,
            createdAt: { gte: startDate },
            status: { notIn: ["CANCELLED"] },
          },
        },
        _sum: { quantity: true },
        orderBy: { _sum: { quantity: "desc" } },
        take: 10,
      }),

      // Total revenue all time
      db.$queryRaw<[{ total: number | null }]>`SELECT COALESCE(SUM(CAST("unitPrice" AS DOUBLE PRECISION) * "quantity"), 0) as total FROM "OrderItem" WHERE "orderId" IN (SELECT "id" FROM "Order" WHERE "locationId" = ${locationId} AND "status" != 'CANCELLED')`,
    ]);

  // Build daily breakdown
  const dailyMap = new Map<string, { count: number; revenue: number }>();
  for (const order of ordersInRange) {
    const dateKey = order.createdAt.toISOString().split("T")[0];
    const existing = dailyMap.get(dateKey) ?? { count: 0, revenue: 0 };
    existing.count += 1;
    for (const item of order.items) {
      existing.revenue += Number(item.unitPrice) * item.quantity;
    }
    dailyMap.set(dateKey, existing);
  }

  // Fill in missing dates with zeros
  const dailyOrders: { date: string; count: number; revenue: number }[] = [];
  const current = new Date(startDate);
  const today = new Date();
  while (current <= today) {
    const dateKey = current.toISOString().split("T")[0];
    const data = dailyMap.get(dateKey) ?? { count: 0, revenue: 0 };
    dailyOrders.push({
      date: dateKey,
      count: data.count,
      revenue: Math.round(data.revenue * 100) / 100,
    });
    current.setDate(current.getDate() + 1);
  }

  // Build hourly distribution
  const hourlyMap = new Map<number, number>();
  for (const order of ordersInRange) {
    const hour = order.createdAt.getHours();
    hourlyMap.set(hour, (hourlyMap.get(hour) ?? 0) + 1);
  }
  const hourlyDistribution = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    label: `${hour.toString().padStart(2, "0")}:00`,
    avgOrders: Math.round(((hourlyMap.get(hour) ?? 0) / days) * 10) / 10,
  }));

  // Resolve top item names
  const topItemIds = topItemsRaw.map((item) => item.menuItemId);
  const menuItems = await db.menuItem.findMany({
    where: { id: { in: topItemIds } },
    select: { id: true, name: true },
  });
  const menuItemNames = new Map(menuItems.map((mi) => [mi.id, mi.name]));

  const topItems = topItemsRaw.map((item) => ({
    name: menuItemNames.get(item.menuItemId) ?? "Unbekannt",
    count: item._sum.quantity ?? 0,
  }));

  const totalRevenue = Number(revenueResult[0]?.total ?? 0);
  const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  // Tax breakdown: revenue by tax rate (7% food, 19% beverages)
  const taxBreakdown = { rate7: 0, rate19: 0 };
  for (const order of ordersInRange) {
    for (const item of order.items) {
      const lineTotal = Number(item.unitPrice) * item.quantity;
      const rate = Number(item.vatRate);
      if (rate === 19) {
        taxBreakdown.rate19 += lineTotal;
      } else {
        taxBreakdown.rate7 += lineTotal;
      }
    }
  }

  return NextResponse.json({
    dailyOrders,
    topItems,
    hourlyDistribution,
    taxBreakdown: {
      rate7: Math.round(taxBreakdown.rate7 * 100) / 100,
      rate19: Math.round(taxBreakdown.rate19 * 100) / 100,
      tax7: Math.round((taxBreakdown.rate7 * 7) / 107 * 100) / 100,
      tax19: Math.round((taxBreakdown.rate19 * 19) / 119 * 100) / 100,
    },
    summary: {
      totalOrders,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      avgOrderValue: Math.round(avgOrderValue * 100) / 100,
      ordersToday,
    },
  });
}
