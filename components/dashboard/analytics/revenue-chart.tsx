"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

interface RevenueChartProps {
  data: { date: string; revenue: number }[];
}

export function RevenueChart({ data }: RevenueChartProps) {
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
      <h3 className="text-sm font-semibold">Umsatz pro Tag</h3>
      <div className="mt-4 h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={formatted}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fontFamily: "JetBrains Mono" }}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fontSize: 11, fontFamily: "JetBrains Mono" }}
              tickFormatter={(v) => `${v}€`}
            />
            <Tooltip
              contentStyle={{
                fontFamily: "JetBrains Mono",
                fontSize: 12,
                borderRadius: 0,
              }}
              formatter={(value) => [
                `${Number(value).toFixed(2).replace(".", ",")} €`,
                "Umsatz",
              ]}
            />
            <Bar dataKey="revenue" fill="#16A34A" radius={0} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
