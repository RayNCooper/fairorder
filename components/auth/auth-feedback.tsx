"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function AuthFeedbackInner() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");

  if (!error) return null;

  const messages: Record<string, string> = {
    expired: "Dein Link ist abgelaufen. Bitte fordere einen neuen an.",
    invalid: "Ungültiger Link. Bitte fordere einen neuen an.",
  };

  const message = messages[error] ?? "Ein Fehler ist aufgetreten.";

  return (
    <div className="border-l-[3px] border-secondary bg-secondary/5 p-3">
      <p className="text-sm text-foreground">{message}</p>
    </div>
  );
}

export function AuthFeedback() {
  return (
    <Suspense fallback={null}>
      <AuthFeedbackInner />
    </Suspense>
  );
}
