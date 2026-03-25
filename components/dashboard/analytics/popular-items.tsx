"use client";

interface PopularItemsProps {
  items: { name: string; count: number }[];
}

export function PopularItems({ items }: PopularItemsProps) {
  if (items.length === 0) {
    return (
      <div className="border border-border bg-card p-6">
        <h3 className="text-sm font-semibold">Beliebteste Artikel</h3>
        <p className="mt-4 text-sm text-muted-foreground">Noch keine Daten.</p>
      </div>
    );
  }

  const maxCount = items[0]?.count ?? 1;

  return (
    <div className="border border-border bg-card p-6">
      <h3 className="text-sm font-semibold">Beliebteste Artikel</h3>
      <div className="mt-4 space-y-3">
        {items.map((item, i) => (
          <div key={item.name} className="flex items-center gap-3">
            <span className="w-5 shrink-0 font-mono text-xs text-muted-foreground">
              {i + 1}.
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate text-sm font-medium">{item.name}</span>
                <span className="shrink-0 font-mono text-xs text-muted-foreground">
                  {item.count}x
                </span>
              </div>
              <div className="mt-1 h-1.5 bg-muted">
                <div
                  className="h-full bg-primary"
                  style={{ width: `${(item.count / maxCount) * 100}%` }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
