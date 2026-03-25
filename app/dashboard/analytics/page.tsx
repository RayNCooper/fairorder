import { Metadata } from "next";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { AnalyticsClient } from "@/components/dashboard/analytics-client";
import { AnalyticsDashboard } from "@/components/dashboard/analytics/analytics-dashboard";

export const metadata: Metadata = {
  title: "Anzeige & Statistiken",
};

export default async function AnalyticsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const location = await db.location.findFirst({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });

  if (!location) redirect("/setup");

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

      {/* Analytics dashboard with charts */}
      <AnalyticsDashboard locationId={location.id} />

      {/* Kitchen display link */}
      <div className="border border-border bg-card p-6">
        <h3 className="text-sm font-semibold">Küchenanzeige</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Öffne die Küchenanzeige auf einem separaten Bildschirm, um
          eingehende Bestellungen in Echtzeit zu sehen.
        </p>

        <AnalyticsClient displayUrl={displayUrl} />
      </div>
    </div>
  );
}
