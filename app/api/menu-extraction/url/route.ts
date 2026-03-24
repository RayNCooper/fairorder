import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { extractMenuFromUrl } from "@/lib/menu-crawler";

// Simple in-memory rate limiting (resets on restart)
const rateLimits = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 60_000;

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const entry = rateLimits.get(userId);
  if (!entry || now > entry.resetAt) {
    rateLimits.set(userId, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { error: "Nicht eingeloggt." },
      { status: 401 }
    );
  }

  if (!checkRateLimit(session.user.id)) {
    return NextResponse.json(
      { error: "Zu viele Anfragen. Bitte warte einen Moment." },
      { status: 429 }
    );
  }

  try {
    const body = await request.json();
    const { url } = body;

    if (!url || typeof url !== "string") {
      return NextResponse.json(
        { error: "URL ist erforderlich." },
        { status: 400 }
      );
    }

    const result = await extractMenuFromUrl(url);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Menu extraction from URL failed:", error);
    const message =
      error instanceof Error ? error.message : "Erkennung fehlgeschlagen.";
    return NextResponse.json(
      { error: message, items: [], confidence: 0 },
      { status: 500 }
    );
  }
}
