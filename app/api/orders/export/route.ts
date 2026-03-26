import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { error: "Nicht autorisiert." },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(request.url);
  const locationId = searchParams.get("locationId");
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  if (!locationId) {
    return NextResponse.json(
      { error: "locationId ist erforderlich." },
      { status: 400 }
    );
  }

  // Verify operator owns this location
  const location = await db.location.findFirst({
    where: { id: locationId, userId: session.userId },
    select: { id: true, name: true, companyName: true, vatId: true },
  });

  if (!location) {
    return NextResponse.json(
      { error: "Standort nicht gefunden." },
      { status: 404 }
    );
  }

  const dateFilter: Record<string, Date> = {};
  if (from) {
    const d = new Date(from);
    if (isNaN(d.getTime())) {
      return NextResponse.json({ error: "Ung\u00fcltiges Startdatum." }, { status: 400 });
    }
    dateFilter.gte = d;
  }
  if (to) {
    const d = new Date(to);
    if (isNaN(d.getTime())) {
      return NextResponse.json({ error: "Ung\u00fcltiges Enddatum." }, { status: 400 });
    }
    dateFilter.lte = d;
  }

  const orders = await db.order.findMany({
    where: {
      locationId,
      createdAt: Object.keys(dateFilter).length > 0 ? dateFilter : undefined,
    },
    include: {
      items: {
        include: {
          menuItem: { select: { name: true } },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  if (orders.length === 0) {
    return NextResponse.json(
      { error: "Keine Bestellungen im gew\u00e4hlten Zeitraum." },
      { status: 404 }
    );
  }

  // Sanitize CSV cell to prevent formula injection in spreadsheet apps
  function csvSafe(value: string): string {
    const escaped = value.replace(/"/g, '""');
    if (/^[=+\-@\t\r]/.test(escaped)) {
      return `"'${escaped}"`;
    }
    return `"${escaped}"`;
  }

  // Build CSV
  const headers = [
    "Bestellnr",
    "Datum",
    "Artikel",
    "Menge",
    "Einzelpreis (brutto)",
    "MwSt.-Satz",
    "Netto (Cent)",
    "MwSt. (Cent)",
    "Brutto (Cent)",
    "Zahlungsart",
    "Zahlungsstatus",
    "Kunde",
  ];

  const rows: string[] = [headers.join(";")];

  for (const order of orders) {
    const date = new Date(order.createdAt).toLocaleDateString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
    const paymentMethod = order.paymentMethod === "stripe" ? "Karte" : "Bar";

    for (const item of order.items) {
      const grossCents = Math.round(Number(item.unitPrice) * 100) * item.quantity;
      rows.push(
        [
          order.orderNumber,
          date,
          csvSafe(item.menuItem.name),
          item.quantity,
          Number(item.unitPrice).toFixed(2).replace(".", ","),
          `${Number(item.vatRate)}%`,
          item.netAmountCents,
          item.vatAmountCents,
          grossCents,
          paymentMethod,
          order.paymentStatus,
          csvSafe(order.customerName ?? ""),
        ].join(";")
      );
    }
  }

  const csv = rows.join("\n");
  const safeName = location.name.replace(/[^a-zA-Z0-9äöüÄÖÜß\s-]/g, "").replace(/\s+/g, "-").toLowerCase();
  const filename = `bestellungen-${safeName}-${from ?? "alle"}-${to ?? "alle"}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
