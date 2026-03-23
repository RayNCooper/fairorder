"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { IconLoader2 } from "@tabler/icons-react";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[äÄ]/g, "ae")
    .replace(/[öÖ]/g, "oe")
    .replace(/[üÜ]/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function SetupForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setError("");

    try {
      const res = await fetch("/api/locations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, slug }),
      });

      if (res.ok) {
        router.push("/menu-import");
      } else {
        const data = await res.json();
        setStatus("error");
        setError(data.error ?? "Ein Fehler ist aufgetreten.");
      }
    } catch {
      setStatus("error");
      setError("Verbindungsfehler.");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="border-l-[3px] border-destructive bg-destructive/5 p-3">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      <div className="space-y-2">
        <label htmlFor="name" className="text-sm font-medium">
          Name des Betriebs
        </label>
        <input
          id="name"
          type="text"
          value={name}
          onChange={(e) => {
              setName(e.target.value);
              if (!slugEdited) setSlug(slugify(e.target.value));
            }}
          placeholder="z.B. Müllers Bäckerei"
          required
          autoFocus
          className="flex h-11 w-full border border-input bg-background px-3 py-2 text-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="slug" className="text-sm font-medium">
          URL-Kürzel
        </label>
        <div className="flex items-center gap-0 border border-input">
          <span className="flex h-11 items-center bg-muted px-3 text-sm text-muted-foreground">
            app.fair-order.de/
          </span>
          <input
            id="slug"
            type="text"
            value={slug}
            onChange={(e) => {
              setSlug(slugify(e.target.value));
              setSlugEdited(true);
            }}
            required
            className="flex h-11 flex-1 border-0 bg-background px-3 py-2 font-mono text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Unter dieser Adresse finden Kunden deine Speisekarte.
        </p>
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={status === "loading" || !name || !slug}
          className="inline-flex h-11 items-center justify-center bg-primary px-8 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {status === "loading" ? (
            <>
              <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />
              Wird erstellt...
            </>
          ) : (
            "Weiter →"
          )}
        </button>
      </div>
    </form>
  );
}
