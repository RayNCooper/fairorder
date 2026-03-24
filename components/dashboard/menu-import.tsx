"use client";

import { useState, useRef } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import {
  IconPhoto,
  IconWorldWww,
  IconPencil,
  IconLoader2,
  IconCheck,
  IconX,
} from "@tabler/icons-react";

interface ExtractedItem {
  name: string;
  description?: string;
  price?: number;
  category?: string;
  allergens?: string[];
  dietaryTags?: string[];
  selected: boolean;
}

interface CategoryOption {
  id: string;
  name: string;
}

type ImportMethod = "image" | "url" | null;

export function MenuImport({
  categories,
}: {
  categories: CategoryOption[];
}) {
  const [method, setMethod] = useState<ImportMethod>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<ExtractedItem[]>([]);
  const [confidence, setConfidence] = useState<number>(0);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<number | null>(null);
  const [urlInput, setUrlInput] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError(null);
    setItems([]);
    setImportResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/menu-extraction/image", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Erkennung fehlgeschlagen.");
        return;
      }

      setItems(
        (data.items ?? []).map((item: ExtractedItem) => ({
          ...item,
          selected: true,
        }))
      );
      setConfidence(data.confidence ?? 0);

      if ((data.items ?? []).length === 0) {
        setError("Keine Gerichte erkannt. Versuche ein besseres Bild.");
      }
    } catch {
      setError("Verbindungsfehler. Bitte versuche es erneut.");
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleUrlExtract() {
    if (!urlInput.trim()) {
      setError("Bitte gib eine URL ein.");
      return;
    }

    setLoading(true);
    setError(null);
    setItems([]);
    setImportResult(null);

    try {
      const res = await fetch("/api/menu-extraction/url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: urlInput.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Erkennung fehlgeschlagen.");
        return;
      }

      setItems(
        (data.items ?? []).map((item: ExtractedItem) => ({
          ...item,
          selected: true,
        }))
      );
      setConfidence(data.confidence ?? 0);

      if ((data.items ?? []).length === 0) {
        setError("Keine Gerichte erkannt.");
      }
    } catch {
      setError("Verbindungsfehler. Bitte versuche es erneut.");
    } finally {
      setLoading(false);
    }
  }

  async function handleImport() {
    const selectedItems = items.filter((i) => i.selected);
    if (selectedItems.length === 0) return;

    setImporting(true);
    setError(null);

    try {
      const res = await fetch("/api/menu-items/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: selectedItems.map((item) => ({
            name: item.name,
            description: item.description,
            price: item.price ?? 0,
            category: item.category,
            allergens: item.allergens,
            dietaryTags: item.dietaryTags,
          })),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Import fehlgeschlagen.");
        return;
      }

      setImportResult(data.count);
      setItems([]);
    } catch {
      setError("Verbindungsfehler. Bitte versuche es erneut.");
    } finally {
      setImporting(false);
    }
  }

  function updateItem(index: number, updates: Partial<ExtractedItem>) {
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, ...updates } : item))
    );
  }

  const selectedCount = items.filter((i) => i.selected).length;

  // ── Success state ──
  if (importResult !== null) {
    return (
      <div className="space-y-6">
        <div className="border-l-[3px] border-green-600 bg-green-50 px-4 py-3">
          <p className="text-sm font-semibold text-green-800">
            {importResult} {importResult === 1 ? "Gericht" : "Gerichte"} erfolgreich
            importiert.
          </p>
        </div>
        <div className="flex gap-3">
          <Button
            className="rounded-none"
            onClick={() => {
              setImportResult(null);
              setMethod(null);
            }}
          >
            Weiteren Import starten
          </Button>
          <Link href="/dashboard/menu">
            <Button variant="outline" className="rounded-none">
              Zur Speisekarte
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Method selection cards */}
      {!method && items.length === 0 && (
        <div className="grid gap-4 sm:grid-cols-3">
          <button
            onClick={() => setMethod("image")}
            className="flex flex-col items-center gap-3 border border-stone-200 bg-white p-6 text-center transition-colors hover:border-stone-400"
          >
            <IconPhoto size={32} className="text-stone-500" />
            <div>
              <p className="text-sm font-bold">Bild hochladen</p>
              <p className="mt-1 text-xs text-stone-500">
                KI erkennt Gerichte aus Fotos
              </p>
            </div>
          </button>
          <button
            onClick={() => setMethod("url")}
            className="flex flex-col items-center gap-3 border border-stone-200 bg-white p-6 text-center transition-colors hover:border-stone-400"
          >
            <IconWorldWww size={32} className="text-stone-500" />
            <div>
              <p className="text-sm font-bold">Website-URL</p>
              <p className="mt-1 text-xs text-stone-500">
                Gerichte von einer Website extrahieren
              </p>
            </div>
          </button>
          <Link
            href="/dashboard/menu"
            className="flex flex-col items-center gap-3 border border-stone-200 bg-white p-6 text-center transition-colors hover:border-stone-400"
          >
            <IconPencil size={32} className="text-stone-500" />
            <div>
              <p className="text-sm font-bold">Manuell eingeben</p>
              <p className="mt-1 text-xs text-stone-500">
                Gerichte einzeln hinzufügen
              </p>
            </div>
          </Link>
        </div>
      )}

      {/* Image upload method */}
      {method === "image" && items.length === 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMethod(null)}
              className="text-sm text-stone-500 hover:text-stone-700"
            >
              &larr; Zurück
            </button>
            <h2 className="text-sm font-bold">Bild hochladen</h2>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handleImageUpload}
          />

          <div
            className="flex cursor-pointer flex-col items-center justify-center border-2 border-dashed border-stone-300 bg-white p-12 text-center transition-colors hover:border-stone-400"
            onClick={() => fileInputRef.current?.click()}
          >
            {loading ? (
              <>
                <IconLoader2 size={32} className="animate-spin text-stone-400" />
                <p className="mt-3 text-sm text-stone-500">
                  Bild wird analysiert...
                </p>
              </>
            ) : (
              <>
                <IconPhoto size={32} className="text-stone-400" />
                <p className="mt-3 text-sm text-stone-600">
                  Klicke hier oder ziehe ein Bild hinein
                </p>
                <p className="mt-1 text-xs text-stone-400">
                  JPEG, PNG oder WebP, max. 10 MB
                </p>
              </>
            )}
          </div>
        </div>
      )}

      {/* URL method */}
      {method === "url" && items.length === 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMethod(null)}
              className="text-sm text-stone-500 hover:text-stone-700"
            >
              &larr; Zurück
            </button>
            <h2 className="text-sm font-bold">Website-URL</h2>
          </div>

          <div className="flex gap-3">
            <Input
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="https://example.com/speisekarte"
              className="flex-1 rounded-none"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleUrlExtract();
              }}
            />
            <Button
              className="rounded-none"
              onClick={handleUrlExtract}
              disabled={loading}
            >
              {loading ? (
                <IconLoader2 size={16} className="animate-spin" />
              ) : (
                "Extrahieren"
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="border-l-[3px] border-red-600 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </div>
      )}

      {/* Confidence indicator */}
      {items.length > 0 && (
        <div
          className={cn(
            "border-l-[3px] px-3 py-2 text-sm",
            confidence >= 0.7
              ? "border-green-600 bg-green-50 text-green-800"
              : confidence >= 0.4
                ? "border-amber-500 bg-amber-50 text-amber-800"
                : "border-red-600 bg-red-50 text-red-800"
          )}
        >
          {items.length} {items.length === 1 ? "Gericht" : "Gerichte"} erkannt
          {confidence < 0.5 &&
            " — Bitte überprüfe die Ergebnisse sorgfältig."}
        </div>
      )}

      {/* Editable results table */}
      {items.length > 0 && (
        <div className="space-y-4">
          <div className="overflow-x-auto border border-stone-200">
            <table className="w-full text-sm">
              <thead className="border-b border-stone-200 bg-stone-50">
                <tr>
                  <th className="w-10 px-3 py-2 text-left">
                    <input
                      type="checkbox"
                      checked={selectedCount === items.length}
                      onChange={(e) =>
                        setItems((prev) =>
                          prev.map((item) => ({
                            ...item,
                            selected: e.target.checked,
                          }))
                        )
                      }
                    />
                  </th>
                  <th className="px-3 py-2 text-left font-semibold">Name</th>
                  <th className="w-24 px-3 py-2 text-left font-semibold">Preis</th>
                  <th className="w-40 px-3 py-2 text-left font-semibold">Kategorie</th>
                  <th className="px-3 py-2 text-left font-semibold">Beschreibung</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, i) => (
                  <tr
                    key={i}
                    className={cn(
                      "border-b border-stone-100",
                      !item.selected && "opacity-40"
                    )}
                  >
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={item.selected}
                        onChange={(e) =>
                          updateItem(i, { selected: e.target.checked })
                        }
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={item.name}
                        onChange={(e) =>
                          updateItem(i, { name: e.target.value })
                        }
                        className="w-full border-b border-transparent bg-transparent text-sm focus:border-stone-400 focus:outline-none"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={
                          item.price !== undefined
                            ? item.price.toFixed(2).replace(".", ",")
                            : ""
                        }
                        onChange={(e) => {
                          const val = parseFloat(
                            e.target.value.replace(",", ".")
                          );
                          updateItem(i, {
                            price: isNaN(val) ? undefined : val,
                          });
                        }}
                        className="w-full border-b border-transparent bg-transparent font-mono text-sm focus:border-stone-400 focus:outline-none"
                        placeholder="0,00"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={item.category ?? ""}
                        onChange={(e) =>
                          updateItem(i, { category: e.target.value || undefined })
                        }
                        className="w-full border-b border-transparent bg-transparent text-sm focus:border-stone-400 focus:outline-none"
                        placeholder="Kategorie"
                        list="category-options"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={item.description ?? ""}
                        onChange={(e) =>
                          updateItem(i, {
                            description: e.target.value || undefined,
                          })
                        }
                        className="w-full border-b border-transparent bg-transparent text-sm focus:border-stone-400 focus:outline-none"
                        placeholder="Beschreibung"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Category autocomplete datalist */}
          <datalist id="category-options">
            {categories.map((cat) => (
              <option key={cat.id} value={cat.name} />
            ))}
          </datalist>

          {/* Actions */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => {
                setItems([]);
                setMethod(null);
                setError(null);
              }}
              className="text-sm text-stone-500 hover:text-stone-700"
            >
              <IconX size={14} className="mr-1 inline" />
              Verwerfen
            </button>
            <Button
              className="rounded-none"
              onClick={handleImport}
              disabled={importing || selectedCount === 0}
            >
              {importing ? (
                <IconLoader2 size={16} className="animate-spin" />
              ) : (
                <IconCheck size={16} />
              )}
              {selectedCount} {selectedCount === 1 ? "Gericht" : "Gerichte"}{" "}
              importieren
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
