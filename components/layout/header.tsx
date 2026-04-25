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
        background: "rgba(5, 9, 15, 0.7)",
        backdropFilter: "blur(20px) saturate(1.5)",
        WebkitBackdropFilter: "blur(20px) saturate(1.5)",
        borderBottom: "1px solid rgba(0, 229, 255, 0.08)",
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
          style={{ color: "#7A9A82" }}
        >
          {/* Breadcrumb placeholder */}
        </div>
      </div>

      <div className="flex items-center gap-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="flex items-center gap-3 rounded-lg px-2 py-1.5 transition-colors"
              style={{ color: "#EEF8F1" }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(255, 255, 255, 0.04)";
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
                    color: "#EEF8F1",
                    margin: 0,
                  }}
                >
                  {user?.name}
                </p>
                <p
                  style={{
                    fontSize: 11.5,
                    color: "#7A9A82",
                    margin: 0,
                  }}
                >
                  {roleLabel}
                </p>
              </div>
              <Avatar className="h-8 w-8">
                <AvatarFallback
                  style={{
                    background: "rgba(0, 229, 255, 0.12)",
                    border: "1px solid rgba(0, 229, 255, 0.22)",
                    color: "#00E5FF",
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
              <p className="text-xs font-normal" style={{ color: "#7A9A82" }}>
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
              style={{ color: "#ff5577" }}
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
