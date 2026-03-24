// ── Menu Crawler ──
// Fetches and extracts text content from a URL for menu extraction.
// Uses cheerio for HTML parsing — no headless browser needed.

import { extractMenuFromText, type ExtractionResult } from "./menu-extraction";

const FETCH_TIMEOUT_MS = 15_000;
const MAX_BODY_SIZE = 5 * 1024 * 1024; // 5 MB
const USER_AGENT = "FairOrder-MenuCrawler/1.0 (+https://fair-order.de)";

// Private IP ranges to block (SSRF protection)
const BLOCKED_HOSTS = [
  /^localhost$/i,
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^0\./,
  /^\[::1\]$/,
  /^169\.254\./, // link-local
];

function isBlockedHost(hostname: string): boolean {
  return BLOCKED_HOSTS.some((pattern) => pattern.test(hostname));
}

export function validateUrl(urlString: string): URL {
  let url: URL;
  try {
    url = new URL(urlString);
  } catch {
    throw new Error("Ungültige URL.");
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("Nur HTTP(S)-URLs werden unterstützt.");
  }

  if (isBlockedHost(url.hostname)) {
    throw new Error("Diese URL ist nicht erlaubt.");
  }

  return url;
}

export async function crawlMenuFromUrl(
  urlString: string
): Promise<{ text: string; title: string }> {
  const url = validateUrl(urlString);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    // Manual redirect handling to validate each redirect target against SSRF blocklist
    let currentUrl = url.toString();
    let res: Response;
    let redirectCount = 0;
    const MAX_REDIRECTS = 5;

    while (true) {
      res = await fetch(currentUrl, {
        signal: controller.signal,
        headers: {
          "User-Agent": USER_AGENT,
          Accept: "text/html",
        },
        redirect: "manual",
      });

      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get("location");
        if (!location || ++redirectCount > MAX_REDIRECTS) {
          throw new Error("Zu viele Weiterleitungen.");
        }
        // Resolve relative redirects against the current URL
        const redirectUrl = new URL(location, currentUrl);
        if (isBlockedHost(redirectUrl.hostname)) {
          throw new Error("Diese URL ist nicht erlaubt.");
        }
        if (redirectUrl.protocol !== "https:" && redirectUrl.protocol !== "http:") {
          throw new Error("Nur HTTP(S)-URLs werden unterstützt.");
        }
        currentUrl = redirectUrl.toString();
        continue;
      }
      break;
    }

    if (!res.ok) {
      throw new Error(`Website hat mit Status ${res.status} geantwortet.`);
    }

    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html") && !contentType.includes("text/plain")) {
      throw new Error("Nur HTML-Seiten werden unterstützt.");
    }

    // Read body with size limit
    const reader = res.body?.getReader();
    if (!reader) throw new Error("Keine Antwort erhalten.");

    const chunks: Uint8Array[] = [];
    let totalSize = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalSize += value.byteLength;
      if (totalSize > MAX_BODY_SIZE) {
        reader.cancel();
        throw new Error("Seite ist zu groß.");
      }
      chunks.push(value);
    }

    const html = new TextDecoder().decode(
      Buffer.concat(chunks.map((c) => Buffer.from(c)))
    );

    // Parse with cheerio
    const { load } = await import("cheerio");
    const $ = load(html);

    // Remove noise
    $("script, style, noscript, iframe, svg, nav, footer, header").remove();

    const title = $("title").text().trim() || url.hostname;
    const bodyText = $("body").text();

    // Clean up whitespace
    const text = bodyText
      .replace(/\s+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    if (!text || text.length < 20) {
      throw new Error(
        "Keine Textinhalte gefunden. Die Seite wird möglicherweise mit JavaScript geladen. Versuche ein Bild."
      );
    }

    return { text: text.slice(0, 20000), title };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Website nicht erreichbar (Zeitüberschreitung).");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export async function extractMenuFromUrl(
  urlString: string
): Promise<ExtractionResult> {
  const { text } = await crawlMenuFromUrl(urlString);
  return extractMenuFromText(text);
}
