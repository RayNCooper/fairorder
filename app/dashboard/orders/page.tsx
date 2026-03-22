import { Metadata } from "next";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { OrderList } from "@/components/dashboard/order-list";

export const metadata: Metadata = {
  title: "Bestellungen",
};

export default async function OrdersPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const location = await db.location.findFirst({
    where: { userId: session.user.id },
  });

  if (!location) redirect("/setup");

  const orders = await db.order.findMany({
    where: { locationId: location.id },
    orderBy: { createdAt: "desc" },
    include: {
      items: {
        include: {
          menuItem: {
            select: { name: true },
          },
        },
      },
    },
  });

  // Serialize orders for the client component
  type OrderWithItems = typeof orders[number];
  type OrderItem = OrderWithItems["items"][number];

  const serializedOrders = orders.map((order: OrderWithItems) => {
    const total = order.items.reduce(
      (sum: number, item: OrderItem) =>
        sum + Number(item.unitPrice) * item.quantity,
      0
    );

    return {
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      customerName: order.customerName,
      customerNote: order.customerNote,
      createdAt: order.createdAt.toISOString(),
      total: total.toFixed(2),
      items: order.items.map((item: OrderItem) => ({
        id: item.id,
        quantity: item.quantity,
        unitPrice: item.unitPrice.toString(),
        notes: item.notes,
        menuItem: { name: item.menuItem.name },
      })),
    };
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-extrabold tracking-tight">Bestellungen</h1>
      <OrderList orders={serializedOrders} />
    </div>
  );
}
