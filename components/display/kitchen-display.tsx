"use client";

import { useEffect, useState } from "react";
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
  requestedPickupTime: string | null;
  createdAt: string;
  items: OrderItem[];
}

interface KitchenDisplayProps {
  locationName: string;
  orders: Order[];
  displayToken: string;
}

const COLUMNS: { status: OrderStatus; label: string; headerClass: string; cardBorder: string; nextStatus: OrderStatus | null; nextLabel: string }[] = [
  {
    status: "PENDING",
    label: "Ausstehend",
    headerClass: "bg-amber-500 text-white",
    cardBorder: "border-l-amber-500",
    nextStatus: "PREPARING",
    nextLabel: "Zubereitung starten",
  },
  {
    status: "PREPARING",
    label: "In Zubereitung",
    headerClass: "bg-blue-500 text-white",
    cardBorder: "border-l-blue-500",
    nextStatus: "READY",
    nextLabel: "Bereit",
  },
  {
    status: "READY",
    label: "Bereit",
    headerClass: "bg-green-500 text-white",
    cardBorder: "border-l-green-500",
    nextStatus: null,
    nextLabel: "Abgeholt",
  },
];

function timeAgo(dateString: string): string {
  const diff = Date.now() - new Date(dateString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "gerade eben";
  if (mins === 1) return "vor 1 Min.";
  return `vor ${mins} Min.`;
}

export function KitchenDisplay({ locationName, orders, displayToken }: KitchenDisplayProps) {
  const router = useRouter();
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Auto-refresh every 10 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      router.refresh();
    }, 10_000);
    return () => clearInterval(interval);
  }, [router]);

  // Auto-dismiss error after 4 seconds
  useEffect(() => {
    if (!errorMsg) return;
    const t = setTimeout(() => setErrorMsg(null), 4000);
    return () => clearTimeout(t);
  }, [errorMsg]);

  async function updateStatus(orderId: string, newStatus: string) {
    setUpdatingId(orderId);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/display/${displayToken}/orders/${orderId}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        router.refresh();
      } else {
        const data = await res.json().catch(() => null);
        setErrorMsg(data?.error || "Status konnte nicht geändert werden.");
        router.refresh();
      }
    } catch {
      setErrorMsg("Verbindungsfehler. Bitte erneut versuchen.");
    } finally {
      setUpdatingId(null);
    }
  }

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

      {/* Error banner */}
      {errorMsg && (
        <div className="bg-red-600 px-4 py-2 text-center text-sm font-bold text-white">
          {errorMsg}
        </div>
      )}

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

                        {/* Pickup time */}
                        {order.requestedPickupTime && (
                          <p className="mt-3 border-t border-stone-800 pt-2 font-mono text-xs text-stone-400">
                            Abholung: {new Date(order.requestedPickupTime).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })} Uhr
                          </p>
                        )}

                        {/* Customer note */}
                        {order.customerNote && (
                          <p className="mt-2 text-xs italic text-stone-500">
                            {order.customerNote}
                          </p>
                        )}

                        {/* Status action buttons */}
                        <div className="mt-3 flex gap-2 border-t border-stone-800 pt-3">
                          {col.nextStatus && (
                            <button
                              className={cn(
                                "flex-1 py-2 text-sm font-bold uppercase tracking-wider transition-colors disabled:opacity-50",
                                col.status === "PENDING" && "bg-blue-600 text-white hover:bg-blue-500",
                                col.status === "PREPARING" && "bg-green-600 text-white hover:bg-green-500",
                              )}
                              disabled={updatingId === order.id}
                              onClick={() => updateStatus(order.id, col.nextStatus!)}
                            >
                              {updatingId === order.id ? "..." : col.nextLabel}
                            </button>
                          )}
                          {col.status === "READY" && (
                            <button
                              className="flex-1 bg-stone-700 py-2 text-sm font-bold uppercase tracking-wider text-stone-200 transition-colors hover:bg-stone-600 disabled:opacity-50"
                              disabled={updatingId === order.id}
                              onClick={() => updateStatus(order.id, "COMPLETED")}
                            >
                              {updatingId === order.id ? "..." : "Abgeholt"}
                            </button>
                          )}
                        </div>
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
