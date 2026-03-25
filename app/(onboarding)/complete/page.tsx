import { Metadata } from "next";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  IconCheck,
  IconPencil,
  IconArrowRight,
} from "@tabler/icons-react";
import { CompleteQR } from "@/components/onboarding/complete-client";

export const metadata: Metadata = {
  title: "Fertig!",
};

export default async function CompletePage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const location = await db.location.findFirst({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });

  if (!location) redirect("/setup");

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://app.fair-order.de";

  return (
    <div className="onboarding-wide space-y-8">
      {/* Step indicator — all complete */}
      <div className="flex items-center justify-center gap-3">
        {[1, 2, 3].map((step) => (
          <div key={step} className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center bg-primary text-sm font-semibold text-primary-foreground">
              <IconCheck className="h-4 w-4" strokeWidth={3} />
            </div>
            {step < 3 && <div className="h-[2px] w-8 bg-primary" />}
          </div>
        ))}
      </div>

      {/* Two-column layout on desktop, stacked on mobile */}
      <div className="grid gap-10 md:grid-cols-2 md:items-start">
        {/* Left: success message + actions */}
        <div className="flex flex-col items-center space-y-6 text-center md:items-start md:text-left">
          <div className="flex h-14 w-14 items-center justify-center bg-primary text-primary-foreground">
            <IconCheck className="h-7 w-7" strokeWidth={3} />
          </div>

          <div className="space-y-3">
            <h2 className="text-2xl font-extrabold">
              Deine Speisekarte ist live!
            </h2>
            <p className="text-muted-foreground">
              Kunden können jetzt online deine Speisekarte einsehen.
            </p>
          </div>

          <div className="flex w-full flex-col gap-3">
            <Link
              href="/dashboard"
              className="inline-flex h-11 items-center justify-center gap-2 bg-primary px-6 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 md:justify-start"
            >
              Zum Dashboard
              <IconArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/dashboard/menu"
              className="inline-flex h-11 items-center justify-center gap-2 border border-border bg-background px-6 text-sm font-medium transition-colors hover:bg-accent md:justify-start"
            >
              <IconPencil className="h-4 w-4" />
              Speisekarte bearbeiten
            </Link>
          </div>
        </div>

        {/* Right: QR code */}
        <div className="flex flex-col items-center space-y-4">
          <CompleteQR
            locationName={location.name}
            locationSlug={location.slug}
            siteUrl={siteUrl}
          />
        </div>
      </div>
    </div>
  );
}
