import { Metadata } from "next";
import { MagicLinkForm } from "@/components/auth/magic-link-form";
import { AuthFeedback } from "@/components/auth/auth-feedback";

export const metadata: Metadata = {
  title: "Anmelden",
};

export default function LoginPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <h2 className="text-xl font-extrabold">Anmelden</h2>
        <p className="text-sm text-muted-foreground">
          Gib deine E-Mail ein und wir senden dir einen Login-Link.
          <br />
          Noch kein Konto? Wird automatisch erstellt.
        </p>
      </div>

      <AuthFeedback />
      <MagicLinkForm />

      <p className="font-mono text-[11px] uppercase tracking-[0.04em] text-center text-muted-foreground">
        Kein Passwort nötig
      </p>
    </div>
  );
}
