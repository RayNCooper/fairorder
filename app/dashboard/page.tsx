import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { Metadata } from "next";
import { VerifiedBanner } from "@/components/auth/verified-banner";

export const metadata: Metadata = {
  title: "Dashboard",
};

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ verified?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { verified } = await searchParams;

  const locations = await db.location.findMany({
    where: { userId: session.user.id },
    include: {
      _count: {
        select: { orders: true, menuItems: true },
      },
    },
  });

  if (locations.length === 0) {
    redirect("/setup");
  }

  const location = locations[0];

  // Query today's orders
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const ordersToday = await db.order.count({
    where: {
      locationId: location.id,
      createdAt: { gte: todayStart },
    },
  });

  return (
    <div className="space-y-8">
      {verified === "true" && <VerifiedBanner />}
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">
          Übersicht
        </h1>
        <p className="text-sm text-muted-foreground">
          {location.name}
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid gap-4 lg:grid-cols-3">
        <StatCard
          label="Bestellungen heute"
          value={ordersToday}
        />
        <StatCard
          label="Menü-Einträge"
          value={location._count.menuItems}
        />
        <StatCard
          label="Bestellungen gesamt"
          value={location._count.orders}
        />
      </div>

      {/* Empty state if no orders */}
      {location._count.orders === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-muted-foreground">
            Noch keine Bestellungen. Sobald Kunden bestellen, erscheinen sie hier.
          </p>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="border border-border bg-card p-6">
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <p className="mt-2 font-mono text-3xl font-semibold">{value}</p>
    </div>
  );
}
