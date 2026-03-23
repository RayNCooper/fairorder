import { Metadata } from "next";
import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import { KitchenDisplay } from "@/components/display/kitchen-display";

export const metadata: Metadata = {
  title: "Küchenanzeige",
};

// Disable static caching — always fetch fresh orders
export const dynamic = "force-dynamic";

interface DisplayPageProps {
  params: Promise<{ token: string }>;
}

export default async function DisplayPage({ params }: DisplayPageProps) {
  const { token } = await params;

  const location = await db.location.findUnique({
    where: { displayToken: token },
  });

  if (!location) notFound();

  const orders = await db.order.findMany({
    where: {
      locationId: location.id,
      status: { in: ["PENDING", "PREPARING", "READY"] },
    },
    orderBy: { createdAt: "asc" },
    include: {
      items: {
        include: {
          menuItem: { select: { name: true } },
        },
      },
    },
  });

  const serializedOrders = orders.map((order) => ({
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status as "PENDING" | "PREPARING" | "READY",
    customerName: order.customerName,
    customerNote: order.customerNote,
    createdAt: order.createdAt.toISOString(),
    items: order.items.map((item) => ({
      id: item.id,
      quantity: item.quantity,
      menuItemName: item.menuItem.name,
    })),
  }));

  return (
    <KitchenDisplay
      locationName={location.name}
      orders={serializedOrders}
    />
  );
}
