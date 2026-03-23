"use client";

import { useState } from "react";
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
import { EmptyState } from "@/components/EmptyState";
import {
  IconPlus,
  IconPencil,
  IconTrash,
  IconToolsKitchen2,
  IconCategory,
  IconGripVertical,
} from "@tabler/icons-react";

interface MenuItem {
  id: string;
  name: string;
  description: string | null;
  price: string | number;
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
}

function formatPrice(price: string | number): string {
  const num = typeof price === "string" ? parseFloat(price) : price;
  return num.toFixed(2).replace(".", ",");
}

export function MenuManager({ initialCategories }: MenuManagerProps) {
  const [categories, setCategories] = useState<Category[]>(initialCategories);

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
    categoryId: "",
    isAvailable: true,
  });
  const [itemSaving, setItemSaving] = useState(false);

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
      categoryId: categoryId || "",
      isAvailable: true,
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
      categoryId: item.categoryId || "",
      isAvailable: item.isAvailable,
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
        categoryId: itemForm.categoryId || null,
        isAvailable: itemForm.isAvailable,
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
    }
  }

  // ─── Empty state ─────────────────────────────────────

  if (categories.length === 0) {
    return (
      <>
        <EmptyState
          illustration={
            <IconToolsKitchen2 size={64} stroke={1.5} />
          }
          title="Noch keine Speisekarte"
          description="Erstelle deine erste Kategorie, um Gerichte hinzuzufügen. Du kannst z.B. mit Vorspeisen, Hauptgerichte oder Getränke starten."
          action={{
            label: "Erste Kategorie erstellen",
            onClick: openAddCategory,
          }}
        />

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
      {/* Category list */}
      <div className="space-y-8">
        {categories.map((category) => (
          <section key={category.id} className="space-y-3">
            {/* Category header */}
            <div className="flex items-center justify-between border-b border-stone-200 pb-3">
              <div className="flex items-center gap-3">
                <IconGripVertical
                  size={18}
                  className="text-stone-300 cursor-grab"
                />
                <h2 className="text-lg font-extrabold tracking-tight">
                  {category.name}
                </h2>
                {!category.isActive && (
                  <Badge variant="secondary" className="rounded-none text-xs">
                    Inaktiv
                  </Badge>
                )}
                <span className="font-mono text-xs text-stone-400">
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
              <div className="flex flex-col items-center justify-center py-8 text-center">
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
                    className={cn(
                      "group relative border border-stone-200 bg-white p-4 transition-colors hover:border-stone-300",
                      !item.isAvailable && "opacity-60"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
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

            <div className="grid grid-cols-2 gap-4">
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
