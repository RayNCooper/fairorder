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
  maxOrdersPerSlot: number | null;
  paymentEnabled: boolean;
  acceptedPayments: string[];
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

const WEEKDAYS = [
  { key: "monday", label: "Montag" },
  { key: "tuesday", label: "Dienstag" },
  { key: "wednesday", label: "Mittwoch" },
  { key: "thursday", label: "Donnerstag" },
  { key: "friday", label: "Freitag" },
  { key: "saturday", label: "Samstag" },
  { key: "sunday", label: "Sonntag" },
] as const;

interface HoursSlot {
  open: string;
  close: string;
}

type HoursData = Record<string, HoursSlot[] | null>;

function parseHours(raw: string): HoursData {
  if (!raw.trim()) return {};
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed === "object" && parsed !== null) return parsed;
  } catch {
    // Not JSON — return empty
  }
  return {};
}

function serializeHours(data: HoursData): string {
  const cleaned: HoursData = {};
  for (const day of WEEKDAYS) {
    const slots = data[day.key];
    if (slots && slots.length > 0 && slots[0].open && slots[0].close) {
      cleaned[day.key] = slots;
    } else {
      cleaned[day.key] = null;
    }
  }
  return JSON.stringify(cleaned, null, 2);
}

function OperatingHoursEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const data = parseHours(value);

  function updateDay(dayKey: string, open: string, close: string) {
    const next = { ...data };
    if (open || close) {
      next[dayKey] = [{ open, close }];
    } else {
      next[dayKey] = null;
    }
    onChange(serializeHours(next));
  }

  function toggleDay(dayKey: string, enabled: boolean) {
    const next = { ...data };
    if (enabled) {
      next[dayKey] = [{ open: "07:30", close: "15:00" }];
    } else {
      next[dayKey] = null;
    }
    onChange(serializeHours(next));
  }

  return (
    <div className="space-y-2">
      {WEEKDAYS.map((day) => {
        const slots = data[day.key];
        const isActive = slots && slots.length > 0 && (slots[0].open || slots[0].close);
        const open = slots?.[0]?.open ?? "";
        const close = slots?.[0]?.close ?? "";

        return (
          <div key={day.key} className="flex items-center gap-3">
            <div className="flex w-24 items-center gap-2">
              <Switch
                checked={!!isActive}
                onCheckedChange={(checked) => toggleDay(day.key, checked)}
              />
              <span className="text-xs font-medium">{day.label}</span>
            </div>
            {isActive ? (
              <div className="flex items-center gap-1.5">
                <Input
                  type="time"
                  value={open}
                  onChange={(e) => updateDay(day.key, e.target.value, close)}
                  className="w-28 rounded-none font-mono text-xs"
                />
                <span className="text-xs text-muted-foreground">–</span>
                <Input
                  type="time"
                  value={close}
                  onChange={(e) => updateDay(day.key, open, e.target.value)}
                  className="w-28 rounded-none font-mono text-xs"
                />
              </div>
            ) : (
              <span className="text-xs text-muted-foreground">Geschlossen</span>
            )}
          </div>
        );
      })}
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
          <Label>Öffnungszeiten</Label>
          <OperatingHoursEditor
            value={operatingHours}
            onChange={setOperatingHours}
          />
          <p className="text-xs text-muted-foreground">
            Lege die Öffnungszeiten für jeden Wochentag fest.
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
  const [maxOrdersPerSlot, setMaxOrdersPerSlot] = useState(
    location.maxOrdersPerSlot ? String(location.maxOrdersPerSlot) : ""
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
          maxOrdersPerSlot: maxOrdersPerSlot ? Number(maxOrdersPerSlot) : null,
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

        <div className="space-y-2">
          <Label htmlFor="max-orders-slot">Max. Bestellungen pro Zeitfenster</Label>
          <Input
            id="max-orders-slot"
            type="number"
            min={1}
            max={999}
            value={maxOrdersPerSlot}
            onChange={(e) => setMaxOrdersPerSlot(e.target.value)}
            placeholder="Unbegrenzt"
            className="w-32 rounded-none font-mono"
          />
          <p className="text-xs text-muted-foreground">
            Begrenzt Bestellungen pro 15-Minuten-Fenster. Leer = unbegrenzt.
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

export function PaymentSettingsForm({ location }: { location: LocationData }) {
  const router = useRouter();
  const [paymentEnabled, setPaymentEnabled] = useState(location.paymentEnabled);
  const [acceptCash, setAcceptCash] = useState(
    location.acceptedPayments.includes("cash")
  );
  const [acceptStripe, setAcceptStripe] = useState(
    location.acceptedPayments.includes("stripe")
  );
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [, startTransition] = useTransition();

  async function handleSave() {
    const acceptedPayments: string[] = [];
    if (acceptCash) acceptedPayments.push("cash");
    if (acceptStripe) acceptedPayments.push("stripe");

    if (paymentEnabled && acceptedPayments.length === 0) {
      setMessage({ type: "error", text: "Mindestens eine Zahlungsart muss aktiviert sein." });
      return;
    }

    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/locations/${location.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentEnabled, acceptedPayments }),
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
      title="Zahlung"
      description="Konfiguriere die Zahlungsoptionen für Vorbestellungen."
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="payment-enabled">Online-Zahlung aktivieren</Label>
            <p className="text-xs text-muted-foreground">
              Kunden können bei der Bestellung direkt bezahlen.
            </p>
          </div>
          <Switch
            id="payment-enabled"
            checked={paymentEnabled}
            onCheckedChange={setPaymentEnabled}
          />
        </div>

        {paymentEnabled && (
          <div className="space-y-3 border-l-[3px] border-amber-500 bg-amber-50 px-3 py-2">
            <p className="text-xs font-medium text-amber-800">Akzeptierte Zahlungsarten</p>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="accept-cash" className="text-sm">Barzahlung</Label>
                <p className="text-xs text-muted-foreground">Zahlung an der Kasse</p>
              </div>
              <Switch
                id="accept-cash"
                checked={acceptCash}
                onCheckedChange={setAcceptCash}
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="accept-stripe" className="text-sm">Kartenzahlung (Stripe)</Label>
                <p className="text-xs text-muted-foreground">Kreditkarte, Apple Pay, Google Pay</p>
              </div>
              <Switch
                id="accept-stripe"
                checked={acceptStripe}
                onCheckedChange={setAcceptStripe}
              />
            </div>
          </div>
        )}

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
