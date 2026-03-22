"use client";

import { useState, useCallback } from "react";
import { IconCopy, IconCheck } from "@tabler/icons-react";

export function AnalyticsClient({ displayUrl }: { displayUrl: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(displayUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement("textarea");
      textarea.value = displayUrl;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [displayUrl]);

  return (
    <div className="mt-4 flex items-center gap-2">
      <code className="flex-1 truncate bg-muted px-3 py-2 font-mono text-xs">
        {displayUrl}
      </code>
      <button
        onClick={handleCopy}
        className="inline-flex h-9 items-center justify-center gap-2 border border-border bg-background px-4 text-sm font-medium transition-colors hover:bg-accent"
      >
        {copied ? (
          <>
            <IconCheck className="h-4 w-4 text-primary" />
            Kopiert
          </>
        ) : (
          <>
            <IconCopy className="h-4 w-4" />
            Link kopieren
          </>
        )}
      </button>
    </div>
  );
}
