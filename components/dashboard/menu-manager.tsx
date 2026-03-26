"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  IconPlus,
  IconPencil,
  IconTrash,
  IconToolsKitchen2,
  IconGripVertical,
  IconUpload,
  IconX,
  IconLoader2,
  IconQuestionMark,
} from "@tabler/icons-react";

interface MenuItem {
  id: string;
  name: string;
  description: string | null;
  price: string | number;
  vatRate: string | number;
  imageUrl: string | null;
  categoryId: string | null;
  isAvailable: boolean;
  sortOrder: number;
  allergens: string[];
  dietaryTags: string[];
}

interface Category {
  id: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
  menuItems: MenuItem[];
}

interface MenuManagerProps {
  initialCategories: Category[];
  uncategorizedItems?: MenuItem[];
}

const ALLERGENS = [
  "Gluten",
  "Krebstiere",
  "Eier",
  "Fisch",
  "Erdnüsse",
  "Soja",
  "Milch",
  "Schalenfrüchte",
  "Sellerie",
  "Senf",
  "Sesam",
  "Sulfite",
  "Lupinen",
  "Weichtiere",
] as const;

function formatPrice(price: string | number): string {
  const num = typeof price === "string" ? parseFloat(price) : price;
  return num.toFixed(2).replace(".", ",");
}

export function MenuManager({ initialCategories, uncategorizedItems: initialUncategorized = [] }: MenuManagerProps) {
  const [categories, setCategories] = useState<Category[]>(initialCategories);
  const [uncategorized, setUncategorized] = useState<MenuItem[]>(initialUncategorized);

  // Drag and drop state
  const [dragItemId, setDragItemId] = useState<string | null>(null);
  const [dragSourceCategory, setDragSourceCategory] = useState<string | null>(null);
  const [dropTargetCategory, setDropTargetCategory] = useState<string | null>(null);

  function handleDragStart(itemId: string, sourceCategoryId: string | null) {
    setDragItemId(itemId);
    setDragSourceCategory(sourceCategoryId);
  }

  function handleDragEnd() {
    setDragItemId(null);
    setDragSourceCategory(null);
    setDropTargetCategory(null);
  }

  function handleDragOver(e: React.DragEvent, categoryId: string) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dropTargetCategory !== categoryId) {
      setDropTargetCategory(categoryId);
    }
  }

  function handleDragLeave(e: React.DragEvent, categoryId: string) {
    // Only clear if we're leaving the container, not entering a child
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      if (dropTargetCategory === categoryId) {
        setDropTargetCategory(null);
      }
    }
  }

  async function handleDrop(e: React.DragEvent, targetCategoryId: string) {
    e.preventDefault();
    setDropTargetCategory(null);

    if (!dragItemId || dragSourceCategory === targetCategoryId) return;

    // Find the item from source
    let draggedItem: MenuItem | undefined;
    if (dragSourceCategory === null) {
      draggedItem = uncategorized.find((i) => i.id === dragItemId);
    } else {
      const sourceCat = categories.find((c) => c.id === dragSourceCategory);
      draggedItem = sourceCat?.menuItems.find((i) => i.id === dragItemId);
    }
    if (!draggedItem) return;

    const movedItem = { ...draggedItem, categoryId: targetCategoryId };

    // Optimistic update
    if (dragSourceCategory === null) {
      setUncategorized((prev) => prev.filter((i) => i.id !== dragItemId));
    }
    setCategories((prev) =>
      prev.map((cat) => {
        let items = cat.menuItems;
        // Remove from source category
        if (cat.id === dragSourceCategory) {
          items = items.filter((i) => i.id !== dragItemId);
        }
        // Add to target category
        if (cat.id === targetCategoryId) {
          items = [...items, movedItem];
        }
        return { ...cat, menuItems: items };
      })
    );

    // Persist
    try {
      await fetch(`/api/menu-items/${dragItemId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categoryId: targetCategoryId }),
      });
    } catch {
      // Revert on error — reload page to reset state
      window.location.reload();
    }

    handleDragEnd();
  }

  // Category dialog state
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [categoryName, setCategoryName] = useState("");
  const [categorySaving, setCategorySaving] = useState(false);

  // Item dialog state
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [itemForm, setItemForm] = useState({
    name: "",
    description: "",
    price: "",
    vatRate: "7",
    imageUrl: "",
    categoryId: "",
    isAvailable: true,
    allergens: [] as string[],
  });
  const [itemSaving, setItemSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Delete dialog state
  const [deleteDialog, setDeleteDialog] = useState<{
    type: "category" | "item";
    id: string;
    name: string;
  } | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Error state
  const [error, setError] = useState<string | null>(null);

  // ─── Category CRUD ───────────────────────────────────

  function openAddCategory() {
    setEditingCategory(null);
    setCategoryName("");
    setError(null);
    setCategoryDialogOpen(true);
  }

  function openEditCategory(category: Category) {
    setEditingCategory(category);
    setCategoryName(category.name);
    setError(null);
    setCategoryDialogOpen(true);
  }

  async function saveCategory() {
    if (!categoryName.trim()) {
      setError("Bitte gib einen Kategorienamen ein.");
      return;
    }

    setCategorySaving(true);
    setError(null);

    try {
      if (editingCategory) {
        const res = await fetch(`/api/categories/${editingCategory.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: categoryName.trim() }),
        });

        if (!res.ok) {
          const data = await res.json();
          setError(data.error || "Fehler beim Speichern.");
          return;
        }

        const { category } = await res.json();
        setCategories((prev) =>
          prev.map((c) => (c.id === category.id ? category : c))
        );
      } else {
        const res = await fetch("/api/categories", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: categoryName.trim() }),
        });

        if (!res.ok) {
          const data = await res.json();
          setError(data.error || "Fehler beim Erstellen.");
          return;
        }

        const { category } = await res.json();
        setCategories((prev) => [...prev, category]);
      }

      setCategoryDialogOpen(false);
    } catch {
      setError("Ein Fehler ist aufgetreten.");
    } finally {
      setCategorySaving(false);
    }
  }

  async function deleteCategory(id: string) {
    setDeleting(true);
    try {
      const res = await fetch(`/api/categories/${id}`, { method: "DELETE" });
      if (res.ok) {
        setCategories((prev) => prev.filter((c) => c.id !== id));
      }
    } catch {
      // Silently fail
    } finally {
      setDeleting(false);
      setDeleteDialog(null);
    }
  }

  // ─── Item CRUD ───────────────────────────────────────

  function openAddItem(categoryId?: string) {
    setEditingItem(null);
    setItemForm({
      name: "",
      description: "",
      price: "",
      vatRate: "7",
      imageUrl: "",
      categoryId: categoryId || "",
      isAvailable: true,
      allergens: [],
    });
    setError(null);
    setItemDialogOpen(true);
  }

  function openEditItem(item: MenuItem) {
    setEditingItem(item);
    setItemForm({
      name: item.name,
      description: item.description || "",
      price: formatPrice(item.price),
      vatRate: String(item.vatRate ?? "7"),
      imageUrl: item.imageUrl || "",
      categoryId: item.categoryId || "",
      isAvailable: item.isAvailable,
      allergens: item.allergens || [],
    });
    setError(null);
    setItemDialogOpen(true);
  }

  async function saveItem() {
    if (!itemForm.name.trim()) {
      setError("Bitte gib einen Artikelnamen ein.");
      return;
    }

    const priceStr = itemForm.price.replace(",", ".");
    const priceNum = parseFloat(priceStr);
    if (isNaN(priceNum) || priceNum < 0) {
      setError("Bitte gib einen gültigen Preis ein.");
      return;
    }

    setItemSaving(true);
    setError(null);

    try {
      const payload = {
        name: itemForm.name.trim(),
        description: itemForm.description.trim() || null,
        price: priceNum,
        vatRate: parseFloat(itemForm.vatRate) || 7,
        imageUrl: itemForm.imageUrl.trim() || null,
        categoryId: itemForm.categoryId || null,
        isAvailable: itemForm.isAvailable,
        allergens: itemForm.allergens,
      };

      if (editingItem) {
        const res = await fetch(`/api/menu-items/${editingItem.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const data = await res.json();
          setError(data.error || "Fehler beim Speichern.");
          return;
        }

        const { menuItem } = await res.json();

        // Remove from uncategorized if it was there
        setUncategorized((prev) =>
          prev.filter((i) => i.id !== menuItem.id)
        );

        setCategories((prev) =>
          prev.map((cat) => {
            // Remove item from old category
            const filtered = cat.menuItems.filter((i) => i.id !== menuItem.id);
            // Add to new category if it matches
            if (cat.id === menuItem.categoryId) {
              return {
                ...cat,
                menuItems: [...filtered, menuItem].sort(
                  (a, b) => a.sortOrder - b.sortOrder
                ),
              };
            }
            return { ...cat, menuItems: filtered };
          })
        );
      } else {
        const res = await fetch("/api/menu-items", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const data = await res.json();
          setError(data.error || "Fehler beim Erstellen.");
          return;
        }

        const { menuItem } = await res.json();

        setCategories((prev) =>
          prev.map((cat) => {
            if (cat.id === menuItem.categoryId) {
              return {
                ...cat,
                menuItems: [...cat.menuItems, menuItem],
              };
            }
            return cat;
          })
        );
      }

      setItemDialogOpen(false);
    } catch {
      setError("Ein Fehler ist aufgetreten.");
    } finally {
      setItemSaving(false);
    }
  }

  async function deleteItem(id: string) {
    setDeleting(true);
    try {
      const res = await fetch(`/api/menu-items/${id}`, { method: "DELETE" });
      if (res.ok) {
        setCategories((prev) =>
          prev.map((cat) => ({
            ...cat,
            menuItems: cat.menuItems.filter((i) => i.id !== id),
          }))
        );
        setUncategorized((prev) => prev.filter((i) => i.id !== id));
      }
    } catch {
      // Silently fail
    } finally {
      setDeleting(false);
      setDeleteDialog(null);
    }
  }

  async function toggleItemAvailability(item: MenuItem) {
    const newValue = !item.isAvailable;
    // Optimistic update
    setCategories((prev) =>
      prev.map((cat) => ({
        ...cat,
        menuItems: cat.menuItems.map((i) =>
          i.id === item.id ? { ...i, isAvailable: newValue } : i
        ),
      }))
    );
    setUncategorized((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, isAvailable: newValue } : i))
    );

    try {
      await fetch(`/api/menu-items/${item.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isAvailable: newValue }),
      });
    } catch {
      // Revert on error
      setCategories((prev) =>
        prev.map((cat) => ({
          ...cat,
          menuItems: cat.menuItems.map((i) =>
            i.id === item.id ? { ...i, isAvailable: !newValue } : i
          ),
        }))
      );
      setUncategorized((prev) =>
        prev.map((i) =>
          i.id === item.id ? { ...i, isAvailable: !newValue } : i
        )
      );
    }
  }

  // ─── Image upload ───────────────────────────────────

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Bild konnte nicht hochgeladen werden.");
        return;
      }

      const { url } = await res.json();
      setItemForm((f) => ({ ...f, imageUrl: url }));
    } catch {
      setError("Bild konnte nicht hochgeladen werden.");
    } finally {
      setUploading(false);
      // Reset file input so the same file can be re-selected
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  // ─── Empty state ─────────────────────────────────────

  if (categories.length === 0) {
    return (
      <>
        {/* CTA */}
        <div className="flex flex-col items-center text-center py-12">
          <div className="mb-4 flex h-14 w-14 items-center justify-center border-2 border-stone-200 bg-white">
            <IconToolsKitchen2 size={28} stroke={1.5} className="text-stone-400" />
          </div>
          <h3 className="text-lg font-extrabold tracking-tight">
            Speisekarte aufbauen
          </h3>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            Organisiere dein Angebot in Kategorien — z.B. Vorspeisen, Hauptgerichte, Getränke.
            Deine Gäste sehen die Karte genau in dieser Struktur.
          </p>
          <Button
            className="mt-5 rounded-none"
            onClick={openAddCategory}
          >
            Erste Kategorie erstellen
          </Button>
        </div>



        {/* Category Dialog — must be in DOM for empty state button to work */}
        <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
          <DialogContent className="rounded-none sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Neue Kategorie erstellen</DialogTitle>
              <DialogDescription>
                Gib deiner neuen Kategorie einen Namen, z.B. Vorspeisen, Hauptgerichte oder Getränke.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="category-name-empty">Name</Label>
                <Input
                  id="category-name-empty"
                  className="rounded-none"
                  value={categoryName}
                  onChange={(e) => setCategoryName(e.target.value)}
                  placeholder="z.B. Hauptgerichte"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveCategory();
                  }}
                  autoFocus
                />
              </div>
              {error && (
                <div className="border-l-3 border-red-500 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {error}
                </div>
              )}
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                className="rounded-none"
                onClick={() => setCategoryDialogOpen(false)}
              >
                Abbrechen
              </Button>
              <Button
                className="rounded-none"
                onClick={saveCategory}
                disabled={categorySaving}
              >
                {categorySaving ? "Speichern..." : "Erstellen"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  // ─── Main render ─────────────────────────────────────

  return (
    <>
      {/* Uncategorized items */}
      {uncategorized.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between border-b-2 border-amber-400 pb-3">
            <div className="flex items-baseline gap-3">
              <div className="flex h-5 w-5 translate-y-0.5 items-center justify-center bg-amber-100">
                <IconQuestionMark size={14} className="text-amber-600" />
              </div>
              <h2 className="text-lg font-extrabold tracking-tight text-amber-700">
                Nicht zugeordnet
              </h2>
              <span className="font-mono text-xs text-amber-500">
                {uncategorized.length}{" "}
                {uncategorized.length === 1 ? "Artikel" : "Artikel"}
              </span>
            </div>
          </div>
          <div className="border-l-3 border-amber-400 bg-amber-50 px-3 py-2 text-sm text-amber-700">
            Diese Artikel sind keiner Kategorie zugeordnet. Ziehe sie per Drag &amp; Drop in eine Kategorie.
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {uncategorized.map((item) => (
              <div
                key={item.id}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.effectAllowed = "move";
                  handleDragStart(item.id, null);
                }}
                onDragEnd={handleDragEnd}
                className={cn(
                  "group relative border border-amber-200 bg-white p-4 transition-colors hover:border-amber-300 cursor-grab active:cursor-grabbing",
                  dragItemId === item.id && "opacity-40",
                  !item.isAvailable && "opacity-60"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <IconGripVertical
                    size={16}
                    className="mt-0.5 shrink-0 text-amber-300"
                  />
                  {item.imageUrl && (
                    <Image
                      src={item.imageUrl}
                      alt={item.name}
                      width={48}
                      height={48}
                      className="h-12 w-12 shrink-0 object-cover border border-stone-200"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-sm font-bold">
                      {item.name}
                    </h3>
                    {item.description && (
                      <p className="mt-1 line-clamp-2 text-xs text-stone-500">
                        {item.description}
                      </p>
                    )}
                  </div>
                  <span className="shrink-0 font-mono text-sm font-semibold tabular-nums text-stone-900">
                    {formatPrice(item.price)}&nbsp;&euro;
                  </span>
                </div>

                {/* Actions */}
                <div className="mt-3 flex items-center justify-end border-t border-stone-100 pt-3">
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => openEditItem(item)}
                    >
                      <IconPencil size={14} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() =>
                        setDeleteDialog({
                          type: "item",
                          id: item.id,
                          name: item.name,
                        })
                      }
                    >
                      <IconTrash size={14} />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Category list */}
      <div className="space-y-8">
        {categories.map((category) => (
          <section
            key={category.id}
            className="space-y-3"
            onDragOver={(e) => handleDragOver(e, category.id)}
            onDragLeave={(e) => handleDragLeave(e, category.id)}
            onDrop={(e) => handleDrop(e, category.id)}
          >
            {/* Category header */}
            <div className={cn(
              "flex items-center justify-between border-b pb-3 transition-colors",
              dropTargetCategory === category.id
                ? "border-green-500"
                : "border-stone-200"
            )}>
              <div className="flex items-baseline gap-3">
                <IconGripVertical
                  size={18}
                  className="translate-y-0.5 text-stone-300 cursor-grab"
                />
                <h2 className={cn(
                  "text-lg font-extrabold tracking-tight transition-colors",
                  dropTargetCategory === category.id && "text-green-700"
                )}>
                  {category.name}
                </h2>
                {!category.isActive && (
                  <Badge variant="secondary" className="rounded-none text-xs translate-y-[-1px]">
                    Inaktiv
                  </Badge>
                )}
                <span className={cn(
                  "font-mono text-xs transition-colors",
                  dropTargetCategory === category.id
                    ? "text-green-600"
                    : "text-stone-400"
                )}>
                  {category.menuItems.length}{" "}
                  {category.menuItems.length === 1 ? "Artikel" : "Artikel"}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => openAddItem(category.id)}
                  title="Artikel hinzufügen"
                >
                  <IconPlus size={16} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => openEditCategory(category)}
                  title="Kategorie bearbeiten"
                >
                  <IconPencil size={16} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() =>
                    setDeleteDialog({
                      type: "category",
                      id: category.id,
                      name: category.name,
                    })
                  }
                  title="Kategorie löschen"
                >
                  <IconTrash size={16} />
                </Button>
              </div>
            </div>

            {/* Menu items grid */}
            {category.menuItems.length === 0 ? (
              <div className={cn(
                "flex flex-col items-center justify-center py-8 text-center border-2 border-dashed",
                dropTargetCategory === category.id
                  ? "border-green-300"
                  : "border-transparent"
              )}>
                <p className="text-sm text-stone-400">
                  Noch keine Artikel in dieser Kategorie.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3 rounded-none"
                  onClick={() => openAddItem(category.id)}
                >
                  <IconPlus size={14} />
                  Artikel hinzufügen
                </Button>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {category.menuItems.map((item) => (
                  <div
                    key={item.id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.effectAllowed = "move";
                      handleDragStart(item.id, category.id);
                    }}
                    onDragEnd={handleDragEnd}
                    className={cn(
                      "group relative border border-stone-200 bg-white p-4 transition-colors hover:border-stone-300 cursor-grab active:cursor-grabbing",
                      dragItemId === item.id && "opacity-40",
                      !item.isAvailable && "opacity-60"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <IconGripVertical
                        size={16}
                        className="mt-0.5 shrink-0 text-stone-300"
                      />
                      {item.imageUrl && (
                        <Image
                          src={item.imageUrl}
                          alt={item.name}
                          width={48}
                          height={48}
                          className="h-12 w-12 shrink-0 object-cover border border-stone-200"
                        />
                      )}
                      <div className="min-w-0 flex-1">
                        <h3 className="truncate text-sm font-bold">
                          {item.name}
                        </h3>
                        {item.description && (
                          <p className="mt-1 line-clamp-2 text-xs text-stone-500">
                            {item.description}
                          </p>
                        )}
                      </div>
                      <span className="shrink-0 font-mono text-sm font-semibold tabular-nums text-stone-900">
                        {formatPrice(item.price)}&nbsp;&euro;
                      </span>
                    </div>

                    {/* Tags */}
                    {(item.allergens.length > 0 ||
                      item.dietaryTags.length > 0) && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {item.dietaryTags.map((tag) => (
                          <Badge
                            key={tag}
                            variant="secondary"
                            className="rounded-none text-[10px] px-1.5 py-0"
                          >
                            {tag}
                          </Badge>
                        ))}
                        {item.allergens.map((allergen) => (
                          <Badge
                            key={allergen}
                            variant="outline"
                            className="rounded-none text-[10px] px-1.5 py-0"
                          >
                            {allergen}
                          </Badge>
                        ))}
                      </div>
                    )}

                    {/* Actions — visible on hover / always on mobile */}
                    <div className="mt-3 flex items-center justify-between border-t border-stone-100 pt-3">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={item.isAvailable}
                          onCheckedChange={() => toggleItemAvailability(item)}
                        />
                        <span className="text-xs text-stone-500">
                          {item.isAvailable ? "Verfügbar" : "Ausverkauft"}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => openEditItem(item)}
                        >
                          <IconPencil size={14} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() =>
                            setDeleteDialog({
                              type: "item",
                              id: item.id,
                              name: item.name,
                            })
                          }
                        >
                          <IconTrash size={14} />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        ))}
      </div>

      {/* ─── Category Dialog ──────────────────────────── */}
      <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
        <DialogContent className="rounded-none sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingCategory
                ? "Kategorie bearbeiten"
                : "Neue Kategorie erstellen"}
            </DialogTitle>
            <DialogDescription>
              {editingCategory
                ? "Passe den Namen deiner Kategorie an."
                : "Gib deiner neuen Kategorie einen Namen, z.B. Vorspeisen, Hauptgerichte oder Getränke."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="category-name">Name</Label>
              <Input
                id="category-name"
                className="rounded-none"
                value={categoryName}
                onChange={(e) => setCategoryName(e.target.value)}
                placeholder="z.B. Hauptgerichte"
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveCategory();
                }}
                autoFocus
              />
            </div>

            {error && (
              <div className="border-l-3 border-red-500 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              className="rounded-none"
              onClick={() => setCategoryDialogOpen(false)}
            >
              Abbrechen
            </Button>
            <Button
              className="rounded-none"
              onClick={saveCategory}
              disabled={categorySaving}
            >
              {categorySaving
                ? "Speichern..."
                : editingCategory
                  ? "Speichern"
                  : "Erstellen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Item Dialog ──────────────────────────────── */}
      <Dialog open={itemDialogOpen} onOpenChange={setItemDialogOpen}>
        <DialogContent className="rounded-none sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingItem ? "Artikel bearbeiten" : "Neuen Artikel erstellen"}
            </DialogTitle>
            <DialogDescription>
              {editingItem
                ? "Bearbeite die Details deines Artikels."
                : "Füge einen neuen Artikel zu deiner Speisekarte hinzu."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="item-name">Name *</Label>
              <Input
                id="item-name"
                className="rounded-none"
                value={itemForm.name}
                onChange={(e) =>
                  setItemForm((f) => ({ ...f, name: e.target.value }))
                }
                placeholder="z.B. Currywurst mit Pommes"
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="item-description">Beschreibung</Label>
              <Textarea
                id="item-description"
                className="rounded-none min-h-[60px]"
                value={itemForm.description}
                onChange={(e) =>
                  setItemForm((f) => ({ ...f, description: e.target.value }))
                }
                placeholder="Optionale Beschreibung des Gerichts"
              />
            </div>

            <div className="space-y-2">
              <Label>Bild</Label>
              {itemForm.imageUrl ? (
                <div className="flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={itemForm.imageUrl}
                    alt="Vorschau"
                    className="h-16 w-16 border border-stone-200 object-cover"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-none"
                    onClick={() => setItemForm((f) => ({ ...f, imageUrl: "" }))}
                  >
                    <IconX size={14} />
                    Entfernen
                  </Button>
                </div>
              ) : (
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-none"
                    disabled={uploading}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {uploading ? (
                      <IconLoader2 size={14} className="animate-spin" />
                    ) : (
                      <IconUpload size={14} />
                    )}
                    {uploading ? "Hochladen..." : "Bild hochladen"}
                  </Button>
                  <p className="mt-1 text-xs text-stone-400">
                    JPEG, PNG oder WebP, max. 5 MB
                  </p>
                </div>
              )}
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="item-price">Preis (EUR) *</Label>
                <Input
                  id="item-price"
                  className="rounded-none font-mono"
                  value={itemForm.price}
                  onChange={(e) =>
                    setItemForm((f) => ({ ...f, price: e.target.value }))
                  }
                  placeholder="0,00"
                  inputMode="decimal"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="item-vat">MwSt.</Label>
                <Select
                  value={itemForm.vatRate}
                  onValueChange={(value) =>
                    setItemForm((f) => ({ ...f, vatRate: value }))
                  }
                >
                  <SelectTrigger className="rounded-none w-full font-mono" id="item-vat">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-none">
                    <SelectItem value="7">7%</SelectItem>
                    <SelectItem value="19">19%</SelectItem>
                    <SelectItem value="0">0%</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="item-category">Kategorie</Label>
                <Select
                  value={itemForm.categoryId}
                  onValueChange={(value) =>
                    setItemForm((f) => ({ ...f, categoryId: value }))
                  }
                >
                  <SelectTrigger className="rounded-none w-full" id="item-category">
                    <SelectValue placeholder="Kategorie wählen" />
                  </SelectTrigger>
                  <SelectContent className="rounded-none">
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Allergene</Label>
              <div className="flex flex-wrap gap-1.5">
                {ALLERGENS.map((allergen) => {
                  const active = itemForm.allergens.includes(allergen);
                  return (
                    <button
                      key={allergen}
                      type="button"
                      onClick={() =>
                        setItemForm((f) => ({
                          ...f,
                          allergens: active
                            ? f.allergens.filter((a) => a !== allergen)
                            : [...f.allergens, allergen],
                        }))
                      }
                      className={cn(
                        "rounded-none border px-2.5 py-1 text-xs font-medium transition-colors",
                        active
                          ? "border-stone-900 bg-stone-900 text-white"
                          : "border-stone-200 bg-white text-stone-600 hover:border-stone-400"
                      )}
                    >
                      {allergen}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Switch
                id="item-available"
                checked={itemForm.isAvailable}
                onCheckedChange={(checked) =>
                  setItemForm((f) => ({ ...f, isAvailable: checked }))
                }
              />
              <Label htmlFor="item-available">Verfügbar</Label>
            </div>

            {error && (
              <div className="border-l-3 border-red-500 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              className="rounded-none"
              onClick={() => setItemDialogOpen(false)}
            >
              Abbrechen
            </Button>
            <Button
              className="rounded-none"
              onClick={saveItem}
              disabled={itemSaving}
            >
              {itemSaving
                ? "Speichern..."
                : editingItem
                  ? "Speichern"
                  : "Erstellen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Delete Confirmation ──────────────────────── */}
      <AlertDialog
        open={!!deleteDialog}
        onOpenChange={(open) => !open && setDeleteDialog(null)}
      >
        <AlertDialogContent className="rounded-none">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deleteDialog?.type === "category"
                ? "Kategorie löschen?"
                : "Artikel löschen?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteDialog?.type === "category"
                ? `Die Kategorie "${deleteDialog.name}" und alle zugehörigen Artikel werden unwiderruflich gelöscht.`
                : `Der Artikel "${deleteDialog?.name}" wird unwiderruflich gelöscht.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-none">
              Abbrechen
            </AlertDialogCancel>
            <AlertDialogAction
              className="rounded-none bg-destructive text-white hover:bg-destructive/90"
              onClick={() => {
                if (!deleteDialog) return;
                if (deleteDialog.type === "category") {
                  deleteCategory(deleteDialog.id);
                } else {
                  deleteItem(deleteDialog.id);
                }
              }}
              disabled={deleting}
            >
              {deleting ? "Löschen..." : "Löschen"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
