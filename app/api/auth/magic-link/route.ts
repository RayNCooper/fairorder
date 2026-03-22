import { NextRequest, NextResponse } from "next/server";
import { createMagicLinkToken } from "@/lib/magic-link";
import { sendEmail, buildMagicLinkEmail } from "@/lib/email";

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email || typeof email !== "string" || !email.includes("@")) {
      return NextResponse.json(
        { error: "Bitte gib eine gültige E-Mail-Adresse ein." },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();

    const token = await createMagicLinkToken(normalizedEmail);

    if (token === null) {
      return NextResponse.json(
        { error: "Zu viele Anfragen. Bitte warte ein paar Minuten." },
        { status: 429 }
      );
    }

    const baseUrl = process.env.MAGIC_LINK_BASE_URL ?? "http://localhost:3000";
    const magicLink = `${baseUrl}/verify-email?token=${token}`;

    const { subject, body } = buildMagicLinkEmail(magicLink);
    const sent = await sendEmail({ to: normalizedEmail, subject, body });

    if (!sent) {
      return NextResponse.json(
        { error: "E-Mail konnte nicht gesendet werden. Bitte versuche es erneut." },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Ein Fehler ist aufgetreten." },
      { status: 500 }
    );
  }
}
