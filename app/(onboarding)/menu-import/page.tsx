import { Metadata } from "next";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { MenuImportClient } from "@/components/onboarding/menu-import-client";

export const metadata: Metadata = {
  title: "Speisekarte importieren",
};

export default async function MenuImportPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <div className="space-y-8">
      {/* Step indicator */}
      <div className="flex items-center justify-center gap-3">
        {[1, 2, 3].map((step) => (
          <div key={step} className="flex items-center gap-3">
            <div
              className={`flex h-8 w-8 items-center justify-center text-sm font-semibold ${
                step <= 2
                  ? "bg-primary text-primary-foreground"
                  : "border border-border text-muted-foreground"
              }`}
              aria-current={step === 2 ? "step" : undefined}
            >
              {step}
            </div>
            {step < 3 && (
              <div
                className={`h-[2px] w-8 ${step < 2 ? "bg-primary" : "bg-border"}`}
              />
            )}
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <p className="font-mono text-[11px] uppercase tracking-[0.04em] text-muted-foreground">
          Schritt 2 von 3
        </p>
        <h2 className="text-xl font-extrabold">Speisekarte importieren</h2>
        <p className="text-sm text-muted-foreground">
          Fotografiere deinen Speiseplan oder gib die Gerichte manuell ein.
        </p>
      </div>

      <Suspense
        fallback={
          <div className="flex min-h-[200px] items-center justify-center">
            <p className="text-sm text-muted-foreground">Laden...</p>
          </div>
        }
      >
        <MenuImportClient />
      </Suspense>
    </div>
  );
}
