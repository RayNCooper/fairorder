"use client";

import { useState, useEffect } from "react";
import useSWR from "swr";
import Link from "next/link";

type OrderStatus = "PENDING" | "PREPARING" | "READY" | "COMPLETED" | "CANCELLED";

const STATUS_CONFIG: Record<
  OrderStatus,
  { label: string; message: string; borderColor: string; bgColor: string }
> = {
  PENDING: {
    label: "BESTELLT",
    message: "Deine Bestellung wurde aufgenommen",
    borderColor: "border-amber-500",
    bgColor: "bg-amber-50",
  },
  PREPARING: {
    label: "WIRD ZUBEREITET",
    message: "Deine Bestellung wird gerade zubereitet",
    borderColor: "border-blue-500",
    bgColor: "bg-blue-50",
  },
  READY: {
    label: "ABHOLBEREIT",
    message: "Deine Bestellung ist fertig!",
    borderColor: "border-green-600",
    bgColor: "bg-green-50",
  },
  COMPLETED: {
    label: "ABGEHOLT",
    message: "Guten Appetit!",
    borderColor: "border-stone-400",
    bgColor: "bg-stone-50",
  },
  CANCELLED: {
    label: "STORNIERT",
    message: "Diese Bestellung wurde storniert",
    borderColor: "border-red-500",
    bgColor: "bg-red-50",
  },
};

const TERMINAL_STATES: OrderStatus[] = ["COMPLETED", "CANCELLED"];

const fetcher = (url: string) =>
  fetch(url).then((res) => {
    if (!res.ok) throw new Error(res.statusText);
    return res.json();
  });

interface OrderStatusTrackerProps {
  token: string;
  initialStatus: string;
  orderNumber: number;
  locationSlug: string;
  locationName: string;
  pickupTime: string;
}

export function OrderStatusTracker({
  token,
  initialStatus,
  orderNumber,
  locationSlug,
  locationName,
  pickupTime,
}: OrderStatusTrackerProps) {
  const [showSuccess, setShowSuccess] = useState(true);
  const [liveStatus, setLiveStatus] = useState<OrderStatus>(
    (initialStatus as OrderStatus) || "PENDING"
  );
  const isTerminal = TERMINAL_STATES.includes(liveStatus);

  const { data, error } = useSWR(
    isTerminal ? null : `/api/orders/by-token/${token}`,
    fetcher,
    {
      refreshInterval: 10000,
      refreshWhenHidden: false,
      refreshWhenOffline: false,
      fallbackData: { status: initialStatus },
      onSuccess: (d) => {
        if (d?.status) setLiveStatus(d.status as OrderStatus);
      },
    }
  );

  const currentStatus: OrderStatus = (data?.status as OrderStatus) || liveStatus;
  const config = STATUS_CONFIG[currentStatus];

  // Brief success animation on first load
  useEffect(() => {
    const timer = setTimeout(() => setShowSuccess(false), 2000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="space-y-4">
      {/* Success animation on first load */}
      {showSuccess && (
        <div className="flex items-center justify-center py-4 text-green-600 animate-in fade-in duration-300">
          <div className="inline-flex h-12 w-12 items-center justify-center bg-green-100">
            <span className="text-xl">&#10003;</span>
          </div>
        </div>
      )}

      {/* Status badge */}
      <div className={`border-l-3 ${config.borderColor} ${config.bgColor} p-4`}>
        <div className="flex items-center justify-between">
          <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-stone-700">
            {config.label}
          </span>
          {currentStatus === "READY" && (
            <span className="font-mono text-2xl font-bold tabular-nums text-stone-900">
              #{orderNumber}
            </span>
          )}
        </div>
        <p className="mt-1 text-sm text-stone-600">{config.message}</p>
        {!isTerminal && currentStatus !== "READY" && (
          <p className="mt-1 font-mono text-xs tabular-nums text-stone-500">
            Abholung: {pickupTime} Uhr
          </p>
        )}
      </div>

      {/* SWR error state */}
      {error && !isTerminal && (
        <div className="border-l-3 border-amber-500 bg-amber-50 p-3">
          <p className="text-xs text-amber-800">
            Verbindung unterbrochen — Status wird automatisch aktualisiert
          </p>
        </div>
      )}

      {/* Order number (non-READY states) */}
      {currentStatus !== "READY" && (
        <p className="font-mono text-lg font-bold tabular-nums text-stone-900">
          Bestellung #{orderNumber}
        </p>
      )}

      {/* COMPLETED: re-order button */}
      {currentStatus === "COMPLETED" && (
        <Link
          href={`/${locationSlug}`}
          className="inline-block bg-stone-900 px-6 py-3 text-sm font-bold uppercase tracking-wider text-white hover:bg-stone-800"
        >
          Nochmal bestellen
        </Link>
      )}

      {/* CANCELLED: contact + menu link */}
      {currentStatus === "CANCELLED" && (
        <div className="space-y-3">
          <p className="text-sm text-stone-600">
            Bitte wende dich an {locationName} für weitere Informationen.
          </p>
          <Link
            href={`/${locationSlug}`}
            className="inline-block bg-stone-900 px-6 py-3 text-sm font-bold uppercase tracking-wider text-white hover:bg-stone-800"
          >
            Zurück zur Speisekarte
          </Link>
        </div>
      )}
    </div>
  );
}
