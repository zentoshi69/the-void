"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { clsx } from "clsx";

interface NavItem {
  label: string;
  href: string;
  icon: string;
}

const navigation: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: "⌘" },
  { label: "Capital", href: "/dashboard/capital", icon: "◈" },
  { label: "Markets", href: "/dashboard/markets", icon: "◉" },
  { label: "Strategies", href: "/dashboard/strategies", icon: "△" },
  { label: "Orders", href: "/dashboard/orders", icon: "⬡" },
  { label: "Positions", href: "/dashboard/positions", icon: "◧" },
  { label: "Risk", href: "/dashboard/risk", icon: "⚡" },
  { label: "Simulation", href: "/dashboard/simulation", icon: "⟳" },
  { label: "Admin", href: "/dashboard/admin", icon: "⛭" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 z-30 flex h-screen w-60 flex-col border-r border-void-border bg-void-bg-secondary">
      <div className="flex h-14 items-center px-6">
        <Link href="/dashboard" className="flex items-center gap-2">
          <span className="text-lg font-bold tracking-tight text-void-accent">THE VOID</span>
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="space-y-1">
          {navigation.map((item) => {
            const isActive =
              item.href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname.startsWith(item.href);

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={clsx(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "border-l-2 border-void-accent bg-void-bg-primary text-void-text-primary"
                      : "text-void-text-secondary hover:bg-void-bg-tertiary hover:text-void-text-primary",
                  )}
                >
                  <span className="w-5 text-center text-base">{item.icon}</span>
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-void-border px-4 py-3">
        <p className="font-mono text-xs text-void-text-tertiary">v0.1.0 — Phase 0</p>
      </div>
    </aside>
  );
}
