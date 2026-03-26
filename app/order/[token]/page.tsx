import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { OrderStatusTracker } from "./order-status-tracker";

export const metadata: Metadata = {
  robots: "noindex, nofollow",
};

export default async function OrderPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const order = await db.order.findUnique({
    where: { token },
    include: {
      items: {
        include: {
          menuItem: {
            select: { name: true },
          },
        },
      },
      location: {
        select: { name: true, slug: true },
      },
    },
  });

  if (!order) {
    notFound();
  }

  const total = order.items.reduce(
    (sum, item) => sum + Number(item.unitPrice) * item.quantity,
    0
  );

  const pickupTime = new Date(order.requestedPickupTime).toLocaleTimeString(
    "de-DE",
    { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" }
  );

  return (
    <div className="min-h-dvh bg-[#FAFAF8]">
      <header className="border-b border-stone-200 bg-white px-4 py-6 text-center">
        <h1 className="text-2xl font-extrabold tracking-tight text-stone-900">
          {order.location.name}
        </h1>
      </header>

      <main className="mx-auto max-w-md px-4 py-8">
        <div className="space-y-6">
          {/* Live status badge */}
          <OrderStatusTracker
            token={token}
            initialStatus={order.status}
            orderNumber={order.orderNumber}
            locationSlug={order.location.slug}
            locationName={order.location.name}
            pickupTime={pickupTime}
          />

          {/* Order items */}
          <div>
            <h2 className="mb-3 text-sm font-extrabold uppercase tracking-wider text-stone-500">
              Deine Bestellung
            </h2>
            <div className="space-y-2">
              {order.items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-baseline justify-between"
                >
                  <span className="text-sm text-stone-900">
                    <span className="font-mono text-xs tabular-nums text-stone-500">
                      {item.quantity}x
                    </span>{" "}
                    {item.menuItem.name}
                  </span>
                  <span className="font-mono text-sm tabular-nums text-stone-700">
                    {(Number(item.unitPrice) * item.quantity)
                      .toFixed(2)
                      .replace(".", ",")}
                    &nbsp;&euro;
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-3 border-t border-stone-200 pt-3">
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-extrabold text-stone-900">
                  Gesamt
                </span>
                <span className="font-mono text-sm font-bold tabular-nums text-stone-900">
                  {total.toFixed(2).replace(".", ",")}&nbsp;&euro;
                </span>
              </div>
            </div>
          </div>

          {/* Order meta */}
          <div className="space-y-1 text-xs text-stone-500">
            {order.paymentMethod !== "cash" && order.paymentStatus === "paid" && (
              <p>
                Bezahlt via{" "}
                {order.paymentMethod === "stripe" ? "Karte" : order.paymentMethod}{" "}
                &#10003;
              </p>
            )}
            {order.paymentMethod === "cash" && (
              <p>Zahlung: Bar bei Abholung</p>
            )}
            <p>
              Bestellt:{" "}
              {new Date(order.createdAt).toLocaleTimeString("de-DE", {
                hour: "2-digit",
                minute: "2-digit",
                timeZone: "Europe/Berlin",
              })}{" "}
              Uhr
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
