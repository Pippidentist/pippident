"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Calendar,
  Clock,
  Users,
  Stethoscope,
  Bell,
  Settings,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useMobileNav } from "./mobile-nav-context";

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Calendario", href: "/dashboard/calendar", icon: Calendar },
  { label: "In Attesa", href: "/dashboard/appointments/pending", icon: Clock },
  { label: "Pazienti", href: "/dashboard/patients", icon: Users },
  { label: "Cure", href: "/dashboard/treatments", icon: Stethoscope },
  { label: "Richiami", href: "/dashboard/recalls", icon: Bell },
  { label: "Impostazioni", href: "/dashboard/settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const { open, setOpen } = useMobileNav();

  return (
    <>
      {/* Mobile backdrop — only rendered when drawer is open on small screens */}
      <div
        className="sidebar-backdrop"
        data-open={open}
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />

      <aside
        className="sidebar-shell flex flex-col"
        data-open={open}
        style={{
          background: "var(--app-sidebar-bg)",
          backdropFilter: "blur(20px) saturate(1.4)",
          WebkitBackdropFilter: "blur(20px) saturate(1.4)",
          borderRight: "1px solid var(--app-sidebar-border)",
        }}
      >
        {/* Logo + close button (close only visible on mobile) */}
        <div
          className="h-16 flex items-center justify-between px-6"
          style={{ borderBottom: "1px solid var(--app-sidebar-divider)" }}
        >
          <Link
            href="/dashboard"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5"
            style={{
              color: "var(--foreground)",
              textDecoration: "none",
              fontFamily: "var(--font-space-grotesk), sans-serif",
            }}
          >
            <Image
              src="/landing/logo.png"
              alt="Pippident"
              width={26}
              height={26}
              style={{ objectFit: "contain" }}
            />
            <span style={{ fontSize: 17, fontWeight: 700, letterSpacing: -0.5 }}>
              Pippident
            </span>
          </Link>
          <button
            type="button"
            className="sidebar-close"
            onClick={() => setOpen(false)}
            aria-label="Chiudi menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/dashboard" && pathname.startsWith(item.href));
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all"
                )}
                style={{
                  color: isActive ? "var(--primary)" : "var(--app-text-mid)",
                  background: isActive
                    ? "rgba(var(--lp-glow-rgb), 0.1)"
                    : "transparent",
                  border: isActive
                    ? "1px solid var(--app-icon-border)"
                    : "1px solid transparent",
                  boxShadow: isActive
                    ? "0 0 16px rgba(var(--lp-glow-rgb), 0.08)"
                    : "none",
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.color = "var(--foreground)";
                    e.currentTarget.style.background = "var(--app-hover-bg)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.color = "var(--app-text-mid)";
                    e.currentTarget.style.background = "transparent";
                  }
                }}
              >
                <Icon className="h-5 w-5 shrink-0" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Footer chip */}
        <div
          style={{
            padding: "16px 16px 18px",
            borderTop: "1px solid var(--app-sidebar-divider-soft)",
            fontSize: 11,
            color: "var(--app-text-faint)",
            letterSpacing: 0.4,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: "var(--primary)",
                display: "inline-block",
                boxShadow: "0 0 8px rgba(var(--lp-glow-rgb), 0.6)",
              }}
            />
            Sistema attivo
          </div>
        </div>
      </aside>
    </>
  );
}
