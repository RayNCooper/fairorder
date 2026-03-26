"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  StripePaymentForm,
  PaymentMethodSelector,
  type PaymentMethod,
} from "./payment-form";

// ── Types ────────────────────────────────────────────

interface MenuItem {
  id: string;
  name: string;
  description: string | null;
  price: number;
  imageUrl: string | null;
  allergens: string[];
  dietaryTags: string[];
  isAvailable?: boolean;
}

interface Category {
  id: string;
  name: string;
  menuItems: MenuItem[];
}

interface OperatingHoursDay {
  open: string;
  close: string;
}

interface PublicMenuProps {
  locationId: string;
  locationName: string;
  orderingEnabled: boolean;
  paymentEnabled: boolean;
  acceptedPayments: string[];
  categories: Category[];
  uncategorizedItems: MenuItem[];
  operatingHours?: Record<string, OperatingHoursDay[] | null> | null;
  timezone?: string;
}

interface CartItem {
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
}

// ── Helpers ──────────────────────────────────────────

function formatPrice(price: number): string {
  return price.toFixed(2).replace(".", ",");
}

const DAY_KEYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;

const DAY_LABELS: Record<string, string> = {
  monday: "Mo",
  tuesday: "Di",
  wednesday: "Mi",
  thursday: "Do",
  friday: "Fr",
  saturday: "Sa",
  sunday: "So",
};

function getTodayStatus(
  hours: Record<string, OperatingHoursDay[] | null> | null | undefined,
  timezone: string
): { isOpen: boolean; label: string } {
  if (!hours) return { isOpen: false, label: "" };

  const now = new Date();
  let dayIndex: number;
  let currentMinutes: number;
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      weekday: "long",
      hour: "numeric",
      minute: "numeric",
      hour12: false,
    });
    const parts = formatter.formatToParts(now);
    const weekday = parts.find((p) => p.type === "weekday")?.value?.toLowerCase() ?? "";
    dayIndex = DAY_KEYS.indexOf(weekday as (typeof DAY_KEYS)[number]);
    const hour = parseInt(parts.find((p) => p.type === "hour")?.value ?? "0", 10);
    const minute = parseInt(parts.find((p) => p.type === "minute")?.value ?? "0", 10);
    currentMinutes = hour * 60 + minute;
  } catch {
    dayIndex = now.getDay();
    currentMinutes = now.getHours() * 60 + now.getMinutes();
  }

  const dayKey = DAY_KEYS[dayIndex];
  const todaySlots = hours[dayKey];

  if (!todaySlots || todaySlots.length === 0) {
    return { isOpen: false, label: "Heute geschlossen" };
  }

  for (const slot of todaySlots) {
    const [oh, om] = slot.open.split(":").map(Number);
    const [ch, cm] = slot.close.split(":").map(Number);
    const openMin = oh * 60 + om;
    const closeMin = ch * 60 + cm;
    if (currentMinutes >= openMin && currentMinutes < closeMin) {
      return {
        isOpen: true,
        label: `Geöffnet bis ${slot.close} Uhr`,
      };
    }
  }

  // Find next opening today
  for (const slot of todaySlots) {
    const [oh, om] = slot.open.split(":").map(Number);
    const openMin = oh * 60 + om;
    if (currentMinutes < openMin) {
      return {
        isOpen: false,
        label: `Öffnet um ${slot.open} Uhr`,
      };
    }
  }

  return { isOpen: false, label: "Heute geschlossen" };
}

function formatHoursOverview(
  hours: Record<string, OperatingHoursDay[] | null> | null | undefined
): string[] {
  if (!hours) return [];
  const lines: string[] = [];
  const orderedDays = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
  for (const day of orderedDays) {
    const slots = hours[day];
    const label = DAY_LABELS[day] ?? day;
    if (!slots || slots.length === 0) {
      lines.push(`${label}: Geschlossen`);
    } else {
      const times = slots.map((s) => `${s.open}–${s.close}`).join(", ");
      lines.push(`${label}: ${times}`);
    }
  }
  return lines;
}

// ── Main Component ───────────────────────────────────

type OrderState = "idle" | "cart" | "submitting" | "paying" | "success" | "error";

export function PublicMenu({
  locationId,
  locationName,
  orderingEnabled,
  paymentEnabled,
  acceptedPayments,
  categories,
  uncategorizedItems,
  operatingHours,
  timezone = "Europe/Berlin",
}: PublicMenuProps) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [orderState, setOrderState] = useState<OrderState>("idle");
  const [customerName, setCustomerName] = useState("");
  const [customerNote, setCustomerNote] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [orderNumber, setOrderNumber] = useState<number | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [orderToken, setOrderToken] = useState<string | null>(null);
  const orderTokenRef = useRef<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const router = useRouter();

  // Pickup time slots
  const [availableSlots, setAvailableSlots] = useState<{ time: string; label: string; available: boolean; remaining: number | null }[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [loadingSlots, setLoadingSlots] = useState(false);

  const stripeAvailable = paymentEnabled && acceptedPayments.includes("stripe");

  // Fetch available pickup time slots when cart opens
  const fetchSlots = useCallback(async () => {
    setLoadingSlots(true);
    try {
      const res = await fetch(`/api/orders/available-slots?locationId=${locationId}`);
      if (res.ok) {
        const data = await res.json();
        setAvailableSlots(data.slots ?? []);
        // Auto-select first available slot
        const firstAvailable = (data.slots ?? []).find((s: { available: boolean }) => s.available);
        if (firstAvailable && !selectedSlot) {
          setSelectedSlot(firstAvailable.time);
        }
      }
    } catch {
      // Slots unavailable — ordering still works with server-calculated time
    } finally {
      setLoadingSlots(false);
    }
  }, [locationId, selectedSlot]);

  // Search & filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFilters, setSelectedFilters] = useState<Set<string>>(new Set());
  const [showHours, setShowHours] = useState(false);

  // Category nav
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const categoryRefs = useRef<Map<string, HTMLElement>>(new Map());
  const navRef = useRef<HTMLDivElement>(null);
  const isScrollingToCategory = useRef(false);

  // ── All items flat (for filters) ──
  const allItems = useMemo(() => {
    const items: MenuItem[] = [];
    for (const cat of categories) {
      items.push(...cat.menuItems);
    }
    items.push(...uncategorizedItems);
    return items;
  }, [categories, uncategorizedItems]);

  // ── Collect all unique filter tags ──
  const allFilterTags = useMemo(() => {
    const tags = new Set<string>();
    for (const item of allItems) {
      for (const t of item.dietaryTags) tags.add(t);
      for (const a of item.allergens) tags.add(a);
    }
    return Array.from(tags).sort();
  }, [allItems]);

  // ── Filter + search logic ──
  const matchesItem = useCallback(
    (item: MenuItem): boolean => {
      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const match =
          item.name.toLowerCase().includes(q) ||
          (item.description?.toLowerCase().includes(q) ?? false) ||
          item.allergens.some((a) => a.toLowerCase().includes(q)) ||
          item.dietaryTags.some((t) => t.toLowerCase().includes(q));
        if (!match) return false;
      }
      // Tag filters (AND — item must match ALL selected filters)
      if (selectedFilters.size > 0) {
        const itemTags = new Set([...item.dietaryTags, ...item.allergens]);
        for (const filter of selectedFilters) {
          if (!itemTags.has(filter)) return false;
        }
      }
      return true;
    },
    [searchQuery, selectedFilters]
  );

  const filteredCategories = useMemo(() => {
    return categories
      .map((cat) => ({
        ...cat,
        menuItems: cat.menuItems.filter(matchesItem),
      }))
      .filter((cat) => cat.menuItems.length > 0);
  }, [categories, matchesItem]);

  const filteredUncategorized = useMemo(
    () => uncategorizedItems.filter(matchesItem),
    [uncategorizedItems, matchesItem]
  );

  // ── IntersectionObserver for active category ──
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (isScrollingToCategory.current) return;
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveCategory(entry.target.getAttribute("data-category-id"));
          }
        }
      },
      { rootMargin: "-20% 0px -60% 0px", threshold: 0 }
    );

    for (const el of categoryRefs.current.values()) {
      observer.observe(el);
    }

    return () => observer.disconnect();
  }, [filteredCategories]);

  function scrollToCategory(categoryId: string) {
    const el = categoryRefs.current.get(categoryId);
    if (!el) return;
    isScrollingToCategory.current = true;
    setActiveCategory(categoryId);
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    setTimeout(() => {
      isScrollingToCategory.current = false;
    }, 800);
  }

  // ── Cart logic ──
  const cartTotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  function addToCart(item: MenuItem) {
    setCart((prev) => {
      const existing = prev.find((c) => c.menuItemId === item.id);
      if (existing) {
        return prev.map((c) =>
          c.menuItemId === item.id ? { ...c, quantity: c.quantity + 1 } : c
        );
      }
      return [...prev, { menuItemId: item.id, name: item.name, price: item.price, quantity: 1 }];
    });
  }

  function updateQuantity(menuItemId: string, delta: number) {
    setCart((prev) => {
      const updated = prev
        .map((c) =>
          c.menuItemId === menuItemId ? { ...c, quantity: c.quantity + delta } : c
        )
        .filter((c) => c.quantity > 0);
      if (updated.length === 0 && orderState === "cart") {
        setOrderState("idle");
      }
      return updated;
    });
  }

  function getCartQuantity(menuItemId: string): number {
    return cart.find((c) => c.menuItemId === menuItemId)?.quantity ?? 0;
  }

  async function submitOrder() {
    if (!customerName.trim()) {
      setErrorMessage("Bitte gib deinen Namen an.");
      return;
    }
    if (cart.length === 0) return;

    setOrderState("submitting");
    setErrorMessage("");

    try {
      // Build pickup time from selected slot
      let requestedPickupTime: string | undefined;
      if (selectedSlot) {
        const today = new Date();
        const [h, m] = selectedSlot.split(":").map(Number);
        today.setHours(h, m, 0, 0);
        requestedPickupTime = today.toISOString();
      }

      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          locationId,
          customerName: customerName.trim(),
          customerNote: customerNote.trim() || undefined,
          customerEmail: customerEmail.trim() || undefined,
          requestedPickupTime,
          items: cart.map((c) => ({
            menuItemId: c.menuItemId,
            quantity: c.quantity,
          })),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setErrorMessage(data.error || "Bestellung fehlgeschlagen.");
        setOrderState("error");
        return;
      }

      const order = await res.json();
      setOrderNumber(order.orderNumber);
      setOrderId(order.id);
      setOrderToken(order.token);
      orderTokenRef.current = order.token;

      // If Stripe payment selected, create payment intent
      if (paymentMethod === "stripe" && stripeAvailable) {
        const piRes = await fetch("/api/payment/create-intent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ locationId, orderId: order.id }),
        });

        if (!piRes.ok) {
          const piData = await piRes.json();
          setErrorMessage(piData.error || "Zahlung konnte nicht erstellt werden.");
          setOrderState("error");
          return;
        }

        const { clientSecret: secret } = await piRes.json();
        setClientSecret(secret);
        setOrderState("paying");
        return;
      }

      // Cash payment — redirect to order tracking page
      setOrderState("success");
      router.replace(`/order/${order.token}`);
    } catch {
      setErrorMessage("Verbindungsfehler. Bitte versuche es erneut.");
      setOrderState("error");
    }
  }

  // ── Opening hours ──
  const todayStatus = useMemo(
    () => getTodayStatus(operatingHours, timezone),
    [operatingHours, timezone]
  );
  const hoursOverview = useMemo(
    () => formatHoursOverview(operatingHours),
    [operatingHours]
  );

  // ── Toggle filter ──
  function toggleFilter(tag: string) {
    setSelectedFilters((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) {
        next.delete(tag);
      } else {
        next.add(tag);
      }
      return next;
    });
  }

  // ── Payment screen ──
  if (orderState === "paying" && clientSecret && orderId) {
    return (
      <div className="min-h-dvh bg-[#FAFAF8]">
        <header className="border-b border-stone-200 bg-white px-4 py-6 text-center">
          <h1 className="text-2xl font-extrabold tracking-tight text-stone-900">
            {locationName}
          </h1>
        </header>
        <main className="mx-auto max-w-md px-4 py-8">
          <div className="space-y-4">
            <h2 className="text-lg font-extrabold text-stone-900">Zahlung</h2>
            <p className="text-sm text-stone-500">
              Bestellung #{orderNumber} &mdash; {formatPrice(cartTotal)}&nbsp;&euro;
            </p>
            <StripePaymentForm
              clientSecret={clientSecret}
              amount={Math.round(cartTotal * 100)}
              orderId={orderId}
              onSuccess={() => {
                setOrderState("success");
                const token = orderToken || orderTokenRef.current;
                if (token) {
                  router.replace(`/order/${token}`);
                }
              }}
              onError={(msg) => {
                setErrorMessage(msg);
                setOrderState("error");
                setClientSecret(null);
              }}
            />
          </div>
        </main>
      </div>
    );
  }

  // ── Redirect to order tracking page ──
  if (orderState === "success") {
    return (
      <div className="min-h-dvh bg-[#FAFAF8]">
        <header className="border-b border-stone-200 bg-white px-4 py-6 text-center">
          <h1 className="text-2xl font-extrabold tracking-tight text-stone-900">
            {locationName}
          </h1>
        </header>
        <main className="mx-auto max-w-2xl px-4 py-16 text-center">
          <div className="space-y-4">
            <div className="inline-flex h-16 w-16 items-center justify-center bg-green-100">
              <span className="text-2xl text-green-600">&#10003;</span>
            </div>
            <h2 className="text-xl font-extrabold text-stone-900">
              Bestellung aufgegeben!
            </h2>
            <p className="text-sm text-stone-500">
              Weiterleitung zu deiner Bestellung...
            </p>
          </div>
        </main>
      </div>
    );
  }

  const hasItems =
    categories.some((c) => c.menuItems.length > 0) ||
    uncategorizedItems.length > 0;

  const hasImages =
    categories.some((c) => c.menuItems.some((i) => i.imageUrl)) ||
    uncategorizedItems.some((i) => i.imageUrl);

  const isFiltered = searchQuery.trim() !== "" || selectedFilters.size > 0;
  const noResults = isFiltered && filteredCategories.length === 0 && filteredUncategorized.length === 0;

  return (
    <div className="min-h-dvh bg-[#FAFAF8]">
      {/* Header */}
      <header className="border-b border-stone-200 bg-white px-4 py-6 text-center">
        <h1 className="text-2xl font-extrabold tracking-tight text-stone-900">
          {locationName}
        </h1>
        <p className="mt-1 font-mono text-[11px] uppercase tracking-wider text-stone-400">
          Speisekarte
        </p>

        {/* Opening hours badge */}
        {todayStatus.label && (
          <div className="mt-3">
            <button
              onClick={() => setShowHours(!showHours)}
              className="inline-flex items-center gap-1.5 text-sm transition-colors hover:text-stone-700"
            >
              <span
                className={
                  todayStatus.isOpen
                    ? "inline-block h-2 w-2 bg-green-500"
                    : "inline-block h-2 w-2 bg-stone-400"
                }
              />
              <span className="font-mono text-xs text-stone-500">
                {todayStatus.label}
              </span>
              <span className="font-mono text-[10px] text-stone-400">
                {showHours ? "▲" : "▼"}
              </span>
            </button>

            {showHours && hoursOverview.length > 0 && (
              <div className="mx-auto mt-2 max-w-xs border border-stone-200 bg-white p-3 text-left">
                {hoursOverview.map((line) => (
                  <p
                    key={line}
                    className="font-mono text-[11px] text-stone-500 leading-5"
                  >
                    {line}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}
      </header>

      {/* Affiliate banner — shown only when menu items have images */}
      {hasImages && (
        <div className="border-b border-stone-100 bg-white py-1.5 text-center">
          <a
            href="https://bunny.net?ref=ql6ot7qdg0"
            target="_blank"
            rel="noopener"
            className="font-mono text-[10px] uppercase tracking-wider text-stone-400 hover:text-stone-600 transition-colors"
          >
            Bilder via bunny.net &rarr;
          </a>
        </div>
      )}

      {/* Search + Filters + Category Nav */}
      {hasItems && (
        <div className="sticky top-0 z-40 border-b border-stone-200 bg-white">
          {/* Search bar */}
          <div className="mx-auto max-w-2xl px-4 pt-3 pb-2">
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value.slice(0, 200))}
              placeholder="Suche nach Gerichten, Allergenen..."
              className="w-full border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 placeholder:text-stone-400 focus:border-stone-500 focus:outline-none"
            />
          </div>

          {/* Filter chips */}
          {allFilterTags.length > 0 && (
            <div className="mx-auto max-w-2xl overflow-x-auto px-4 pb-2">
              <div className="flex gap-1.5">
                {allFilterTags.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => toggleFilter(tag)}
                    className={
                      selectedFilters.has(tag)
                        ? "shrink-0 border border-stone-900 bg-stone-900 px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-white"
                        : "shrink-0 border border-stone-300 bg-white px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-stone-600 hover:border-stone-400"
                    }
                  >
                    {tag}
                  </button>
                ))}
                {selectedFilters.size > 0 && (
                  <button
                    onClick={() => setSelectedFilters(new Set())}
                    className="shrink-0 px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-stone-400 hover:text-stone-600"
                  >
                    Alle zurücksetzen
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Category tabs (mobile: horizontal scroll) */}
          {!isFiltered && filteredCategories.length > 1 && (
            <div
              ref={navRef}
              className="overflow-x-auto border-t border-stone-100"
            >
              <div className="flex">
                {filteredCategories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => scrollToCategory(cat.id)}
                    className={
                      activeCategory === cat.id
                        ? "shrink-0 border-b-2 border-stone-900 px-4 py-2 text-xs font-bold text-stone-900"
                        : "shrink-0 border-b-2 border-transparent px-4 py-2 text-xs font-medium text-stone-500 hover:text-stone-700"
                    }
                  >
                    {cat.name}
                  </button>
                ))}
                {filteredUncategorized.length > 0 && (
                  <button
                    onClick={() => scrollToCategory("uncategorized")}
                    className={
                      activeCategory === "uncategorized"
                        ? "shrink-0 border-b-2 border-stone-900 px-4 py-2 text-xs font-bold text-stone-900"
                        : "shrink-0 border-b-2 border-transparent px-4 py-2 text-xs font-medium text-stone-500 hover:text-stone-700"
                    }
                  >
                    Weitere Gerichte
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Menu content */}
      <main className="mx-auto max-w-2xl px-4 py-8">
        {!hasItems ? (
          <div className="py-16 text-center">
            <p className="text-sm text-stone-500">
              Die Speisekarte wird gerade aktualisiert.
            </p>
          </div>
        ) : noResults ? (
          <div className="py-16 text-center">
            <p className="text-sm text-stone-500">
              Keine Ergebnisse für &bdquo;{searchQuery.trim()}&ldquo;
            </p>
            <button
              onClick={() => {
                setSearchQuery("");
                setSelectedFilters(new Set());
              }}
              className="mt-3 font-mono text-xs text-stone-500 underline hover:text-stone-700"
            >
              Filter zurücksetzen
            </button>
          </div>
        ) : (
          <div className="space-y-10">
            {filteredCategories.map((category) => (
              <section
                key={category.id}
                ref={(el) => {
                  if (el) categoryRefs.current.set(category.id, el);
                  else categoryRefs.current.delete(category.id);
                }}
                data-category-id={category.id}
                className="scroll-mt-36"
              >
                <h2 className="border-b border-stone-200 pb-2 text-lg font-extrabold tracking-tight text-stone-900">
                  {category.name}
                </h2>
                <div className="mt-4 space-y-3">
                  {category.menuItems.map((item) => (
                    <MenuItemCard
                      key={item.id}
                      item={item}
                      orderingEnabled={orderingEnabled}
                      quantity={getCartQuantity(item.id)}
                      onAdd={() => addToCart(item)}
                      onIncrement={() => updateQuantity(item.id, 1)}
                      onDecrement={() => updateQuantity(item.id, -1)}
                    />
                  ))}
                </div>
              </section>
            ))}

            {filteredUncategorized.length > 0 && (
              <section
                ref={(el) => {
                  if (el) categoryRefs.current.set("uncategorized", el);
                  else categoryRefs.current.delete("uncategorized");
                }}
                data-category-id="uncategorized"
                className="scroll-mt-36"
              >
                <h2 className="border-b border-stone-200 pb-2 text-lg font-extrabold tracking-tight text-stone-900">
                  Weitere Gerichte
                </h2>
                <div className="mt-4 space-y-3">
                  {filteredUncategorized.map((item) => (
                    <MenuItemCard
                      key={item.id}
                      item={item}
                      orderingEnabled={orderingEnabled}
                      quantity={getCartQuantity(item.id)}
                      onAdd={() => addToCart(item)}
                      onIncrement={() => updateQuantity(item.id, 1)}
                      onDecrement={() => updateQuantity(item.id, -1)}
                    />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </main>

      {/* Cart bar — fixed at bottom */}
      {orderingEnabled && cartCount > 0 && orderState !== "cart" && (
        <div className="fixed inset-x-0 bottom-0 border-t border-stone-200 bg-white px-4 py-3 shadow-lg">
          <button
            className="flex w-full items-center justify-between bg-stone-900 px-4 py-3 text-white hover:bg-stone-800"
            onClick={() => { setOrderState("cart"); fetchSlots(); }}
          >
            <span className="flex items-center gap-2 text-sm font-bold">
              <span className="inline-flex h-6 w-6 items-center justify-center bg-white font-mono text-xs font-bold text-stone-900">
                {cartCount}
              </span>
              Warenkorb anzeigen
            </span>
            <span className="font-mono text-sm font-bold tabular-nums">
              {formatPrice(cartTotal)}&nbsp;&euro;
            </span>
          </button>
        </div>
      )}

      {/* Cart / Checkout overlay */}
      {orderState === "cart" || orderState === "submitting" || orderState === "error" ? (
        <div className="fixed inset-0 z-50 flex flex-col bg-[#FAFAF8]">
          <header className="flex items-center justify-between border-b border-stone-200 bg-white px-4 py-4">
            <h2 className="text-lg font-extrabold tracking-tight text-stone-900">
              Deine Bestellung
            </h2>
            <button
              className="font-mono text-sm text-stone-500 hover:text-stone-900"
              onClick={() => {
                setOrderState("idle");
                setErrorMessage("");
              }}
            >
              Schliessen
            </button>
          </header>

          <main className="flex-1 overflow-y-auto px-4 py-6">
            <div className="mx-auto max-w-md space-y-6">
              {/* Cart items */}
              <div className="space-y-3">
                {cart.map((item) => (
                  <div
                    key={item.menuItemId}
                    className="flex items-center justify-between border border-stone-200 bg-white p-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-stone-900">{item.name}</p>
                      <p className="font-mono text-xs text-stone-500">
                        {formatPrice(item.price)}&nbsp;&euro;
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        className="flex h-8 w-8 items-center justify-center border border-stone-300 bg-white text-stone-700 hover:bg-stone-50"
                        onClick={() => updateQuantity(item.menuItemId, -1)}
                      >
                        &minus;
                      </button>
                      <span className="w-6 text-center font-mono text-sm font-bold tabular-nums">
                        {item.quantity}
                      </span>
                      <button
                        className="flex h-8 w-8 items-center justify-center border border-stone-300 bg-white text-stone-700 hover:bg-stone-50"
                        onClick={() => updateQuantity(item.menuItemId, 1)}
                      >
                        +
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Customer info */}
              <div className="space-y-3">
                <div>
                  <label htmlFor="customer-name" className="text-sm font-bold text-stone-700">
                    Dein Name *
                  </label>
                  <input
                    id="customer-name"
                    type="text"
                    className="mt-1 w-full border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 placeholder:text-stone-400 focus:border-stone-500 focus:outline-none"
                    placeholder="z.B. Max"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                  />
                </div>
                <div>
                  <label htmlFor="customer-note" className="text-sm font-bold text-stone-700">
                    Hinweis <span className="font-normal text-stone-400">(optional)</span>
                  </label>
                  <textarea
                    id="customer-note"
                    className="mt-1 w-full border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 placeholder:text-stone-400 focus:border-stone-500 focus:outline-none"
                    placeholder="z.B. Ohne Zwiebeln"
                    rows={2}
                    value={customerNote}
                    onChange={(e) => setCustomerNote(e.target.value)}
                  />
                </div>
              </div>

              {/* Pickup time slot */}
              {availableSlots.length > 0 && (
                <div>
                  <label htmlFor="pickup-time" className="text-sm font-bold text-stone-700">
                    Abholzeit wählen
                  </label>
                  <select
                    id="pickup-time"
                    value={selectedSlot ?? ""}
                    onChange={(e) => setSelectedSlot(e.target.value || null)}
                    className="mt-1 w-full border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 focus:border-stone-500 focus:outline-none"
                  >
                    {availableSlots.map((slot) => (
                      <option key={slot.time} value={slot.time} disabled={!slot.available}>
                        {slot.label}{slot.remaining !== null ? ` (${slot.remaining} frei)` : ""}{!slot.available ? " — voll" : ""}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {loadingSlots && (
                <p className="font-mono text-xs text-stone-400">Zeitfenster werden geladen...</p>
              )}

              {/* Email notification (optional) */}
              <div>
                <label htmlFor="customer-email" className="text-sm font-bold text-stone-700">
                  E-Mail <span className="font-normal text-stone-400">(optional — für Abholbenachrichtigung)</span>
                </label>
                <input
                  id="customer-email"
                  type="email"
                  className="mt-1 w-full border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 placeholder:text-stone-400 focus:border-stone-500 focus:outline-none"
                  placeholder="z.B. max@beispiel.de"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                />
              </div>

              {/* Payment method */}
              {stripeAvailable && (
                <PaymentMethodSelector
                  acceptedPayments={acceptedPayments}
                  selected={paymentMethod}
                  onSelect={setPaymentMethod}
                />
              )}

              {/* Error */}
              {errorMessage && (
                <div className="border-l-3 border-red-500 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {errorMessage}
                </div>
              )}
            </div>
          </main>

          {/* Submit button */}
          <div className="border-t border-stone-200 bg-white px-4 py-4">
            <div className="mx-auto max-w-md">
              <button
                className="flex w-full items-center justify-between bg-green-600 px-4 py-3 text-white hover:bg-green-500 disabled:opacity-50"
                disabled={orderState === "submitting" || cart.length === 0}
                onClick={submitOrder}
              >
                <span className="text-sm font-bold">
                  {orderState === "submitting" ? "Wird gesendet..." : "Bestellung aufgeben"}
                </span>
                <span className="font-mono text-sm font-bold tabular-nums">
                  {formatPrice(cartTotal)}&nbsp;&euro;
                </span>
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Footer */}
      {cartCount === 0 && (
        <footer className="border-t border-stone-200 py-6 text-center">
          <p className="font-mono text-[11px] uppercase tracking-wider text-stone-400">
            Powered by FairOrder
          </p>
        </footer>
      )}
    </div>
  );
}

// ── Menu Item Card ────────────────────────────────────

function MenuItemCard({
  item,
  orderingEnabled,
  quantity,
  onAdd,
  onIncrement,
  onDecrement,
}: {
  item: MenuItem;
  orderingEnabled: boolean;
  quantity: number;
  onAdd: () => void;
  onIncrement: () => void;
  onDecrement: () => void;
}) {
  const unavailable = item.isAvailable === false;

  return (
    <div className={`flex gap-4 border border-stone-200 bg-white p-4${unavailable ? " opacity-50" : ""}`}>
      {item.imageUrl && (
        <div className={`h-16 w-16 shrink-0 overflow-hidden bg-stone-100${unavailable ? " grayscale" : ""}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={item.imageUrl}
            alt={item.name}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        </div>
      )}

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-baseline gap-2">
            <h3 className="text-sm font-bold text-stone-900">{item.name}</h3>
            {unavailable && (
              <span className="font-mono text-[10px] font-semibold uppercase text-stone-400">
                Ausverkauft
              </span>
            )}
          </div>
          <span className="shrink-0 font-mono text-sm font-semibold tabular-nums text-stone-900">
            {formatPrice(item.price)}&nbsp;&euro;
          </span>
        </div>
        {item.description && (
          <p className="mt-1 line-clamp-2 text-xs text-stone-500">
            {item.description}
          </p>
        )}
        {(item.dietaryTags.length > 0 || item.allergens.length > 0) && (
          <div className="mt-2 flex flex-wrap gap-1">
            {item.dietaryTags.map((tag) => (
              <span
                key={tag}
                className="bg-stone-100 px-1.5 py-0 font-mono text-[10px] text-stone-600"
              >
                {tag}
              </span>
            ))}
            {item.allergens.map((allergen) => (
              <span
                key={allergen}
                className="border border-stone-200 px-1.5 py-0 font-mono text-[10px] text-stone-500"
              >
                {allergen}
              </span>
            ))}
          </div>
        )}

        {/* Add / quantity controls */}
        {orderingEnabled && !unavailable && (
          <div className="mt-3">
            {quantity === 0 ? (
              <button
                className="bg-stone-900 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-white hover:bg-stone-800"
                onClick={onAdd}
              >
                Hinzufügen
              </button>
            ) : (
              <div className="inline-flex items-center gap-2">
                <button
                  className="flex h-7 w-7 items-center justify-center border border-stone-300 bg-white text-stone-700 hover:bg-stone-50"
                  onClick={onDecrement}
                >
                  &minus;
                </button>
                <span className="w-5 text-center font-mono text-sm font-bold tabular-nums">
                  {quantity}
                </span>
                <button
                  className="flex h-7 w-7 items-center justify-center border border-stone-300 bg-white text-stone-700 hover:bg-stone-50"
                  onClick={onIncrement}
                >
                  +
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
