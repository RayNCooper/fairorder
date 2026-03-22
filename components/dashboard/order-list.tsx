"use client";

import { useState, useTransition } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { IconLoader2 } from "@tabler/icons-react";
import { useRouter } from "next/navigation";

type OrderStatus = "PENDING" | "PREPARING" | "READY" | "COMPLETED" | "CANCELLED";

interface OrderItem {
  id: string;
  quantity: number;
  unitPrice: string;
  notes: string | null;
  menuItem: {
    name: string;
  };
}

interface Order {
  id: string;
  orderNumber: number;
  status: OrderStatus;
  customerName: string;
  customerNote: string | null;
  createdAt: string;
  items: OrderItem[];
  total: string;
}

const STATUS_CONFIG: Record<
  OrderStatus,
  { label: string; className: string }
> = {
  PENDING: {
    label: "Ausstehend",
    className: "bg-amber-100 text-amber-800 border-amber-200",
  },
  PREPARING: {
    label: "In Zubereitung",
    className: "bg-blue-100 text-blue-800 border-blue-200",
  },
  READY: {
    label: "Bereit",
    className: "bg-green-100 text-green-800 border-green-200",
  },
  COMPLETED: {
    label: "Abgeschlossen",
    className: "bg-muted text-muted-foreground border-border",
  },
  CANCELLED: {
    label: "Storniert",
    className: "bg-red-100 text-red-800 border-red-200",
  },
};

const NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  PENDING: "PREPARING",
  PREPARING: "READY",
  READY: "COMPLETED",
};

const NEXT_STATUS_LABEL: Partial<Record<OrderStatus, string>> = {
  PENDING: "Zubereitung starten",
  PREPARING: "Als bereit markieren",
  READY: "Abschliessen",
};

function StatusBadge({ status }: { status: OrderStatus }) {
  const config = STATUS_CONFIG[status];
  return (
    <Badge
      variant="outline"
      className={cn(
        "rounded-none border font-mono text-[11px] uppercase tracking-wider",
        config.className
      )}
    >
      {config.label}
    </Badge>
  );
}

function formatTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatPrice(price: string): string {
  return Number(price).toLocaleString("de-DE", {
    style: "currency",
    currency: "EUR",
  });
}

export function OrderList({ orders }: { orders: Order[] }) {
  const [tab, setTab] = useState("all");
  const router = useRouter();
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const filteredOrders =
    tab === "all"
      ? orders
      : orders.filter(
          (o) => o.status === tab.toUpperCase()
        );

  async function updateStatus(orderId: string, newStatus: OrderStatus) {
    setUpdatingId(orderId);
    try {
      const res = await fetch(`/api/orders/${orderId}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Fehler beim Aktualisieren.");
        return;
      }

      startTransition(() => {
        router.refresh();
      });
    } finally {
      setUpdatingId(null);
    }
  }

  async function cancelOrder(orderId: string) {
    if (!confirm("Bestellung wirklich stornieren?")) return;
    await updateStatus(orderId, "CANCELLED");
  }

  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-lg font-semibold">Keine Bestellungen</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Sobald Kunden bestellen, erscheinen ihre Bestellungen hier.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="rounded-none">
          <TabsTrigger value="all" className="rounded-none text-sm">
            Alle ({orders.length})
          </TabsTrigger>
          <TabsTrigger value="pending" className="rounded-none text-sm">
            Ausstehend (
            {orders.filter((o) => o.status === "PENDING").length})
          </TabsTrigger>
          <TabsTrigger value="preparing" className="rounded-none text-sm">
            Zubereitung (
            {orders.filter((o) => o.status === "PREPARING").length})
          </TabsTrigger>
          <TabsTrigger value="ready" className="rounded-none text-sm">
            Bereit ({orders.filter((o) => o.status === "READY").length})
          </TabsTrigger>
        </TabsList>

        {["all", "pending", "preparing", "ready"].map((tabValue) => (
          <TabsContent key={tabValue} value={tabValue}>
            {filteredOrders.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <p className="text-sm text-muted-foreground">
                  Keine Bestellungen in dieser Kategorie.
                </p>
              </div>
            ) : (
              <Accordion type="single" collapsible className="border border-border">
                {filteredOrders.map((order) => (
                  <AccordionItem
                    key={order.id}
                    value={order.id}
                    className="border-border px-4"
                  >
                    <AccordionTrigger className="hover:no-underline">
                      <div className="flex flex-1 items-center gap-3 pr-2">
                        <span className="font-mono text-sm font-semibold tabular-nums">
                          #{order.orderNumber}
                        </span>
                        <StatusBadge status={order.status} />
                        <span className="text-sm">{order.customerName}</span>
                        <span className="ml-auto font-mono text-sm tabular-nums">
                          {formatPrice(order.total)}
                        </span>
                        <span className="hidden font-mono text-xs text-muted-foreground sm:inline">
                          {formatTime(order.createdAt)}
                        </span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-3">
                        {/* Order items */}
                        <div className="space-y-1">
                          {order.items.map((item) => (
                            <div
                              key={item.id}
                              className="flex items-center justify-between text-sm"
                            >
                              <span>
                                <span className="font-mono text-xs tabular-nums">
                                  {item.quantity}x
                                </span>{" "}
                                {item.menuItem.name}
                              </span>
                              <span className="font-mono text-xs tabular-nums text-muted-foreground">
                                {formatPrice(
                                  (
                                    Number(item.unitPrice) * item.quantity
                                  ).toFixed(2)
                                )}
                              </span>
                            </div>
                          ))}
                          {order.customerNote && (
                            <p className="mt-2 text-xs text-muted-foreground italic">
                              Hinweis: {order.customerNote}
                            </p>
                          )}
                        </div>

                        {/* Timestamp */}
                        <p className="font-mono text-xs text-muted-foreground sm:hidden">
                          {formatTime(order.createdAt)}
                        </p>

                        {/* Actions */}
                        {order.status !== "COMPLETED" &&
                          order.status !== "CANCELLED" && (
                            <div className="flex gap-2 pt-2">
                              {NEXT_STATUS[order.status] && (
                                <Button
                                  size="sm"
                                  className="rounded-none"
                                  disabled={
                                    updatingId === order.id || isPending
                                  }
                                  onClick={() =>
                                    updateStatus(
                                      order.id,
                                      NEXT_STATUS[order.status]!
                                    )
                                  }
                                >
                                  {updatingId === order.id ? (
                                    <IconLoader2 className="size-4 animate-spin" />
                                  ) : null}
                                  {NEXT_STATUS_LABEL[order.status]}
                                </Button>
                              )}
                              <Button
                                variant="outline"
                                size="sm"
                                className="rounded-none text-destructive hover:bg-destructive/10 hover:text-destructive"
                                disabled={
                                  updatingId === order.id || isPending
                                }
                                onClick={() => cancelOrder(order.id)}
                              >
                                Stornieren
                              </Button>
                            </div>
                          )}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
