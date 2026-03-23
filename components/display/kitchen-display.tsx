"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

type OrderStatus = "PENDING" | "PREPARING" | "READY";

interface OrderItem {
  id: string;
  quantity: number;
  menuItemName: string;
}

interface Order {
  id: string;
  orderNumber: number;
  status: OrderStatus;
  customerName: string;
  customerNote: string | null;
  createdAt: string;
  items: OrderItem[];
}

interface KitchenDisplayProps {
  locationName: string;
  orders: Order[];
}

const COLUMNS: { status: OrderStatus; label: string; headerClass: string; cardBorder: string }[] = [
  {
    status: "PENDING",
    label: "Ausstehend",
    headerClass: "bg-amber-500 text-white",
    cardBorder: "border-l-amber-500",
  },
  {
    status: "PREPARING",
    label: "In Zubereitung",
    headerClass: "bg-blue-500 text-white",
    cardBorder: "border-l-blue-500",
  },
  {
    status: "READY",
    label: "Bereit",
    headerClass: "bg-green-500 text-white",
    cardBorder: "border-l-green-500",
  },
];

function timeAgo(dateString: string): string {
  const diff = Date.now() - new Date(dateString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "gerade eben";
  if (mins === 1) return "vor 1 Min.";
  return `vor ${mins} Min.`;
}

export function KitchenDisplay({ locationName, orders }: KitchenDisplayProps) {
  const router = useRouter();

  // Auto-refresh every 10 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      router.refresh();
    }, 10_000);
    return () => clearInterval(interval);
  }, [router]);

  const hasOrders = orders.length > 0;

  return (
    <div className="flex min-h-dvh flex-col bg-stone-950 text-stone-100">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-stone-800 px-6 py-4">
        <div>
          <h1 className="text-lg font-extrabold tracking-tight">
            {locationName}
          </h1>
          <p className="font-mono text-[11px] uppercase tracking-wider text-stone-500">
            Küchenanzeige
          </p>
        </div>
        <div className="font-mono text-sm tabular-nums text-stone-500">
          {orders.length} {orders.length === 1 ? "Bestellung" : "Bestellungen"}
        </div>
      </header>

      {/* Content */}
      {!hasOrders ? (
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <p className="text-xl font-semibold text-stone-500">
              Keine aktiven Bestellungen
            </p>
            <p className="mt-2 font-mono text-xs text-stone-600">
              Neue Bestellungen erscheinen hier automatisch
            </p>
          </div>
        </div>
      ) : (
        <div className="flex-1 grid grid-cols-1 gap-0 md:grid-cols-3">
          {COLUMNS.map((col) => {
            const columnOrders = orders.filter((o) => o.status === col.status);
            return (
              <div key={col.status} className="flex flex-col border-r border-stone-800 last:border-r-0">
                {/* Column header */}
                <div className={cn("px-4 py-3 text-center", col.headerClass)}>
                  <span className="font-mono text-sm font-bold uppercase tracking-wider">
                    {col.label}
                  </span>
                  <span className="ml-2 font-mono text-sm opacity-80">
                    ({columnOrders.length})
                  </span>
                </div>

                {/* Order cards */}
                <div className="flex-1 space-y-3 overflow-y-auto p-4">
                  {columnOrders.length === 0 ? (
                    <p className="py-8 text-center font-mono text-xs text-stone-600">
                      Keine
                    </p>
                  ) : (
                    columnOrders.map((order) => (
                      <div
                        key={order.id}
                        className={cn(
                          "border border-stone-800 border-l-[3px] bg-stone-900 p-4",
                          col.cardBorder
                        )}
                      >
                        {/* Order header */}
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-2xl font-bold tabular-nums">
                            #{order.orderNumber}
                          </span>
                          <span className="font-mono text-[11px] text-stone-500">
                            {timeAgo(order.createdAt)}
                          </span>
                        </div>

                        <p className="mt-1 text-sm font-semibold text-stone-300">
                          {order.customerName}
                        </p>

                        {/* Items */}
                        <ul className="mt-3 space-y-1">
                          {order.items.map((item) => (
                            <li key={item.id} className="flex items-baseline gap-2 text-sm">
                              <span className="font-mono text-xs font-bold tabular-nums text-stone-400">
                                {item.quantity}x
                              </span>
                              <span className="text-stone-200">
                                {item.menuItemName}
                              </span>
                            </li>
                          ))}
                        </ul>

                        {/* Customer note */}
                        {order.customerNote && (
                          <p className="mt-3 border-t border-stone-800 pt-2 text-xs italic text-stone-500">
                            {order.customerNote}
                          </p>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
