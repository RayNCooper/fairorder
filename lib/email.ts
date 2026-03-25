// ── Email Provider Abstraction ──
// Supports 3 providers via EMAIL_PROVIDER env var:
//   "plunk"   — Plunk ESP API (default in production)
//   "smtp"    — Any SMTP server via nodemailer (self-hosting)
//   "console" — Logs to console (default in development)
//
// Templates use @react-email/components (see emails/ directory).

import type { Transporter } from "nodemailer";
import { render } from "@react-email/components";
import { createElement } from "react";
import MagicLinkEmail from "@/emails/magic-link";
import OrderReadyEmail from "@/emails/order-ready";

const PLUNK_BASE_URL = "https://next-api.useplunk.com";

interface SendEmailOptions {
  to: string;
  subject: string;
  body: string;
}

// ── Provider implementations ──

async function sendViaPlunk({ to, subject, body }: SendEmailOptions): Promise<boolean> {
  const apiKey = process.env.PLUNK_API_KEY;
  if (!apiKey) {
    console.error("PLUNK_API_KEY is not set");
    return false;
  }

  try {
    const res = await fetch(`${PLUNK_BASE_URL}/v1/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ to, subject, body, from: "noreply@fair-order.de" }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "unknown error");
      console.error(`Failed to send email via Plunk (${res.status}): ${text}`);
      return false;
    }
    return true;
  } catch (error) {
    console.error("Failed to send email via Plunk:", error);
    return false;
  }
}

let _smtpTransport: Transporter | null = null;

async function getSmtpTransport(): Promise<Transporter> {
  if (_smtpTransport) return _smtpTransport;

  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT;
  const from = process.env.SMTP_FROM;

  if (!host || !from) {
    throw new Error(
      "SMTP_HOST and SMTP_FROM are required when EMAIL_PROVIDER=smtp. " +
      "Set them in your .env file."
    );
  }

  // Dynamic import so nodemailer is only loaded when SMTP is used
  const nodemailer = await import("nodemailer");
  _smtpTransport = nodemailer.createTransport({
    host,
    port: port ? parseInt(port, 10) : 587,
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS ?? "" }
      : undefined,
  });

  return _smtpTransport;
}

async function sendViaSmtp({ to, subject, body }: SendEmailOptions): Promise<boolean> {
  try {
    const transport = await getSmtpTransport();
    await transport.sendMail({
      from: process.env.SMTP_FROM,
      to,
      subject,
      html: body,
    });
    return true;
  } catch (error) {
    console.error("Failed to send email via SMTP:", error);
    return false;
  }
}

function sendViaConsole({ to, subject, body }: SendEmailOptions): boolean {
  console.log(`\n📧 [EMAIL] To: ${to}\n   Subject: ${subject}\n   Body: ${body.substring(0, 200)}...\n`);
  return true;
}

// ── Public API ──

function getProvider(): string {
  const provider = process.env.EMAIL_PROVIDER;
  if (provider) return provider;
  // Default: console in dev, plunk in production
  return process.env.NODE_ENV === "production" ? "plunk" : "console";
}

export async function sendEmail(options: SendEmailOptions): Promise<boolean> {
  const provider = getProvider();

  switch (provider) {
    case "plunk":
      return sendViaPlunk(options);
    case "smtp":
      return sendViaSmtp(options);
    case "console":
      return sendViaConsole(options);
    default:
      throw new Error(
        `Unknown EMAIL_PROVIDER: "${provider}". Use "plunk", "smtp", or "console".`
      );
  }
}

// ── Email builders (react-email templates) ──

function getBaseUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "https://app.fair-order.de";
}

export async function buildMagicLinkEmail(
  magicLink: string
): Promise<{ subject: string; body: string }> {
  const html = await render(
    createElement(MagicLinkEmail, { magicLink, baseUrl: getBaseUrl() })
  );

  return {
    subject: "Dein Login-Link für FairOrder",
    body: html,
  };
}

export async function buildOrderReadyEmail(
  orderNumber: number,
  customerName: string,
  locationName: string
): Promise<{ subject: string; body: string }> {
  const html = await render(
    createElement(OrderReadyEmail, {
      orderNumber,
      customerName,
      locationName,
      baseUrl: getBaseUrl(),
    })
  );

  return {
    subject: `Deine Bestellung #${orderNumber} ist bereit!`,
    body: html,
  };
}
