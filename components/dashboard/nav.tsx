"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useCallback } from "react";
import {
  IconLayoutDashboard,
  IconShoppingCart,
  IconToolsKitchen2,
  IconSettings,
  IconDeviceDesktop,
  IconLogout,
  IconLoader2,
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Übersicht", icon: IconLayoutDashboard },
  { href: "/dashboard/orders", label: "Bestellungen", icon: IconShoppingCart },
  { href: "/dashboard/menu", label: "Speisekarte", icon: IconToolsKitchen2 },
  { href: "/dashboard/settings", label: "Einstellungen", icon: IconSettings },
  { href: "/dashboard/analytics", label: "Anzeige", icon: IconDeviceDesktop },
];

function LogoutButton({ mobile }: { mobile?: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleLogout = useCallback(async () => {
    setLoading(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
    } catch {
      setLoading(false);
    }
  }, [router]);

  if (mobile) {
    return (
      <button
        onClick={handleLogout}
        disabled={loading}
        className="flex flex-1 flex-col items-center justify-center gap-1 py-2 text-muted-foreground"
      >
        {loading ? (
          <IconLoader2 className="h-5 w-5 animate-spin" />
        ) : (
          <IconLogout className="h-5 w-5" />
        )}
        <span className="text-[10px] font-medium">Abmelden</span>
      </button>
    );
  }

  return (
    <button
      onClick={handleLogout}
      disabled={loading}
      className="flex w-full items-center gap-3 px-3 py-2 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent disabled:opacity-50"
    >
      {loading ? (
        <IconLoader2 className="h-4 w-4 animate-spin" />
      ) : (
        <IconLogout className="h-4 w-4" />
      )}
      Abmelden
    </button>
  );
}

export function DashboardNav({ mobile }: { mobile?: boolean }) {
  const pathname = usePathname();

  if (mobile) {
    return (
      <nav className="fixed inset-x-0 bottom-0 z-50 flex border-t border-border bg-background md:hidden">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-1 flex-col items-center justify-center gap-1 py-2",
                isActive ? "text-primary" : "text-muted-foreground"
              )}
            >
              <item.icon className="h-5 w-5" />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}
        <LogoutButton mobile />
      </nav>
    );
  }

  return (
    <nav className="flex flex-1 flex-col px-2 py-2">
      <div className="flex-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-sidebar-foreground hover:bg-sidebar-accent"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </div>

      {/* Logout at bottom */}
      <div className="border-t border-sidebar-border pt-2">
        <LogoutButton />
      </div>
    </nav>
  );
}
