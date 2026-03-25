import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

const SLOT_INTERVAL_MINUTES = 15;
const MAX_SLOTS = 32; // ~8 hours of 15-min slots

interface OperatingHoursDay {
  open: string;
  close: string;
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

export async function GET(request: NextRequest) {
  const locationId = request.nextUrl.searchParams.get("locationId");

  if (!locationId) {
    return NextResponse.json(
      { error: "locationId ist erforderlich." },
      { status: 400 }
    );
  }

  const location = await db.location.findUnique({
    where: { id: locationId },
  });

  if (!location || !location.isPublic) {
    return NextResponse.json(
      { error: "Standort nicht gefunden." },
      { status: 404 }
    );
  }

  if (!location.orderingEnabled) {
    return NextResponse.json({ slots: [] });
  }

  const timezone = location.timezone ?? "Europe/Berlin";
  const operatingHours = location.operatingHours as Record<
    string,
    OperatingHoursDay[] | null
  > | null;

  // Get current time in location's timezone
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "long",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  });
  const parts = formatter.formatToParts(now);
  const weekday =
    parts.find((p) => p.type === "weekday")?.value?.toLowerCase() ?? "";
  const dayIndex = DAY_KEYS.indexOf(weekday as (typeof DAY_KEYS)[number]);
  const currentHour = parseInt(
    parts.find((p) => p.type === "hour")?.value ?? "0",
    10
  );
  const currentMinute = parseInt(
    parts.find((p) => p.type === "minute")?.value ?? "0",
    10
  );
  const currentMinutes = currentHour * 60 + currentMinute;

  // Earliest pickup: now + lead time
  const leadTimeMinutes = location.orderLeadTimeMinutes;
  const earliestMinutes = currentMinutes + leadTimeMinutes;

  // Get today's operating hours
  const dayKey = DAY_KEYS[dayIndex];
  const todaySlots = operatingHours?.[dayKey];

  if (!todaySlots || todaySlots.length === 0) {
    return NextResponse.json({ slots: [] });
  }

  // Generate time slots within operating hours
  const slots: {
    time: string;
    label: string;
    available: boolean;
    remaining: number | null;
  }[] = [];

  for (const period of todaySlots) {
    const [oh, om] = period.open.split(":").map(Number);
    const [ch, cm] = period.close.split(":").map(Number);
    const openMin = oh * 60 + om;
    const closeMin = ch * 60 + cm;

    // Start from earliest available or period open, whichever is later
    // Round up to next slot interval
    const rawStart = Math.max(earliestMinutes, openMin);
    const startMin =
      Math.ceil(rawStart / SLOT_INTERVAL_MINUTES) * SLOT_INTERVAL_MINUTES;

    for (
      let min = startMin;
      min < closeMin && slots.length < MAX_SLOTS;
      min += SLOT_INTERVAL_MINUTES
    ) {
      const h = Math.floor(min / 60);
      const m = min % 60;
      const timeStr = `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
      slots.push({
        time: timeStr,
        label: `${timeStr} Uhr`,
        available: true, // Will be updated below if slot limits apply
        remaining: null,
      });
    }
  }

  // If no slot capacity limit, all slots are available
  if (!location.maxOrdersPerSlot || slots.length === 0) {
    return NextResponse.json({ slots });
  }

  // Count active orders per slot
  const dateFormatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const dateStr = dateFormatter.format(now); // "YYYY-MM-DD"

  const activeOrders = await db.order.findMany({
    where: {
      locationId,
      status: { notIn: ["COMPLETED", "CANCELLED"] },
      requestedPickupTime: {
        gte: new Date(`${dateStr}T00:00:00`),
        lt: new Date(`${dateStr}T23:59:59`),
      },
    },
    select: { requestedPickupTime: true },
  });

  // Count orders per slot window
  const slotCounts = new Map<string, number>();
  for (const order of activeOrders) {
    const pickupTime = new Date(order.requestedPickupTime);
    const pickupFormatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "numeric",
      minute: "numeric",
      hour12: false,
    });
    const pickupParts = pickupFormatter.formatToParts(pickupTime);
    const pickupH = parseInt(
      pickupParts.find((p) => p.type === "hour")?.value ?? "0",
      10
    );
    const pickupM = parseInt(
      pickupParts.find((p) => p.type === "minute")?.value ?? "0",
      10
    );
    const pickupMin = pickupH * 60 + pickupM;

    // Find which slot this falls into
    const slotMin =
      Math.floor(pickupMin / SLOT_INTERVAL_MINUTES) * SLOT_INTERVAL_MINUTES;
    const slotH = Math.floor(slotMin / 60);
    const slotM = slotMin % 60;
    const slotKey = `${slotH.toString().padStart(2, "0")}:${slotM.toString().padStart(2, "0")}`;
    slotCounts.set(slotKey, (slotCounts.get(slotKey) ?? 0) + 1);
  }

  // Update slot availability
  const maxPerSlot = location.maxOrdersPerSlot;
  for (const slot of slots) {
    const count = slotCounts.get(slot.time) ?? 0;
    slot.remaining = Math.max(0, maxPerSlot - count);
    slot.available = slot.remaining > 0;
  }

  return NextResponse.json({ slots });
}
