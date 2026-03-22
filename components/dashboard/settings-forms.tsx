"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { IconLoader2 } from "@tabler/icons-react";

interface LocationData {
  id: string;
  name: string;
  slug: string;
  operatingHours: string | null;
  orderingEnabled: boolean;
  maxActiveOrders: number;
}

interface UserData {
  email: string;
}

function SectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border border-border bg-card p-6">
      <h3 className="text-sm font-semibold">{title}</h3>
      {description && (
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      )}
      <div className="mt-4">{children}</div>
    </div>
  );
}

export function LocationSettingsForm({ location }: { location: LocationData }) {
  const router = useRouter();
  const [name, setName] = useState(location.name);
  const [operatingHours, setOperatingHours] = useState(
    location.operatingHours ?? ""
  );
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [, startTransition] = useTransition();

  async function handleSave() {
    setSaving(true);
    setMessage(null);
    try {
      const body: Record<string, unknown> = { name };

      // Parse operating hours: store as JSON if valid, otherwise as string
      if (operatingHours.trim()) {
        try {
          body.operatingHours = JSON.parse(operatingHours);
        } catch {
          body.operatingHours = operatingHours.trim();
        }
      } else {
        body.operatingHours = null;
      }

      const res = await fetch(`/api/locations/${location.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        setMessage({ type: "error", text: data.error || "Fehler beim Speichern." });
        return;
      }

      setMessage({ type: "success", text: "Gespeichert." });
      startTransition(() => {
        router.refresh();
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <SectionCard
      title="Standort"
      description="Verwalte die Grundeinstellungen deines Standorts."
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="location-name">Name</Label>
          <Input
            id="location-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-none"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="location-slug">URL-Kürzel</Label>
          <Input
            id="location-slug"
            value={location.slug}
            disabled
            className="rounded-none bg-muted"
          />
          <p className="text-xs text-muted-foreground">
            Das URL-Kürzel kann nicht geändert werden.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="operating-hours">Öffnungszeiten</Label>
          <Input
            id="operating-hours"
            value={operatingHours}
            onChange={(e) => setOperatingHours(e.target.value)}
            placeholder='z.B. Mo-Fr 8:00-16:00'
            className="rounded-none"
          />
          <p className="text-xs text-muted-foreground">
            Freitext oder JSON-Format.
          </p>
        </div>

        {message && (
          <div
            className={cn(
              "border-l-[3px] px-3 py-2 text-sm",
              message.type === "success"
                ? "border-green-600 bg-green-50 text-green-800"
                : "border-red-600 bg-red-50 text-red-800"
            )}
          >
            {message.text}
          </div>
        )}

        <Button
          className="rounded-none"
          onClick={handleSave}
          disabled={saving}
        >
          {saving && <IconLoader2 className="size-4 animate-spin" />}
          Speichern
        </Button>
      </div>
    </SectionCard>
  );
}

export function OrderSettingsForm({ location }: { location: LocationData }) {
  const router = useRouter();
  const [orderingEnabled, setOrderingEnabled] = useState(
    location.orderingEnabled
  );
  const [maxActiveOrders, setMaxActiveOrders] = useState(
    String(location.maxActiveOrders)
  );
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [, startTransition] = useTransition();

  async function handleSave() {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/locations/${location.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderingEnabled,
          maxActiveOrders: Number(maxActiveOrders),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setMessage({ type: "error", text: data.error || "Fehler beim Speichern." });
        return;
      }

      setMessage({ type: "success", text: "Gespeichert." });
      startTransition(() => {
        router.refresh();
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <SectionCard
      title="Bestellungen"
      description="Konfiguriere, ob und wie viele Bestellungen angenommen werden."
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="ordering-enabled">Vorbestellungen aktiv</Label>
            <p className="text-xs text-muted-foreground">
              Kunden können über deine Menüseite bestellen.
            </p>
          </div>
          <Switch
            id="ordering-enabled"
            checked={orderingEnabled}
            onCheckedChange={setOrderingEnabled}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="max-orders">Max. aktive Bestellungen</Label>
          <Input
            id="max-orders"
            type="number"
            min={1}
            max={999}
            value={maxActiveOrders}
            onChange={(e) => setMaxActiveOrders(e.target.value)}
            className="w-32 rounded-none font-mono"
          />
          <p className="text-xs text-muted-foreground">
            Begrenzt gleichzeitig offene Bestellungen. Standard: 50.
          </p>
        </div>

        {message && (
          <div
            className={cn(
              "border-l-[3px] px-3 py-2 text-sm",
              message.type === "success"
                ? "border-green-600 bg-green-50 text-green-800"
                : "border-red-600 bg-red-50 text-red-800"
            )}
          >
            {message.text}
          </div>
        )}

        <Button
          className="rounded-none"
          onClick={handleSave}
          disabled={saving}
        >
          {saving && <IconLoader2 className="size-4 animate-spin" />}
          Speichern
        </Button>
      </div>
    </SectionCard>
  );
}

export function AccountSection({ user }: { user: UserData }) {
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      const res = await fetch("/api/auth/logout", { method: "POST" });
      if (res.redirected) {
        window.location.href = res.url;
      } else {
        window.location.href = "/login";
      }
    } catch {
      window.location.href = "/login";
    }
  }

  return (
    <SectionCard
      title="Konto"
      description="Deine Kontoinformationen und Sitzung."
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">E-Mail</Label>
          <Input
            id="email"
            value={user.email}
            disabled
            className="rounded-none bg-muted"
          />
        </div>

        <Button
          variant="outline"
          className="rounded-none"
          onClick={handleLogout}
          disabled={loggingOut}
        >
          {loggingOut && <IconLoader2 className="size-4 animate-spin" />}
          Abmelden
        </Button>
      </div>
    </SectionCard>
  );
}
