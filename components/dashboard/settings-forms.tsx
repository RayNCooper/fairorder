"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  IconLoader2,
  IconClipboardList,
  IconCreditCard,
  IconPlus,
  IconX,
} from "@tabler/icons-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface LocationData {
  id: string;
  name: string;
  slug: string;
  operatingHours: string | null;
  slotIntervalMinutes: number;
  orderingEnabled: boolean;
  maxActiveOrders: number;
  maxOrdersPerSlot: number | null;
  paymentEnabled: boolean;
  acceptedPayments: string[];
  companyName: string | null;
  address: string | null;
  phone: string | null;
  vatId: string | null;
  responsiblePerson: string | null;
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

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function slotsOverlap(slots: HoursSlot[]): boolean {
  const valid = slots.filter((s) => s.open && s.close);
  const sorted = [...valid].sort(
    (a, b) => timeToMinutes(a.open) - timeToMinutes(b.open)
  );
  for (let i = 1; i < sorted.length; i++) {
    if (timeToMinutes(sorted[i].open) < timeToMinutes(sorted[i - 1].close)) {
      return true;
    }
  }
  return false;
}

function serializeHours(data: HoursData): string {
  const cleaned: HoursData = {};
  for (const day of WEEKDAYS) {
    const slots = data[day.key];
    if (slots && slots.length > 0) {
      const validSlots = slots.filter((s) => s.open && s.close);
      cleaned[day.key] = validSlots.length > 0 ? validSlots : null;
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

  function updateSlot(
    dayKey: string,
    slotIndex: number,
    field: "open" | "close",
    val: string
  ) {
    const next = { ...data };
    const slots = [...(next[dayKey] ?? [])];
    slots[slotIndex] = { ...slots[slotIndex], [field]: val };
    next[dayKey] = slots;
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

  function addSlot(dayKey: string) {
    const next = { ...data };
    const existing = next[dayKey] ?? [];
    const lastSlot = existing[existing.length - 1];
    let defaultOpen = "17:00";
    let defaultClose = "20:00";
    if (lastSlot?.close) {
      const lastCloseMin = timeToMinutes(lastSlot.close);
      const newOpenMin = Math.min(lastCloseMin + 30, 23 * 60);
      const newCloseMin = Math.min(newOpenMin + 180, 23 * 60 + 59);
      if (newOpenMin < newCloseMin) {
        const oh = Math.floor(newOpenMin / 60);
        const om = newOpenMin % 60;
        const ch = Math.floor(newCloseMin / 60);
        const cm = newCloseMin % 60;
        defaultOpen = `${String(oh).padStart(2, "0")}:${String(om).padStart(2, "0")}`;
        defaultClose = `${String(ch).padStart(2, "0")}:${String(cm).padStart(2, "0")}`;
      }
    }
    next[dayKey] = [...existing, { open: defaultOpen, close: defaultClose }];
    onChange(serializeHours(next));
  }

  function removeSlot(dayKey: string, slotIndex: number) {
    const next = { ...data };
    const slots = [...(next[dayKey] ?? [])];
    slots.splice(slotIndex, 1);
    next[dayKey] = slots.length > 0 ? slots : null;
    onChange(serializeHours(next));
  }

  return (
    <div className="space-y-2">
      {WEEKDAYS.map((day) => {
        const slots = data[day.key];
        const isActive =
          slots && slots.length > 0 && (slots[0].open || slots[0].close);
        const hasOverlap = slots && slots.length > 1 && slotsOverlap(slots);

        return (
          <div key={day.key} className="space-y-1">
            <div className="flex items-start gap-3">
              <div className="flex w-24 shrink-0 items-center gap-2 pt-1.5">
                <Switch
                  checked={!!isActive}
                  onCheckedChange={(checked) => toggleDay(day.key, checked)}
                />
                <span className="text-xs font-medium">{day.label}</span>
              </div>
              {isActive ? (
                <div className="space-y-1.5">
                  {slots!.map((slot, i) => (
                    <div key={i} className="flex items-center gap-1.5">
                      <Input
                        type="time"
                        value={slot.open}
                        onChange={(e) =>
                          updateSlot(day.key, i, "open", e.target.value)
                        }
                        className="w-28 rounded-none font-mono text-xs"
                      />
                      <span className="text-xs text-muted-foreground">–</span>
                      <Input
                        type="time"
                        value={slot.close}
                        onChange={(e) =>
                          updateSlot(day.key, i, "close", e.target.value)
                        }
                        className="w-28 rounded-none font-mono text-xs"
                      />
                      {slots!.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeSlot(day.key, i)}
                          className="ml-1 text-muted-foreground hover:text-destructive"
                          aria-label="Zeitraum entfernen"
                        >
                          <IconX className="size-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => addSlot(day.key)}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <IconPlus className="size-3" />
                    Zeitraum
                  </button>
                  {hasOverlap && (
                    <p className="text-xs text-red-600">
                      Zeiträume überschneiden sich.
                    </p>
                  )}
                </div>
              ) : (
                <span className="pt-1.5 text-xs text-muted-foreground">
                  Geschlossen
                </span>
              )}
            </div>
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

const SLOT_INTERVAL_OPTIONS = [5, 10, 15, 20, 25, 30];

export function OrderSettingsForm({ location }: { location: LocationData }) {
  const router = useRouter();
  const [slotIntervalMinutes, setSlotIntervalMinutes] = useState(
    String(location.slotIntervalMinutes ?? 15)
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
          slotIntervalMinutes: Number(slotIntervalMinutes),
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
      description="Konfiguriere Zeitfenster und Kapazitäten für Bestellungen."
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="slot-interval">Zeitfenster für Bestellungen</Label>
          <Select
            value={slotIntervalMinutes}
            onValueChange={setSlotIntervalMinutes}
          >
            <SelectTrigger id="slot-interval" className="w-48 rounded-none font-mono">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SLOT_INTERVAL_OPTIONS.map((min) => (
                <SelectItem key={min} value={String(min)}>
                  {min} Minuten
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Bestellungen werden in {slotIntervalMinutes}-Minuten-Fenster gruppiert.
          </p>
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
            Begrenzt Bestellungen pro {slotIntervalMinutes}-Minuten-Fenster. Leer = unbegrenzt.
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

function PaymentMethodsForm({ location }: { location: LocationData }) {
  const router = useRouter();
  const [acceptCash, setAcceptCash] = useState(
    location.acceptedPayments.includes("cash")
  );
  const [acceptStripe, setAcceptStripe] = useState(
    location.acceptedPayments.includes("stripe")
  );
  const [acceptPayPal, setAcceptPayPal] = useState(
    location.acceptedPayments.includes("paypal")
  );
  const paypalConfigured = !!process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;
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
    if (acceptPayPal) acceptedPayments.push("paypal");

    if (acceptedPayments.length === 0) {
      setMessage({ type: "error", text: "Mindestens eine Zahlungsart muss aktiviert sein." });
      return;
    }

    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/locations/${location.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acceptedPayments }),
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
    <div className="space-y-4 border border-border bg-card p-4">
      <div className="space-y-3">
        <p className="text-xs font-semibold">Akzeptierte Zahlungsarten</p>
        <div className="flex items-center gap-3">
          <Switch
            id="accept-cash"
            checked={acceptCash}
            onCheckedChange={setAcceptCash}
          />
          <div className="space-y-0.5">
            <Label htmlFor="accept-cash" className="text-sm">Barzahlung</Label>
            <p className="text-xs text-muted-foreground">Zahlung an der Kasse</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Switch
            id="accept-stripe"
            checked={acceptStripe}
            onCheckedChange={setAcceptStripe}
          />
          <div className="space-y-0.5">
            <Label htmlFor="accept-stripe" className="text-sm">Kartenzahlung (Stripe)</Label>
            <p className="text-xs text-muted-foreground">Kreditkarte, Apple Pay, Google Pay</p>
          </div>
        </div>
        {paypalConfigured && (
          <div className="flex items-center gap-3">
            <Switch
              id="accept-paypal"
              checked={acceptPayPal}
              onCheckedChange={setAcceptPayPal}
            />
            <div className="space-y-0.5">
              <Label htmlFor="accept-paypal" className="text-sm">PayPal</Label>
              <p className="text-xs text-muted-foreground">Zahlung per PayPal-Konto</p>
            </div>
          </div>
        )}
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
  );
}

export function FeaturesSection({ location }: { location: LocationData }) {
  const router = useRouter();
  const [orderingEnabled, setOrderingEnabled] = useState(location.orderingEnabled);
  const [paymentEnabled, setPaymentEnabled] = useState(location.paymentEnabled);
  const [confirmDialog, setConfirmDialog] = useState<
    "disable-preorders" | "disable-payment" | null
  >(null);
  const [dialogSaving, setDialogSaving] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  async function toggleFeature(
    field: "orderingEnabled" | "paymentEnabled",
    value: boolean,
    extra?: Record<string, unknown>
  ) {
    setDialogSaving(true);
    setDialogError(null);
    try {
      const body: Record<string, unknown> = { [field]: value, ...extra };
      const res = await fetch(`/api/locations/${location.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        setDialogError(data.error || "Fehler beim Speichern.");
        return;
      }

      if (field === "orderingEnabled") {
        setOrderingEnabled(value);
        if (!value) setPaymentEnabled(false);
      } else {
        setPaymentEnabled(value);
      }

      setConfirmDialog(null);
      startTransition(() => {
        router.refresh();
      });
    } finally {
      setDialogSaving(false);
    }
  }

  function handlePreorderToggle(checked: boolean) {
    if (!checked) {
      setConfirmDialog("disable-preorders");
      return;
    }
    toggleFeature("orderingEnabled", true);
  }

  function handlePaymentToggle(checked: boolean) {
    if (!checked) {
      setConfirmDialog("disable-payment");
      return;
    }
    toggleFeature("paymentEnabled", true);
  }

  return (
    <div className="space-y-4">
      <SectionCard
        title="Funktionen"
        description="Aktiviere Vorbestellungen und Zahlungen für deine Gäste."
      >
        <div className="grid gap-4 md:grid-cols-2">
          {/* Preorders card */}
          <div
            className={cn(
              "flex min-h-[160px] flex-col justify-between border p-4",
              orderingEnabled
                ? "border-l-[3px] border-l-green-600 border-t-border border-r-border border-b-border"
                : "border-border"
            )}
          >
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <IconClipboardList className="size-5 text-muted-foreground" />
                <h4 className="text-sm font-semibold">Vorbestellungen</h4>
              </div>
              <p className="text-xs text-muted-foreground">
                Kunden können über deine Menüseite Bestellungen aufgeben.
              </p>
            </div>
            <div className="mt-4 flex items-center gap-2">
              <Switch
                id="ordering-enabled"
                checked={orderingEnabled}
                onCheckedChange={handlePreorderToggle}
              />
              <Label htmlFor="ordering-enabled" className="text-xs">
                {orderingEnabled ? "Aktiv" : "Inaktiv"}
              </Label>
            </div>
          </div>

          {/* Payment card */}
          <div
            className={cn(
              "relative flex min-h-[160px] flex-col justify-between border p-4",
              paymentEnabled
                ? "border-l-[3px] border-l-green-600 border-t-border border-r-border border-b-border"
                : "border-border",
              !orderingEnabled && "opacity-50"
            )}
          >
            {!orderingEnabled && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-card/60">
                <p className="text-xs font-medium text-muted-foreground">
                  Aktiviere zuerst Vorbestellungen
                </p>
              </div>
            )}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <IconCreditCard className="size-5 text-muted-foreground" />
                <h4 className="text-sm font-semibold">Online-Zahlung</h4>
              </div>
              <p className="text-xs text-muted-foreground">
                Kunden können bei der Bestellung direkt bezahlen.
              </p>
            </div>
            <div className="mt-4 flex items-center gap-2">
              <Switch
                id="payment-enabled"
                checked={paymentEnabled}
                onCheckedChange={handlePaymentToggle}
                disabled={!orderingEnabled}
              />
              <Label htmlFor="payment-enabled" className="text-xs">
                {paymentEnabled ? "Aktiv" : "Inaktiv"}
              </Label>
            </div>
          </div>
        </div>
      </SectionCard>

      {/* Sub-settings: order config (shown when preorders active) */}
      {orderingEnabled && <OrderSettingsForm location={location} />}

      {/* Sub-settings: payment methods (shown when payment active) */}
      {paymentEnabled && <PaymentMethodsForm location={location} />}

      {/* Disable preorders dialog */}
      <Dialog
        open={confirmDialog === "disable-preorders"}
        onOpenChange={(open) => {
          if (!open) {
            setConfirmDialog(null);
            setDialogError(null);
          }
        }}
      >
        <DialogContent className="rounded-none">
          <DialogHeader>
            <DialogTitle>Vorbestellungen deaktivieren</DialogTitle>
            <DialogDescription>
              Vorbestellungen werden deaktiviert. Laufende Bestellungen sind
              nicht betroffen. Online-Zahlungen werden ebenfalls deaktiviert.
            </DialogDescription>
          </DialogHeader>
          {dialogError && (
            <div className="border-l-[3px] border-red-600 bg-red-50 px-3 py-2 text-sm text-red-800">
              {dialogError}
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              className="rounded-none"
              onClick={() => {
                setConfirmDialog(null);
                setDialogError(null);
              }}
            >
              Abbrechen
            </Button>
            <Button
              variant="destructive"
              className="rounded-none"
              disabled={dialogSaving}
              onClick={() =>
                toggleFeature("orderingEnabled", false, {
                  paymentEnabled: false,
                })
              }
            >
              {dialogSaving && <IconLoader2 className="size-4 animate-spin" />}
              Deaktivieren
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Disable payment dialog */}
      <Dialog
        open={confirmDialog === "disable-payment"}
        onOpenChange={(open) => {
          if (!open) {
            setConfirmDialog(null);
            setDialogError(null);
          }
        }}
      >
        <DialogContent className="rounded-none">
          <DialogHeader>
            <DialogTitle>Online-Zahlung deaktivieren</DialogTitle>
            <DialogDescription>
              Online-Zahlungen werden deaktiviert. Kunden können nur noch bar
              bezahlen.
            </DialogDescription>
          </DialogHeader>
          {dialogError && (
            <div className="border-l-[3px] border-red-600 bg-red-50 px-3 py-2 text-sm text-red-800">
              {dialogError}
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              className="rounded-none"
              onClick={() => {
                setConfirmDialog(null);
                setDialogError(null);
              }}
            >
              Abbrechen
            </Button>
            <Button
              variant="destructive"
              className="rounded-none"
              disabled={dialogSaving}
              onClick={() => toggleFeature("paymentEnabled", false)}
            >
              {dialogSaving && <IconLoader2 className="size-4 animate-spin" />}
              Deaktivieren
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function LegalInfoSection({ location }: { location: LocationData }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [companyName, setCompanyName] = useState(location.companyName ?? "");
  const [address, setAddress] = useState(location.address ?? "");
  const [phone, setPhone] = useState(location.phone ?? "");
  const [vatId, setVatId] = useState(location.vatId ?? "");
  const [responsiblePerson, setResponsiblePerson] = useState(location.responsiblePerson ?? "");
  const [success, setSuccess] = useState(false);

  async function saveLegalInfo() {
    startTransition(async () => {
      setSuccess(false);
      const res = await fetch(`/api/locations/${location.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName: companyName.trim() || null,
          address: address.trim() || null,
          phone: phone.trim() || null,
          vatId: vatId.trim() || null,
          responsiblePerson: responsiblePerson.trim() || null,
        }),
      });
      if (res.ok) {
        setSuccess(true);
        router.refresh();
        setTimeout(() => setSuccess(false), 3000);
      }
    });
  }

  const hasData = companyName || address;

  return (
    <SectionCard
      title="Rechtliche Angaben"
      description="Impressum und Beleginformationen (Pflicht gem. DDG &sect; 5)."
    >
      <div className="space-y-4">
        {!hasData && (
          <div className="border-l-3 border-amber-400 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Bitte f&uuml;lle die rechtlichen Angaben aus, um dein Impressum und Belege zu vervollst&auml;ndigen.
          </div>
        )}

        {success && (
          <div className="border-l-3 border-green-500 bg-green-50 px-3 py-2 text-sm text-green-700">
            Rechtliche Angaben gespeichert.
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="companyName">Firmenname</Label>
          <Input
            id="companyName"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder="Muster GmbH"
            className="rounded-none"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="address">Anschrift</Label>
          <Input
            id="address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Musterstra&szlig;e 1, 12345 Berlin"
            className="rounded-none"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="phone">Telefon</Label>
          <Input
            id="phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+49 123 456789"
            className="rounded-none"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="vatId">USt-IdNr</Label>
          <Input
            id="vatId"
            value={vatId}
            onChange={(e) => setVatId(e.target.value)}
            placeholder="DE123456789"
            className="rounded-none font-mono"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="responsiblePerson">Verantwortliche Person</Label>
          <Input
            id="responsiblePerson"
            value={responsiblePerson}
            onChange={(e) => setResponsiblePerson(e.target.value)}
            placeholder="Max Mustermann"
            className="rounded-none"
          />
        </div>

        <Button
          className="rounded-none"
          onClick={saveLegalInfo}
          disabled={isPending}
        >
          {isPending && <IconLoader2 className="size-4 animate-spin" />}
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
