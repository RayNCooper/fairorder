"use client";

interface PeakHoursProps {
  data: { hour: number; label: string; avgOrders: number }[];
}

export function PeakHours({ data }: PeakHoursProps) {
  // Only show hours 6-22 (typical operating hours)
  const relevantHours = data.filter((d) => d.hour >= 6 && d.hour <= 22);
  const maxAvg = Math.max(...relevantHours.map((d) => d.avgOrders), 1);

  if (relevantHours.every((d) => d.avgOrders === 0)) {
    return (
      <div className="border border-border bg-card p-6">
        <h3 className="text-sm font-semibold">Stoßzeiten</h3>
        <p className="mt-4 text-sm text-muted-foreground">Noch keine Daten.</p>
      </div>
    );
  }

  return (
    <div className="border border-border bg-card p-6">
      <h3 className="text-sm font-semibold">Stoßzeiten</h3>
      <p className="mt-1 text-xs text-muted-foreground">
        Durchschnittliche Bestellungen pro Stunde
      </p>
      <div className="mt-4 flex items-end gap-1">
        {relevantHours.map((d) => {
          const height = maxAvg > 0 ? (d.avgOrders / maxAvg) * 120 : 0;
          const intensity = maxAvg > 0 ? d.avgOrders / maxAvg : 0;

          return (
            <div key={d.hour} className="flex flex-1 flex-col items-center gap-1">
              <span className="font-mono text-[10px] text-muted-foreground">
                {d.avgOrders > 0 ? d.avgOrders.toFixed(1) : ""}
              </span>
              <div
                className="w-full transition-all"
                style={{
                  height: `${Math.max(height, 2)}px`,
                  backgroundColor:
                    intensity > 0.7
                      ? "#16A34A"
                      : intensity > 0.3
                        ? "#86EFAC"
                        : "#E7E5E4",
                }}
              />
              <span className="font-mono text-[10px] text-muted-foreground">
                {d.hour}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
