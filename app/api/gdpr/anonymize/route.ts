import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";

// GDPR anonymization endpoint
// Nulls out personal data (customerName, customerEmail) while retaining
// financial records for GoBD 10-year retention compliance.

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { error: "Nicht autorisiert." },
      { status: 401 }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Ung\u00fcltige Anfrage." },
      { status: 400 }
    );
  }

  const { email, locationId } = body;

  if (!email || typeof email !== "string") {
    return NextResponse.json(
      { error: "E-Mail-Adresse ist erforderlich." },
      { status: 400 }
    );
  }

  if (!locationId || typeof locationId !== "string") {
    return NextResponse.json(
      { error: "Standort-ID ist erforderlich." },
      { status: 400 }
    );
  }

  // Verify operator owns this location
  const location = await db.location.findFirst({
    where: { id: locationId, userId: session.userId },
    select: { id: true },
  });

  if (!location) {
    return NextResponse.json(
      { error: "Standort nicht gefunden." },
      { status: 404 }
    );
  }

  // Anonymize: null out personal fields, retain financial data
  // Use case-insensitive match since emails are stored as-is
  const result = await db.order.updateMany({
    where: {
      locationId,
      customerEmail: { equals: email.trim(), mode: "insensitive" },
    },
    data: {
      customerName: "Anonymisiert",
      customerEmail: null,
      customerNote: null,
    },
  });

  return NextResponse.json({
    anonymized: result.count,
    message: `${result.count} Bestellung(en) anonymisiert. Finanzdaten bleiben f\u00fcr die gesetzliche Aufbewahrungsfrist erhalten.`,
  });
}
