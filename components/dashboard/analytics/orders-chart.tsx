"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

interface OrdersChartProps {
  data: { date: string; count: number }[];
}

export function OrdersChart({ data }: OrdersChartProps) {
  if (data.length === 0) return null;

  const formatted = data.map((d) => ({
    ...d,
    label: new Date(d.date).toLocaleDateString("de-DE", {
      day: "2-digit",
      month: "2-digit",
    }),
  }));

  return (
    <div className="border border-border bg-card p-6">
      <h3 className="text-sm font-semibold">Bestellungen pro Tag</h3>
      <div className="mt-4 h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={formatted}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fontFamily: "JetBrains Mono" }}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fontSize: 11, fontFamily: "JetBrains Mono" }}
              allowDecimals={false}
            />
            <Tooltip
              contentStyle={{
                fontFamily: "JetBrains Mono",
                fontSize: 12,
                borderRadius: 0,
              }}
              formatter={(value) => [String(value), "Bestellungen"]}
            />
            <Line
              type="monotone"
              dataKey="count"
              stroke="#16A34A"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: "#16A34A" }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
