import { Metadata } from "next";
import { MagicLinkForm } from "@/components/auth/magic-link-form";
import { AuthFeedback } from "@/components/auth/auth-feedback";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Einloggen",
};

export default function LoginPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <h2 className="text-xl font-extrabold">Willkommen zurück</h2>
        <p className="text-sm text-muted-foreground">
          Gib deine E-Mail ein und wir senden dir einen Login-Link.
        </p>
      </div>

      <AuthFeedback />
      <MagicLinkForm />

      <p className="font-mono text-[11px] uppercase tracking-[0.04em] text-center text-muted-foreground">
        Kein Passwort nötig
      </p>

      <p className="text-center text-sm text-muted-foreground">
        Noch kein Konto?{" "}
        <Link href="/register" className="font-medium text-foreground underline underline-offset-4">
          Registrieren
        </Link>
      </p>
    </div>
  );
}
