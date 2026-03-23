"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  IconUpload,
  IconLoader2,
  IconCheck,
  IconAlertTriangle,
  IconTrash,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import Link from "next/link";

// ── Types ──

interface OCRItem {
  name: string;
  price: string;
  confidence: number;
  isCategory: boolean;
}

// ── Image preprocessing for better OCR ──

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = URL.createObjectURL(file);
  });
}

function applyPreprocessing(
  img: HTMLImageElement,
  sx: number,
  sy: number,
  sw: number,
  sh: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement("canvas");
    // Scale up for better OCR
    const scale = Math.max(1, 2000 / Math.max(sw, sh));
    canvas.width = sw * scale;
    canvas.height = sh * scale;
    const ctx = canvas.getContext("2d");
    if (!ctx) return reject(new Error("Canvas not supported"));

    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);

    // Grayscale + adaptive contrast + binarize
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    // First pass: compute local mean for adaptive threshold
    const grayValues = new Float32Array(canvas.width * canvas.height);
    for (let i = 0; i < data.length; i += 4) {
      grayValues[i / 4] =
        0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    }

    // Compute integral image for fast local mean
    const w = canvas.width;
    const h = canvas.height;
    const integral = new Float64Array(w * h);
    for (let y = 0; y < h; y++) {
      let rowSum = 0;
      for (let x = 0; x < w; x++) {
        rowSum += grayValues[y * w + x];
        integral[y * w + x] = rowSum + (y > 0 ? integral[(y - 1) * w + x] : 0);
      }
    }

    // Second pass: adaptive threshold using local 31x31 window
    const radius = 15;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const x0 = Math.max(0, x - radius);
        const y0 = Math.max(0, y - radius);
        const x1 = Math.min(w - 1, x + radius);
        const y1 = Math.min(h - 1, y + radius);
        const area = (x1 - x0 + 1) * (y1 - y0 + 1);
        const sum =
          integral[y1 * w + x1] -
          (x0 > 0 ? integral[y1 * w + (x0 - 1)] : 0) -
          (y0 > 0 ? integral[(y0 - 1) * w + x1] : 0) +
          (x0 > 0 && y0 > 0 ? integral[(y0 - 1) * w + (x0 - 1)] : 0);
        const localMean = sum / area;
        // Binarize: pixel is black if darker than local mean - bias
        const gray = grayValues[y * w + x] < localMean - 10 ? 0 : 255;
        const idx = (y * w + x) * 4;
        data[idx] = data[idx + 1] = data[idx + 2] = gray;
      }
    }
    ctx.putImageData(imageData, 0, 0);

    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("toBlob failed"))),
      "image/png"
    );
  });
}

/** Detect whether image has multiple columns by finding a vertical gap. */
function detectColumns(img: HTMLImageElement): { splits: number[] } {
  const canvas = document.createElement("canvas");
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return { splits: [] };

  ctx.drawImage(img, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  const w = canvas.width;
  const h = canvas.height;

  // For each x column, count dark pixels in the middle 60% of height
  const yStart = Math.floor(h * 0.2);
  const yEnd = Math.floor(h * 0.8);
  const colDensity = new Float32Array(w);

  for (let x = 0; x < w; x++) {
    let darkCount = 0;
    for (let y = yStart; y < yEnd; y++) {
      const idx = (y * w + x) * 4;
      const gray = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
      if (gray < 128) darkCount++;
    }
    colDensity[x] = darkCount / (yEnd - yStart);
  }

  // Look for a gap (low density region) in the middle 40% of the image width
  const searchStart = Math.floor(w * 0.3);
  const searchEnd = Math.floor(w * 0.7);
  let minDensity = 1;
  let minX = -1;

  // Smooth with a window and find minimum
  const windowSize = Math.max(5, Math.floor(w * 0.02));
  for (let x = searchStart; x < searchEnd - windowSize; x++) {
    let avg = 0;
    for (let i = 0; i < windowSize; i++) avg += colDensity[x + i];
    avg /= windowSize;
    if (avg < minDensity) {
      minDensity = avg;
      minX = x + Math.floor(windowSize / 2);
    }
  }

  // Only split if the gap is significantly less dense than the average
  const avgDensity = colDensity.reduce((s, v) => s + v, 0) / w;
  if (minX > 0 && minDensity < avgDensity * 0.3) {
    return { splits: [minX] };
  }

  return { splits: [] };
}

// ── OCR parsing (same logic as next-app speiseplan.ts) ──

const PRICE_REGEX = /(\d+)[,.](\d{2})\s*€?/;

// Strip leading item numbers (e.g. "376 PENNE ALL'ARRABIATA" → "PENNE ALL'ARRABIATA")
const LEADING_NUMBER_REGEX = /^\d{1,4}\s+/;
// Match all prices on a line (menus often have multiple columns merged)
const ALL_PRICES_REGEX = /(\d+)[,.](\d{2})\s*€?/g;

function parseMenuFromOCR(
  text: string,
  wordConfidences?: { text: string; confidence: number }[]
): OCRItem[] {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const items: OCRItem[] = [];

  const getLineConfidence = (line: string): number => {
    if (!wordConfidences?.length) return 85;
    const lineWords = line.toLowerCase().split(/\s+/);
    const matches = wordConfidences.filter((w) =>
      lineWords.some(
        (lw) =>
          w.text.toLowerCase().includes(lw) ||
          lw.includes(w.text.toLowerCase())
      )
    );
    if (matches.length === 0) return 70;
    return matches.reduce((sum, w) => sum + w.confidence, 0) / matches.length;
  };

  for (const rawLine of lines) {
    // Skip lines that are just numbers or very short noise
    if (/^\d+$/.test(rawLine) || rawLine.length < 3) continue;
    // Skip description lines (typically lowercase, no price, short)
    if (rawLine.length < 40 && !PRICE_REGEX.test(rawLine) && rawLine[0] === rawLine[0].toLowerCase() && rawLine !== rawLine.toUpperCase()) continue;

    const confidence = getLineConfidence(rawLine);

    // Strip leading item number
    const line = rawLine.replace(LEADING_NUMBER_REGEX, "");

    const isCategory =
      (line === line.toUpperCase() &&
        line.length > 2 &&
        !PRICE_REGEX.test(line)) ||
      (line.endsWith(":") && !PRICE_REGEX.test(line));

    if (isCategory) {
      items.push({
        name: line.replace(/:$/, "").trim(),
        price: "",
        confidence,
        isCategory: true,
      });
      continue;
    }

    // Find all prices — take the last one as the item's price
    const priceMatches = [...line.matchAll(ALL_PRICES_REGEX)];
    const lastPrice = priceMatches.length > 0 ? priceMatches[priceMatches.length - 1] : null;
    const price = lastPrice ? `${lastPrice[1]},${lastPrice[2]}` : "";
    let name = lastPrice
      ? line.slice(0, lastPrice.index).trim()
      : line.trim();
    // Clean up trailing/leading punctuation and whitespace
    name = name.replace(/[€\s]+$/, "").replace(/^\d{1,4}\s+/, "").trim();

    if (name && name.length >= 3) {
      items.push({ name, price, confidence, isCategory: false });
    }
  }

  return items;
}

// ── Decode ?menu= param ──
// Transfer protocol: the Speiseplan-Generator (external tool) encodes a menu as
// base64url(JSON.stringify(plan)) and links to /register?menu=<encoded>.
// Format: { d: [{ n: string, m: [{ n: string, p?: string }][] }] }
// where d=days, n=name, m=meals, p=price. This is the same encoding used by
// the encodePlanToURL() function in the marketing site's speiseplan lib.

interface MinimalDish {
  n: string;
  p?: string;
}
interface MinimalSubCat {
  n: string;
  m: MinimalDish[];
}
interface MinimalDay {
  n: string;
  m: MinimalDish[];
  c?: MinimalSubCat[];
}

function decodeMenuParam(encoded: string): OCRItem[] {
  try {
    const padded = encoded.replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(escape(atob(padded)));
    const minimal = JSON.parse(json);

    const items: OCRItem[] = [];

    for (const day of minimal.d as MinimalDay[]) {
      for (const dish of day.m) {
        if (dish.n.trim()) {
          items.push({
            name: dish.n,
            price: dish.p ?? "",
            confidence: 100,
            isCategory: false,
          });
        }
      }
      if (day.c) {
        for (const cat of day.c) {
          if (cat.n.trim()) {
            items.push({
              name: cat.n,
              price: "",
              confidence: 100,
              isCategory: true,
            });
          }
          for (const dish of cat.m) {
            if (dish.n.trim()) {
              items.push({
                name: dish.n,
                price: dish.p ?? "",
                confidence: 100,
                isCategory: false,
              });
            }
          }
        }
      }
    }

    // Deduplicate by name
    const seen = new Set<string>();
    return items.filter((item) => {
      const key = item.name.toLowerCase().trim();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  } catch {
    return [];
  }
}

// ── Component ──

export function MenuImportClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [stage, setStage] = useState<
    "upload" | "processing" | "review" | "importing"
  >("upload");
  const [progress, setProgress] = useState(0);
  const [ocrItems, setOcrItems] = useState<OCRItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Check for ?menu= param on mount
  useEffect(() => {
    const menuParam = searchParams.get("menu");
    if (menuParam) {
      const decoded = decodeMenuParam(menuParam);
      if (decoded.length > 0) {
        setOcrItems(decoded);
        setStage("review");
      }
    }
  }, [searchParams]);

  const handleFileSelect = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setError("Bitte lade ein Bild hoch (JPG, PNG)");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError("Bild ist zu gross (max. 10 MB)");
      return;
    }

    setError(null);
    setStage("processing");
    setProgress(0);

    try {
      setProgress(5);
      const img = await loadImage(file);

      // Detect columns
      const { splits } = detectColumns(img);
      setProgress(10);

      // Build column regions
      const regions: { sx: number; sy: number; sw: number; sh: number }[] = [];
      if (splits.length > 0) {
        let prevX = 0;
        for (const splitX of splits) {
          regions.push({ sx: prevX, sy: 0, sw: splitX - prevX, sh: img.height });
          prevX = splitX;
        }
        regions.push({ sx: regions[regions.length - 1].sx + regions[regions.length - 1].sw, sy: 0, sw: img.width - (regions[regions.length - 1].sx + regions[regions.length - 1].sw), sh: img.height });
      } else {
        regions.push({ sx: 0, sy: 0, sw: img.width, sh: img.height });
      }

      const Tesseract = await import("tesseract.js");
      const allItems: OCRItem[] = [];
      const progressPerRegion = 85 / regions.length;

      for (let r = 0; r < regions.length; r++) {
        const region = regions[r];
        const preprocessed = await applyPreprocessing(img, region.sx, region.sy, region.sw, region.sh);

        const result = await Tesseract.recognize(preprocessed, "deu", {
          logger: (m) => {
            if (m.status === "recognizing text") {
              setProgress(
                10 + Math.round(r * progressPerRegion + (m.progress ?? 0) * progressPerRegion)
              );
            }
          },
        });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const words = (result.data as any).words as
          | { text: string; confidence: number }[]
          | undefined;
        const wordConfidences =
          words?.map((w) => ({
            text: w.text,
            confidence: w.confidence,
          })) ?? [];

        allItems.push(...parseMenuFromOCR(result.data.text, wordConfidences));
      }

      const items = allItems;

      if (items.length === 0) {
        setError("Kein Text erkannt. Versuch ein deutlicheres Foto.");
        setStage("upload");
        return;
      }

      setOcrItems(items);
      setStage("review");
    } catch {
      setError("OCR fehlgeschlagen. Versuch es erneut.");
      setStage("upload");
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) handleFileSelect(file);
    },
    [handleFileSelect]
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFileSelect(file);
    },
    [handleFileSelect]
  );

  const updateItem = useCallback(
    (index: number, updates: Partial<OCRItem>) => {
      setOcrItems((prev) =>
        prev.map((item, i) => (i === index ? { ...item, ...updates } : item))
      );
    },
    []
  );

  const removeItem = useCallback((index: number) => {
    setOcrItems((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleImport = useCallback(async () => {
    const dishes = ocrItems.filter(
      (item) => !item.isCategory && item.name.trim()
    );

    if (dishes.length === 0) {
      setError("Keine Gerichte zum Importieren.");
      return;
    }

    setStage("importing");
    setError(null);

    try {
      const res = await fetch("/api/menu-items/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: dishes.map((d) => ({ name: d.name, price: d.price })),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Import fehlgeschlagen.");
        setStage("review");
        return;
      }

      const data = await res.json();
      setSuccess(
        `${data.count} ${data.count === 1 ? "Gericht" : "Gerichte"} importiert!`
      );

      // Navigate to complete after short delay
      setTimeout(() => {
        router.push("/complete");
      }, 1500);
    } catch {
      setError("Netzwerkfehler. Versuch es erneut.");
      setStage("review");
    }
  }, [ocrItems, router]);

  const dishCount = ocrItems.filter((i) => !i.isCategory).length;

  return (
    <div className="space-y-6">
      {/* Upload stage */}
      {stage === "upload" && (
        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => fileInputRef.current?.click()}
          className="flex min-h-[200px] cursor-pointer flex-col items-center justify-center border-2 border-dashed border-border p-8 text-center transition-colors hover:border-primary/50"
        >
          <IconUpload className="mb-4 h-12 w-12 text-muted-foreground/50" />
          <p className="text-sm font-medium">
            Foto oder Screenshot deines Speiseplans
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            JPG oder PNG hochladen — wird direkt in deinem Browser verarbeitet
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleInputChange}
            className="hidden"
          />
        </div>
      )}

      {/* Processing stage */}
      {stage === "processing" && (
        <div className="space-y-4 py-8 text-center">
          <IconLoader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
          <div>
            <p className="mb-2 text-sm">Text wird erkannt...</p>
            <div className="mx-auto h-2 w-48 bg-muted">
              <div
                className="h-2 bg-primary transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="mt-1 font-mono text-xs text-muted-foreground">
              {progress}%
            </p>
          </div>
        </div>
      )}

      {/* Importing stage */}
      {stage === "importing" && (
        <div className="space-y-4 py-8 text-center">
          <IconLoader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
          <p className="text-sm">Gerichte werden gespeichert...</p>
        </div>
      )}

      {/* Success message */}
      {success && (
        <div className="border-l-[3px] border-primary bg-primary/5 p-3">
          <p className="text-xs font-medium text-primary">{success}</p>
        </div>
      )}

      {/* Review stage */}
      {stage === "review" && (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            {dishCount} {dishCount === 1 ? "Gericht" : "Gerichte"} erkannt —
            uberprüfe und korrigiere bei Bedarf.
          </p>

          <div className="max-h-[400px] space-y-1 overflow-y-auto">
            {ocrItems.map((item, index) => (
              <div
                key={index}
                className={cn(
                  "flex items-center gap-2 px-2 py-1.5",
                  item.isCategory && "bg-muted/50 text-xs font-semibold",
                  !item.isCategory &&
                    item.confidence < 70 &&
                    "bg-amber-50 dark:bg-amber-950/20"
                )}
              >
                {/* Confidence indicator */}
                {!item.isCategory && (
                  <span className="shrink-0">
                    {item.confidence >= 70 ? (
                      <IconCheck className="h-3.5 w-3.5 text-primary" />
                    ) : (
                      <IconAlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                    )}
                  </span>
                )}

                {item.isCategory ? (
                  <Input
                    value={item.name}
                    onChange={(e) =>
                      updateItem(index, { name: e.target.value })
                    }
                    className="h-7 border-0 bg-transparent p-0 text-xs font-semibold"
                  />
                ) : (
                  <>
                    <Input
                      value={item.name}
                      onChange={(e) =>
                        updateItem(index, { name: e.target.value })
                      }
                      className="h-7 flex-1 text-xs"
                    />
                    <Input
                      value={item.price}
                      onChange={(e) =>
                        updateItem(index, { price: e.target.value })
                      }
                      placeholder="0,00"
                      className="h-7 w-16 text-right font-mono text-xs"
                    />
                  </>
                )}

                {/* Low confidence tag */}
                {!item.isCategory && item.confidence < 70 && (
                  <span className="whitespace-nowrap font-mono text-[10px] text-amber-600">
                    (bitte prüfen)
                  </span>
                )}

                <button
                  onClick={() => removeItem(index)}
                  className="shrink-0 p-1 text-muted-foreground transition-colors hover:text-destructive"
                >
                  <IconTrash className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <Button onClick={handleImport} className="flex-1">
              <IconCheck className="mr-1 h-4 w-4" />
              {dishCount} {dishCount === 1 ? "Gericht" : "Gerichte"} importieren
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setStage("upload");
                setOcrItems([]);
              }}
            >
              Nochmal
            </Button>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="border-l-[3px] border-destructive bg-destructive/5 p-3">
          <p className="text-xs text-destructive">{error}</p>
        </div>
      )}

      {/* Privacy note */}
      {(stage === "upload" || stage === "processing") && (
        <p className="text-[10px] text-muted-foreground">
          Dein Bild wird nur in deinem Browser verarbeitet und nie an einen
          Server gesendet.
        </p>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Link
          href="/setup"
          className="inline-flex h-11 items-center px-4 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          ← Zurück
        </Link>
        <div className="flex gap-3">
          <Link
            href="/complete"
            className="inline-flex h-11 items-center px-4 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Überspringen
          </Link>
        </div>
      </div>
    </div>
  );
}
