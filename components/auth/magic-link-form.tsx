"use client";

import { useState } from "react";
import { IconMail, IconLoader2 } from "@tabler/icons-react";

export function MagicLinkForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setMessage("");

    try {
      const res = await fetch("/api/auth/magic-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (res.ok) {
        setStatus("success");
        setMessage("Link gesendet! Prüfe dein Postfach.");
      } else {
        setStatus("error");
        setMessage(data.error ?? "Ein Fehler ist aufgetreten.");
      }
    } catch {
      setStatus("error");
      setMessage("Verbindungsfehler. Bitte versuche es erneut.");
    }
  }

  if (status === "success") {
    return (
      <div className="border-l-[3px] border-primary bg-primary/5 p-4">
        <div className="flex items-center gap-3">
          <IconMail className="h-5 w-5 text-primary" />
          <div>
            <p className="text-sm font-semibold">Link gesendet!</p>
            <p className="text-sm text-muted-foreground">
              Prüfe dein Postfach und klicke auf den Link.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {status === "error" && message && (
        <div className="border-l-[3px] border-destructive bg-destructive/5 p-3">
          <p className="text-sm text-destructive">{message}</p>
        </div>
      )}

      <div className="space-y-2">
        <label htmlFor="email" className="text-sm font-medium">
          E-Mail
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="name@beispiel.de"
          required
          autoFocus
          autoComplete="email"
          aria-label="E-Mail-Adresse"
          className="flex h-11 w-full border border-input bg-background px-3 py-2 text-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        />
      </div>

      <button
        type="submit"
        disabled={status === "loading"}
        className="inline-flex h-11 w-full items-center justify-center bg-primary px-6 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
      >
        {status === "loading" ? (
          <>
            <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />
            Sende Link...
          </>
        ) : (
          "Magic Link senden"
        )}
      </button>
    </form>
  );
}
