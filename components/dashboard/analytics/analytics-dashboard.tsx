"use client";

import { useState, useEffect, useCallback } from "react";
import { OrdersChart } from "./orders-chart";
import { RevenueChart } from "./revenue-chart";
import { PopularItems } from "./popular-items";
import { PeakHours } from "./peak-hours";
import { DayEndReport } from "./day-end-report";

interface AnalyticsDashboardProps {
  locationId: string;
}

interface AnalyticsData {
  dailyOrders: { date: string; count: number; revenue: number }[];
  topItems: { name: string; count: number }[];
  hourlyDistribution: { hour: number; label: string; avgOrders: number }[];
  summary: {
    totalOrders: number;
    totalRevenue: number;
    avgOrderValue: number;
    ordersToday: number;
  };
}

type Range = "7d" | "30d" | "90d";

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(amount);
}

export function AnalyticsDashboard({ locationId }: AnalyticsDashboardProps) {
  const [range, setRange] = useState<Range>("30d");
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async (r: Range) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/analytics?locationId=${locationId}&range=${r}`);
      if (res.ok) {
        setData(await res.json());
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    fetchData(range);
  }, [range, fetchData]);

  return (
    <div className="space-y-6">
      {/* Range selector */}
      <div className="flex gap-1">
        {(["7d", "30d", "90d"] as const).map((r) => (
          <button
            key={r}
            onClick={() => setRange(r)}
            className={
              range === r
                ? "border border-foreground bg-foreground px-3 py-1 font-mono text-xs font-bold text-background"
                : "border border-border px-3 py-1 font-mono text-xs text-muted-foreground hover:border-foreground"
            }
          >
            {r === "7d" ? "7 Tage" : r === "30d" ? "30 Tage" : "90 Tage"}
          </button>
        ))}
      </div>

      {loading && !data && (
        <p className="py-8 text-center font-mono text-xs text-muted-foreground">
          Lade Statistiken...
        </p>
      )}

      {data && (
        <>
          {/* Summary cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Bestellungen gesamt" value={data.summary.totalOrders} />
            <StatCard label="Bestellungen heute" value={data.summary.ordersToday} />
            <StatCard label="∅ Bestellwert" value={formatCurrency(data.summary.avgOrderValue)} />
            <StatCard label="Gesamtumsatz" value={formatCurrency(data.summary.totalRevenue)} />
          </div>

          {/* Charts */}
          <div className="grid gap-6 lg:grid-cols-2">
            <OrdersChart data={data.dailyOrders} />
            <RevenueChart data={data.dailyOrders} />
          </div>

          {/* Popular items + peak hours */}
          <div className="grid gap-6 lg:grid-cols-2">
            <PopularItems items={data.topItems} />
            <PeakHours data={data.hourlyDistribution} />
          </div>
        </>
      )}

      {data && data.summary.totalOrders === 0 && (
        <div className="py-8 text-center">
          <p className="text-sm text-muted-foreground">
            Noch keine Bestellungen im gewählten Zeitraum.
          </p>
        </div>
      )}

      {/* Day-end report */}
      <DayEndReport locationId={locationId} />
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="border border-border bg-card p-6">
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <p className="mt-2 font-mono text-3xl font-semibold">{value}</p>
    </div>
  );
}
