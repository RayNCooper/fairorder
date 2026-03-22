import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-8 text-center">
        <div className="space-y-2">
          <p className="font-mono text-[11px] uppercase tracking-[0.04em] text-muted-foreground">
            Open Source
          </p>
          <h1 className="text-3xl font-extrabold tracking-tight">
            FairOrder
          </h1>
          <p className="text-muted-foreground">
            Dein Speiseplan — in 5 Minuten live.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <Link
            href="/register"
            className="inline-flex h-11 items-center justify-center bg-primary px-6 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Jetzt starten
          </Link>
          <Link
            href="/login"
            className="inline-flex h-11 items-center justify-center border border-border bg-background px-6 text-sm font-medium transition-colors hover:bg-accent"
          >
            Einloggen
          </Link>
        </div>
      </div>
    </div>
  );
}
