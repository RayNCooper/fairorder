import { Metadata } from "next";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { SetupForm } from "@/components/onboarding/setup-form";

export const metadata: Metadata = {
  title: "Standort einrichten",
};

export default async function SetupPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <div className="space-y-8">
      {/* Step indicator */}
      <StepIndicator currentStep={1} />

      <div className="space-y-2">
        <p className="font-mono text-[11px] uppercase tracking-[0.04em] text-muted-foreground">
          Schritt 1 von 3
        </p>
        <h2 className="text-xl font-extrabold">Standort einrichten</h2>
        <p className="text-sm text-muted-foreground">
          Wie heißt dein Betrieb? Du kannst die Angaben später ändern.
        </p>
      </div>

      <SetupForm />
    </div>
  );
}

function StepIndicator({ currentStep }: { currentStep: number }) {
  const steps = [1, 2, 3];
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-center gap-3">
        {steps.map((step) => (
          <div key={step} className="flex items-center gap-3">
            <div
              className={cn(
                "flex h-8 w-8 items-center justify-center text-sm font-semibold",
                step <= currentStep
                  ? "bg-primary text-primary-foreground"
                  : "border border-border text-muted-foreground"
              )}
              aria-current={step === currentStep ? "step" : undefined}
            >
              {step}
            </div>
            {step < 3 && (
              <div
                className={cn(
                  "h-[2px] w-8",
                  step < currentStep ? "bg-primary" : "bg-border"
                )}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}
