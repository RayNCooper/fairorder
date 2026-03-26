// ── Menu Extraction Provider Abstraction ──
// Supports 2 providers via MENU_EXTRACTION_PROVIDER env var:
//   "gemini"  — Google Gemini via Vercel AI SDK (free tier, recommended)
//   "console" — Logs to console, returns mock data (dev)

import { z } from "zod";

export interface ExtractedMenuItem {
  name: string;
  description?: string;
  price?: number;
  category?: string;
  taxRate?: number;
  allergens?: string[];
  dietaryTags?: string[];
}

export interface ExtractionResult {
  items: ExtractedMenuItem[];
  confidence: number; // 0-1
  rawText?: string;
}

const menuItemSchema = z.object({
  name: z.string().describe("Name des Gerichts"),
  description: z.string().optional().describe("Kurze Beschreibung"),
  price: z.number().optional().describe("Preis in EUR (z.B. 8.50)"),
  category: z
    .string()
    .optional()
    .describe('Kategorie (z.B. "Vorspeisen", "Hauptgerichte", "Desserts", "Getränke")'),
  taxRate: z
    .number()
    .optional()
    .describe("MwSt-Satz: 7 für Speisen (Standard), 19 für Getränke. Nur Getränke haben 19%."),
  allergens: z
    .array(z.string())
    .optional()
    .describe('Allergene (z.B. ["Gluten", "Laktose"])'),
  dietaryTags: z
    .array(z.string())
    .optional()
    .describe('Ernährungshinweise (z.B. ["Vegan", "Vegetarisch"])'),
});

const extractionSchema = z.object({
  items: z.array(menuItemSchema).describe("Alle erkannten Gerichte aus der Speisekarte"),
});

const SYSTEM_PROMPT = `Du bist ein Speisekarten-Parser. Extrahiere alle Gerichte aus dem gegebenen Inhalt.
Wenn du keine Gerichte erkennst, gib ein leeres Array zurück.
Setze taxRate auf 7 für Speisen (Standard) und 19 für Getränke (Softdrinks, Kaffee, Bier, Wein, Saft, etc.).`;

// ── Gemini provider ──

async function extractWithGemini(
  imageBuffer: Buffer,
  mimeType: string
): Promise<ExtractionResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY is required when MENU_EXTRACTION_PROVIDER=gemini."
    );
  }

  const { createGoogleGenerativeAI } = await import("@ai-sdk/google");
  const { generateObject } = await import("ai");
  const google = createGoogleGenerativeAI({ apiKey });

  const { object, usage } = await generateObject({
    model: google("gemini-2.5-flash"),
    schema: extractionSchema,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: "Extrahiere alle Gerichte aus diesem Bild." },
          {
            type: "image",
            image: imageBuffer,
            mediaType: mimeType as "image/jpeg" | "image/png" | "image/webp",
          },
        ],
      },
    ],
  });

  const items = object.items.filter((i) => i.name.trim());
  const withPrices = items.filter((i) => i.price !== undefined).length;
  const confidence =
    items.length > 0
      ? Math.min(0.3 + (withPrices / items.length) * 0.7, 1)
      : 0;

  return {
    items,
    confidence,
    rawText: `Structured output (${usage?.totalTokens ?? "?"} tokens)`,
  };
}

async function extractTextWithGemini(
  textContent: string
): Promise<ExtractionResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY is required when MENU_EXTRACTION_PROVIDER=gemini."
    );
  }

  const { createGoogleGenerativeAI } = await import("@ai-sdk/google");
  const { generateObject } = await import("ai");
  const google = createGoogleGenerativeAI({ apiKey });

  const { object, usage } = await generateObject({
    model: google("gemini-2.5-flash"),
    schema: extractionSchema,
    system: SYSTEM_PROMPT,
    prompt: `Hier ist der Text der Speisekarte:\n\n${textContent.slice(0, 15000)}`,
  });

  const items = object.items.filter((i) => i.name.trim());
  const withPrices = items.filter((i) => i.price !== undefined).length;
  const confidence =
    items.length > 0
      ? Math.min(0.3 + (withPrices / items.length) * 0.7, 1)
      : 0;

  return {
    items,
    confidence,
    rawText: `Structured output (${usage?.totalTokens ?? "?"} tokens)`,
  };
}

// ── Console provider (dev) ──

function extractWithConsole(mimeType: string): ExtractionResult {
  console.log(
    `\n[MENU EXTRACTION] Would extract from ${mimeType} image. Returning mock data.\n`
  );
  return {
    items: [
      { name: "Currywurst mit Pommes", price: 6.5, category: "Hauptgerichte" },
      { name: "Caesar Salad", price: 8.9, category: "Vorspeisen", dietaryTags: ["Vegetarisch"] },
      { name: "Apfelschorle", price: 2.5, category: "Getränke" },
    ],
    confidence: 1,
    rawText: "Mock extraction",
  };
}

// ── Public API ──

function getProvider(): string {
  const provider = process.env.MENU_EXTRACTION_PROVIDER;
  if (provider) return provider;
  return process.env.NODE_ENV === "production" ? "gemini" : "console";
}

export async function extractMenuFromImage(
  imageBuffer: Buffer,
  mimeType: string
): Promise<ExtractionResult> {
  const provider = getProvider();

  switch (provider) {
    case "gemini":
      return extractWithGemini(imageBuffer, mimeType);
    case "console":
      return extractWithConsole(mimeType);
    default:
      throw new Error(
        `Unknown MENU_EXTRACTION_PROVIDER: "${provider}". Use "gemini" or "console".`
      );
  }
}

export async function extractMenuFromText(
  textContent: string
): Promise<ExtractionResult> {
  const provider = getProvider();

  switch (provider) {
    case "gemini":
      return extractTextWithGemini(textContent);
    case "console": {
      console.log(
        `\n[MENU EXTRACTION] Would extract from text (${textContent.length} chars). Returning mock data.\n`
      );
      return extractWithConsole("text/plain");
    }
    default:
      throw new Error(
        `Unknown MENU_EXTRACTION_PROVIDER: "${provider}". Use "gemini" or "console".`
      );
  }
}
