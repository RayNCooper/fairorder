import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Nicht eingeloggt." }, { status: 401 });
  }

  const { id } = await params;

  try {
    // Verify ownership
    const location = await db.location.findUnique({
      where: { id },
      select: { userId: true },
    });

    if (!location) {
      return NextResponse.json(
        { error: "Standort nicht gefunden." },
        { status: 404 }
      );
    }

    if (location.userId !== session.user.id) {
      return NextResponse.json(
        { error: "Keine Berechtigung." },
        { status: 403 }
      );
    }

    const body = await request.json();

    // Validate and sanitize input
    const updateData: Record<string, unknown> = {};

    if (body.name !== undefined) {
      if (typeof body.name !== "string" || body.name.trim().length < 2) {
        return NextResponse.json(
          { error: "Name muss mindestens 2 Zeichen lang sein." },
          { status: 400 }
        );
      }
      updateData.name = body.name.trim();
    }

    if (body.operatingHours !== undefined) {
      if (body.operatingHours !== null) {
        // Validate operatingHours structure
        if (typeof body.operatingHours !== "object" || Array.isArray(body.operatingHours)) {
          return NextResponse.json(
            { error: "operatingHours muss ein Objekt sein." },
            { status: 400 }
          );
        }
        const validDays = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
        const TIME_RE = /^\d{2}:\d{2}$/;
        const parseTime = (t: string): number => {
          const [h, m] = t.split(":").map(Number);
          return h * 60 + m;
        };
        for (const [day, slots] of Object.entries(body.operatingHours)) {
          if (!validDays.includes(day)) continue;
          if (slots === null) continue;
          if (!Array.isArray(slots)) {
            return NextResponse.json(
              { error: `${day}: Öffnungszeiten müssen ein Array sein.` },
              { status: 400 }
            );
          }
          for (const slot of slots as Array<{ open?: string; close?: string }>) {
            if (!slot.open || !slot.close) {
              return NextResponse.json(
                { error: `${day}: Jeder Zeitraum braucht Öffnungs- und Schließzeit.` },
                { status: 400 }
              );
            }
            if (!TIME_RE.test(slot.open) || !TIME_RE.test(slot.close)) {
              return NextResponse.json(
                { error: `${day}: Zeitformat muss HH:MM sein.` },
                { status: 400 }
              );
            }
            const openMin = parseTime(slot.open);
            const closeMin = parseTime(slot.close);
            if (closeMin <= openMin) {
              return NextResponse.json(
                { error: `${day}: Schließzeit muss nach Öffnungszeit liegen.` },
                { status: 400 }
              );
            }
          }
          // Check for overlaps
          const sortedSlots = [...(slots as Array<{ open: string; close: string }>)].sort(
            (a, b) => parseTime(a.open) - parseTime(b.open)
          );
          for (let i = 1; i < sortedSlots.length; i++) {
            if (parseTime(sortedSlots[i].open) < parseTime(sortedSlots[i - 1].close)) {
              return NextResponse.json(
                { error: `${day}: Zeiträume dürfen sich nicht überschneiden.` },
                { status: 400 }
              );
            }
          }
        }
      }
      updateData.operatingHours = body.operatingHours;
    }

    if (body.slotIntervalMinutes !== undefined) {
      const interval = Number(body.slotIntervalMinutes);
      if (![5, 10, 15, 20, 25, 30].includes(interval)) {
        return NextResponse.json(
          { error: "Zeitfenster muss 5, 10, 15, 20, 25 oder 30 Minuten sein." },
          { status: 400 }
        );
      }
      updateData.slotIntervalMinutes = interval;
    }

    if (body.orderingEnabled !== undefined) {
      if (typeof body.orderingEnabled !== "boolean") {
        return NextResponse.json(
          { error: "orderingEnabled muss ein Boolean sein." },
          { status: 400 }
        );
      }
      updateData.orderingEnabled = body.orderingEnabled;
      // Disabling preorders also disables payment
      if (!body.orderingEnabled) {
        updateData.paymentEnabled = false;
      }
    }

    if (body.maxActiveOrders !== undefined) {
      const max = Number(body.maxActiveOrders);
      if (isNaN(max) || max < 1 || max > 999) {
        return NextResponse.json(
          { error: "Maximale Bestellungen muss zwischen 1 und 999 liegen." },
          { status: 400 }
        );
      }
      updateData.maxActiveOrders = max;
    }

    if (body.maxOrdersPerSlot !== undefined) {
      if (body.maxOrdersPerSlot === null) {
        updateData.maxOrdersPerSlot = null;
      } else {
        const max = Number(body.maxOrdersPerSlot);
        if (isNaN(max) || max < 1 || max > 999) {
          return NextResponse.json(
            { error: "Max. Bestellungen pro Zeitfenster muss zwischen 1 und 999 liegen." },
            { status: 400 }
          );
        }
        updateData.maxOrdersPerSlot = max;
      }
    }

    if (body.paymentEnabled !== undefined) {
      if (typeof body.paymentEnabled !== "boolean") {
        return NextResponse.json(
          { error: "paymentEnabled muss ein Boolean sein." },
          { status: 400 }
        );
      }
      updateData.paymentEnabled = body.paymentEnabled;
    }

    if (body.acceptedPayments !== undefined) {
      if (
        !Array.isArray(body.acceptedPayments) ||
        !body.acceptedPayments.every(
          (p: unknown) => typeof p === "string" && ["cash", "stripe", "paypal"].includes(p as string)
        )
      ) {
        return NextResponse.json(
          { error: "acceptedPayments muss ein Array aus 'cash', 'stripe' und/oder 'paypal' sein." },
          { status: 400 }
        );
      }
      updateData.acceptedPayments = body.acceptedPayments;
    }

    // Legal info fields (all optional strings, max 500 chars)
    const legalFields = ["companyName", "address", "phone", "vatId", "responsiblePerson"] as const;
    for (const field of legalFields) {
      if (body[field] !== undefined) {
        if (typeof body[field] === "string" && body[field].length > 500) {
          return NextResponse.json(
            { error: `${field} darf maximal 500 Zeichen lang sein.` },
            { status: 400 }
          );
        }
        updateData[field] = typeof body[field] === "string" ? body[field] : null;
      }
    }

    const updated = await db.location.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ location: updated });
  } catch {
    return NextResponse.json(
      { error: "Ein Fehler ist aufgetreten." },
      { status: 500 }
    );
  }
}
