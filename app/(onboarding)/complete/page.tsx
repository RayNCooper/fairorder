import { Metadata } from "next";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import Link from "next/link";
import { IconCheck } from "@tabler/icons-react";
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
    <div className="space-y-8">
      {/* Step indicator — all complete */}
      <div className="flex items-center justify-center gap-3">
        {[1, 2, 3].map((step) => (
          <div key={step} className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center bg-primary text-sm font-semibold text-primary-foreground">
              {step}
            </div>
            {step < 3 && <div className="h-[2px] w-8 bg-primary" />}
          </div>
        ))}
      </div>

      <div className="flex flex-col items-center space-y-6 text-center">
        <div className="flex h-12 w-12 items-center justify-center bg-primary text-primary-foreground">
          <IconCheck className="h-6 w-6" strokeWidth={3} />
        </div>

        <div className="space-y-2">
          <h2 className="text-xl font-extrabold">
            Deine Speisekarte ist live!
          </h2>
          <p className="text-sm text-muted-foreground">
            Kunden können jetzt unter{" "}
            <span className="font-mono text-foreground">{location.slug}</span>{" "}
            deine Speisekarte sehen.
          </p>
        </div>

        <CompleteQR
          locationName={location.name}
          locationSlug={location.slug}
          siteUrl={siteUrl}
        />

        <div className="flex flex-col gap-3 sm:flex-row">
          <Link
            href="/dashboard"
            className="inline-flex h-11 items-center justify-center bg-primary px-6 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Zum Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
