import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { db } from "@/lib/db";
import { calculateLineItemVat } from "@/lib/vat";
import { sendEmail, buildOrderConfirmationEmail } from "@/lib/email";

function generateOrderToken(): string {
  return crypto.randomBytes(9).toString("base64url");
}

const MAX_CUSTOMER_NAME_LENGTH = 100;
const MAX_CUSTOMER_NOTE_LENGTH = 500;
const MAX_ITEMS = 50;
const MAX_QUANTITY = 99;

export async function POST(request: NextRequest) {
  // Parse JSON body — return 400 for malformed requests
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Ungültige Anfrage." },
      { status: 400 }
    );
  }

  try {
    const { locationId, customerName, customerNote, customerEmail, requestedPickupTime: clientPickupTime, items } = body;

    // --- Validate required fields ---

    if (!locationId || typeof locationId !== "string") {
      return NextResponse.json(
        { error: "Standort-ID ist erforderlich." },
        { status: 400 }
      );
    }

    if (!customerName || typeof customerName !== "string" || !String(customerName).trim()) {
      return NextResponse.json(
        { error: "Bitte gib deinen Namen an." },
        { status: 400 }
      );
    }

    if (String(customerName).trim().length > MAX_CUSTOMER_NAME_LENGTH) {
      return NextResponse.json(
        { error: `Name darf maximal ${MAX_CUSTOMER_NAME_LENGTH} Zeichen lang sein.` },
        { status: 400 }
      );
    }

    if (customerNote && typeof customerNote === "string" && customerNote.trim().length > MAX_CUSTOMER_NOTE_LENGTH) {
      return NextResponse.json(
        { error: `Hinweis darf maximal ${MAX_CUSTOMER_NOTE_LENGTH} Zeichen lang sein.` },
        { status: 400 }
      );
    }

    // Validate optional customer email
    if (customerEmail && typeof customerEmail === "string") {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(customerEmail.trim())) {
        return NextResponse.json(
          { error: "Ungültige E-Mail-Adresse." },
          { status: 400 }
        );
      }
    }

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "Die Bestellung muss mindestens einen Artikel enthalten." },
        { status: 400 }
      );
    }

    if (items.length > MAX_ITEMS) {
      return NextResponse.json(
        { error: `Maximal ${MAX_ITEMS} verschiedene Artikel pro Bestellung.` },
        { status: 400 }
      );
    }

    // --- Validate & deduplicate items ---

    const deduped = new Map<string, number>();
    for (const item of items) {
      if (!item.menuItemId || typeof item.menuItemId !== "string") {
        return NextResponse.json(
          { error: "Ungültige Artikel-ID." },
          { status: 400 }
        );
      }
      if (!item.quantity || typeof item.quantity !== "number" || item.quantity < 1) {
        return NextResponse.json(
          { error: "Menge muss mindestens 1 sein." },
          { status: 400 }
        );
      }
      if (item.quantity > MAX_QUANTITY) {
        return NextResponse.json(
          { error: `Menge darf maximal ${MAX_QUANTITY} sein.` },
          { status: 400 }
        );
      }
      deduped.set(
        item.menuItemId,
        (deduped.get(item.menuItemId) ?? 0) + item.quantity
      );
    }

    // --- Validate location ---

    const location = await db.location.findUnique({
      where: { id: locationId as string },
    });

    if (!location || !location.isPublic) {
      return NextResponse.json(
        { error: "Standort nicht gefunden." },
        { status: 404 }
      );
    }

    if (!location.orderingEnabled) {
      return NextResponse.json(
        { error: "Dieser Standort nimmt derzeit keine Bestellungen an." },
        { status: 403 }
      );
    }

    // --- Validate menu items ---

    const menuItemIds = [...deduped.keys()];

    const menuItems = await db.menuItem.findMany({
      where: {
        id: { in: menuItemIds },
        locationId: locationId as string,
      },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const menuItemMap = new Map<string, any>(menuItems.map((mi: any) => [mi.id, mi]));

    for (const [menuItemId] of deduped) {
      const menuItem = menuItemMap.get(menuItemId);

      if (!menuItem) {
        return NextResponse.json(
          { error: `Artikel wurde nicht gefunden oder gehört nicht zu diesem Standort.` },
          { status: 400 }
        );
      }

      if (!menuItem.isAvailable) {
        return NextResponse.json(
          { error: `„${menuItem.name}" ist derzeit nicht verfügbar.` },
          { status: 400 }
        );
      }
    }

    // --- Create order inside a transaction (atomic order number + maxActiveOrders check) ---

    const order = await db.$transaction(async (tx) => {
      const activeOrderCount = await tx.order.count({
        where: {
          locationId: locationId as string,
          status: { in: ["PENDING", "PREPARING", "READY"] },
        },
      });

      if (activeOrderCount >= location.maxActiveOrders) {
        throw new Error("MAX_ACTIVE_ORDERS");
      }

      const lastOrder = await tx.order.findFirst({
        where: { locationId: locationId as string },
        orderBy: { orderNumber: "desc" },
        select: { orderNumber: true },
      });

      const orderNumber = (lastOrder?.orderNumber ?? 0) + 1;

      // Use client-provided pickup time or auto-calculate
      let requestedPickupTime: Date;
      if (clientPickupTime && typeof clientPickupTime === "string") {
        const parsed = new Date(clientPickupTime);
        if (isNaN(parsed.getTime())) {
          throw new Error("INVALID_PICKUP_TIME");
        }
        // Allow 5 min buffer for clock skew
        const minTime = new Date(Date.now() + (location.orderLeadTimeMinutes - 5) * 60 * 1000);
        if (parsed < minTime) {
          throw new Error("PICKUP_TIME_TOO_EARLY");
        }
        // Check slot capacity if maxOrdersPerSlot is set
        if (location.maxOrdersPerSlot) {
          const interval = location.slotIntervalMinutes ?? 15;
          const slotStart = new Date(parsed);
          slotStart.setMinutes(Math.floor(slotStart.getMinutes() / interval) * interval, 0, 0);
          const slotEnd = new Date(slotStart.getTime() + interval * 60 * 1000);

          const slotCount = await tx.order.count({
            where: {
              locationId: locationId as string,
              status: { notIn: ["COMPLETED", "CANCELLED"] },
              requestedPickupTime: { gte: slotStart, lt: slotEnd },
            },
          });

          if (slotCount >= location.maxOrdersPerSlot) {
            throw new Error("SLOT_FULL");
          }
        }
        requestedPickupTime = parsed;
      } else {
        requestedPickupTime = new Date(
          Date.now() + location.orderLeadTimeMinutes * 60 * 1000
        );
      }

      const token = generateOrderToken();

      return tx.order.create({
        data: {
          locationId: locationId as string,
          token,
          orderNumber,
          customerName: String(customerName).trim(),
          customerNote: customerNote ? String(customerNote).trim() || null : null,
          customerEmail: customerEmail ? String(customerEmail).trim() || null : null,
          requestedPickupTime,
          items: {
            create: [...deduped.entries()].map(([menuItemId, quantity]) => {
              const mi = menuItemMap.get(menuItemId)!;
              const unitPriceCents = Math.round(Number(mi.price) * 100);
              const vatRate = Number(mi.vatRate);
              const { netCents, vatCents } = calculateLineItemVat(unitPriceCents, quantity, vatRate);
              return {
                menuItemId,
                quantity,
                unitPrice: mi.price,
                vatRate: mi.vatRate,
                netAmountCents: netCents,
                vatAmountCents: vatCents,
              };
            }),
          },
        },
        include: {
          items: {
            include: {
              menuItem: {
                select: {
                  name: true,
                  description: true,
                },
              },
            },
          },
        },
      });
    });

    // Send confirmation email (fire-and-forget)
    if (order.customerEmail) {
      const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://app.fair-order.de";
      const orderPageUrl = `${baseUrl}/order/${order.token}`;
      const total = order.items.reduce(
        (sum: number, item: { unitPrice: unknown; quantity: number }) =>
          sum + Number(item.unitPrice) * item.quantity,
        0
      );

      buildOrderConfirmationEmail({
        orderNumber: order.orderNumber,
        customerName: order.customerName,
        locationName: location.name,
        items: order.items.map((item: { menuItem: { name: string }; quantity: number; unitPrice: unknown }) => ({
          name: item.menuItem.name,
          quantity: item.quantity,
          unitPrice: Number(item.unitPrice),
        })),
        total,
        pickupTime: order.requestedPickupTime,
        orderPageUrl,
      })
        .then(({ subject, body: emailBody }) =>
          sendEmail({ to: order.customerEmail!, subject, body: emailBody })
        )
        .catch((err) =>
          console.error(`Failed to send confirmation email for order ${order.id}:`, err)
        );
    }

    // Return filtered response — exclude PII fields from the client response
    const { customerNote: _note, customerEmail: _email, ...safeOrder } = order as Record<string, unknown>;
    return NextResponse.json(safeOrder, { status: 201 });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "MAX_ACTIVE_ORDERS") {
        return NextResponse.json(
          { error: "Maximale Anzahl aktiver Bestellungen erreicht. Bitte versuche es später erneut." },
          { status: 429 }
        );
      }
      if (error.message === "INVALID_PICKUP_TIME") {
        return NextResponse.json(
          { error: "Ungültige Abholzeit." },
          { status: 400 }
        );
      }
      if (error.message === "PICKUP_TIME_TOO_EARLY") {
        return NextResponse.json(
          { error: "Die gewählte Abholzeit liegt zu früh. Bitte wähle einen späteren Zeitpunkt." },
          { status: 400 }
        );
      }
      if (error.message === "SLOT_FULL") {
        return NextResponse.json(
          { error: "Dieses Zeitfenster ist leider voll. Bitte wähle einen anderen Zeitpunkt." },
          { status: 409 }
        );
      }
    }
    return NextResponse.json(
      { error: "Bestellung konnte nicht erstellt werden. Bitte versuche es erneut." },
      { status: 500 }
    );
  }
}
