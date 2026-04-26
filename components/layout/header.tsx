"use client";

import { useSession, signOut } from "next-auth/react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { LogOut, User, Menu } from "lucide-react";
import Link from "next/link";
import { useMobileNav } from "./mobile-nav-context";
import { ThemeToggle } from "@/components/theme-toggle";

const roleLabels: Record<string, string> = {
  super_admin: "Super Admin",
  admin: "Amministratore",
  dentist: "Dentista",
  secretary: "Segreteria",
};

export function Header() {
  const { data: session } = useSession();
  const user = session?.user;
  const { toggle } = useMobileNav();

  const initials = user?.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "??";

  const roleLabel = user?.role ? (roleLabels[user.role] ?? user.role) : "";

  return (
    <header
      className="header-shell flex items-center justify-between px-4 sm:px-6"
      style={{
        background: "var(--app-header-bg)",
        backdropFilter: "blur(20px) saturate(1.5)",
        WebkitBackdropFilter: "blur(20px) saturate(1.5)",
        borderBottom: "1px solid var(--border)",
      }}
    >
      {/* Left side — hamburger on mobile only */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="header-hamburger"
          onClick={toggle}
          aria-label="Apri menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div
          className="hidden sm:flex items-center gap-2 text-sm"
          style={{ color: "var(--app-text-mid)" }}
        >
          {/* Breadcrumb placeholder */}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <ThemeToggle />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="flex items-center gap-3 rounded-lg px-2 py-1.5 transition-colors"
              style={{ color: "var(--foreground)" }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "var(--app-hover-bg)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
              }}
            >
              <div className="text-right hidden sm:block">
                <p
                  style={{
                    fontSize: 13.5,
                    fontWeight: 600,
                    color: "var(--foreground)",
                    margin: 0,
                  }}
                >
                  {user?.name}
                </p>
                <p
                  style={{
                    fontSize: 11.5,
                    color: "var(--app-text-mid)",
                    margin: 0,
                  }}
                >
                  {roleLabel}
                </p>
              </div>
              <Avatar className="h-8 w-8">
                <AvatarFallback
                  style={{
                    background: "var(--app-icon-bg)",
                    border: "1px solid var(--app-icon-border)",
                    color: "var(--primary)",
                    fontSize: 11,
                    fontWeight: 700,
                  }}
                >
                  {initials}
                </AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel>
              <p className="font-medium">{user?.name}</p>
              <p
                className="text-xs font-normal"
                style={{ color: "var(--app-text-mid)" }}
              >
                {user?.email}
              </p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link
                href="/dashboard/settings"
                className="flex items-center gap-2 cursor-pointer"
              >
                <User className="h-4 w-4" />
                Profilo
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="cursor-pointer"
              style={{ color: "var(--app-danger)" }}
            >
              <LogOut className="h-4 w-4 mr-2" />
              Esci
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
