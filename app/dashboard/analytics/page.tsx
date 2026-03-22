import { Metadata } from "next";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { AnalyticsClient } from "@/components/dashboard/analytics-client";

export const metadata: Metadata = {
  title: "Anzeige & Statistiken",
};

export default async function AnalyticsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const location = await db.location.findFirst({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { orders: true } },
    },
  });

  if (!location) redirect("/setup");

  // Compute stats
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [ordersToday, allOrders] = await Promise.all([
    db.order.count({
      where: {
        locationId: location.id,
        createdAt: { gte: todayStart },
      },
    }),
    db.order.findMany({
      where: { locationId: location.id },
      include: { items: true },
    }),
  ]);

  // Calculate revenue and avg order value
  let totalRevenue = 0;
  for (const order of allOrders) {
    for (const item of order.items) {
      totalRevenue += Number(item.unitPrice) * item.quantity;
    }
  }
  const totalOrders = allOrders.length;
  const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://app.fair-order.de";
  const displayUrl = `${baseUrl}/display/${location.displayToken}`;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">
          Anzeige & Statistiken
        </h1>
        <p className="text-sm text-muted-foreground">{location.name}</p>
      </div>

      {/* Stats grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Bestellungen gesamt" value={totalOrders} />
        <StatCard label="Bestellungen heute" value={ordersToday} />
        <StatCard
          label="∅ Bestellwert"
          value={formatCurrency(avgOrderValue)}
        />
        <StatCard
          label="Gesamtumsatz"
          value={formatCurrency(totalRevenue)}
        />
      </div>

      {/* Kitchen display */}
      <div className="border border-border bg-card p-6">
        <h3 className="text-sm font-semibold">Küchenanzeige</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Öffne die Küchenanzeige auf einem separaten Bildschirm, um
          eingehende Bestellungen in Echtzeit zu sehen.
        </p>

        <AnalyticsClient displayUrl={displayUrl} />
      </div>

      {/* Empty state */}
      {totalOrders === 0 && (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <p className="text-sm text-muted-foreground">
            Noch keine Bestellungen. Sobald Kunden bestellen, erscheinen hier
            deine Statistiken.
          </p>
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
}: {
  label: string;
  value: number | string;
}) {
  return (
    <div className="border border-border bg-card p-6">
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <p className="mt-2 font-mono text-3xl font-semibold">{value}</p>
    </div>
  );
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(amount);
}
