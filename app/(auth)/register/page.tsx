import { Metadata } from "next";
import { MagicLinkForm } from "@/components/auth/magic-link-form";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Registrieren",
};

export default function RegisterPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <h2 className="text-xl font-extrabold">
          Dein Speiseplan — in 5 Minuten live
        </h2>
        <p className="text-sm text-muted-foreground">
          Gib deine E-Mail ein und wir senden dir einen Login-Link.
        </p>
      </div>

      <MagicLinkForm />

      <p className="font-mono text-[11px] uppercase tracking-[0.04em] text-center text-muted-foreground">
        Kein Passwort nötig
      </p>

      <p className="text-center text-sm text-muted-foreground">
        Bereits registriert?{" "}
        <Link href="/login" className="font-medium text-foreground underline underline-offset-4">
          Einloggen
        </Link>
      </p>
    </div>
  );
}
