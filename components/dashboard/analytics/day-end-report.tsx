"use client";

import { useState } from "react";

interface DayReportData {
  date: string;
  locationName: string;
  summary: {
    totalOrders: number;
    totalRevenue: number;
    avgOrderValue: number;
    cashRevenue: number;
    stripeRevenue: number;
  };
  items: { name: string; count: number; revenue: number }[];
}

interface DayEndReportProps {
  locationId: string;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(amount);
}

export function DayEndReport({ locationId }: DayEndReportProps) {
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [report, setReport] = useState<DayReportData | null>(null);
  const [loading, setLoading] = useState(false);

  async function loadReport(targetDate: string) {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/analytics/day-report?locationId=${locationId}&date=${targetDate}`
      );
      if (res.ok) {
        setReport(await res.json());
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }

  function exportCsv() {
    if (!report) return;
    const rows = [
      ["Artikel", "Anzahl", "Umsatz"],
      ...report.items.map((i) => [i.name, String(i.count), i.revenue.toFixed(2)]),
      [],
      ["Gesamt", String(report.summary.totalOrders), report.summary.totalRevenue.toFixed(2)],
    ];
    const csv = rows.map((r) => r.join(";")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tagesabschluss-${report.date}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="border border-border bg-card p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h3 className="text-sm font-semibold">Tagesabschluss</h3>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="border border-border bg-background px-2 py-1 font-mono text-xs"
          />
          <button
            onClick={() => loadReport(date)}
            disabled={loading}
            className="bg-primary px-3 py-1 text-xs font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {loading ? "Lädt..." : "Laden"}
          </button>
        </div>
      </div>

      {report && (
        <div className="mt-6 space-y-6 print:mt-2">
          {/* Header for print */}
          <div className="hidden print:block">
            <h1 className="text-xl font-extrabold">{report.locationName}</h1>
            <p className="font-mono text-sm text-muted-foreground">
              Tagesabschluss — {new Date(report.date).toLocaleDateString("de-DE", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
            </p>
          </div>

          {/* Summary cards */}
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="border border-border p-4">
              <p className="text-xs text-muted-foreground">Bestellungen</p>
              <p className="mt-1 font-mono text-2xl font-semibold">{report.summary.totalOrders}</p>
            </div>
            <div className="border border-border p-4">
              <p className="text-xs text-muted-foreground">Gesamtumsatz</p>
              <p className="mt-1 font-mono text-2xl font-semibold">{formatCurrency(report.summary.totalRevenue)}</p>
            </div>
            <div className="border border-border p-4">
              <p className="text-xs text-muted-foreground">∅ Bestellwert</p>
              <p className="mt-1 font-mono text-2xl font-semibold">{formatCurrency(report.summary.avgOrderValue)}</p>
            </div>
          </div>

          {/* Payment breakdown */}
          <div className="border border-border p-4">
            <h4 className="text-xs font-semibold text-muted-foreground">Zahlungsarten</h4>
            <div className="mt-2 flex gap-6">
              <div>
                <p className="text-xs text-muted-foreground">Bar</p>
                <p className="font-mono text-sm font-semibold">{formatCurrency(report.summary.cashRevenue)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Karte</p>
                <p className="font-mono text-sm font-semibold">{formatCurrency(report.summary.stripeRevenue)}</p>
              </div>
            </div>
          </div>

          {/* Items table */}
          {report.items.length > 0 && (
            <div className="border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="px-4 py-2 text-left font-semibold">Artikel</th>
                    <th className="px-4 py-2 text-right font-mono font-semibold">Anzahl</th>
                    <th className="px-4 py-2 text-right font-mono font-semibold">Umsatz</th>
                  </tr>
                </thead>
                <tbody>
                  {report.items.map((item) => (
                    <tr key={item.name} className="border-b border-border last:border-0">
                      <td className="px-4 py-2">{item.name}</td>
                      <td className="px-4 py-2 text-right font-mono">{item.count}x</td>
                      <td className="px-4 py-2 text-right font-mono">{formatCurrency(item.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 print:hidden">
            <button
              onClick={() => window.print()}
              className="border border-border px-3 py-1.5 text-xs font-bold hover:bg-muted"
            >
              Drucken
            </button>
            <button
              onClick={exportCsv}
              className="border border-border px-3 py-1.5 text-xs font-bold hover:bg-muted"
            >
              CSV Export
            </button>
          </div>
        </div>
      )}

      {!report && !loading && (
        <p className="mt-4 text-sm text-muted-foreground">
          Wähle ein Datum und klicke &bdquo;Laden&ldquo; um den Tagesabschluss zu sehen.
        </p>
      )}
    </div>
  );
}
