"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { cn } from "@/lib/utils";
import { getRoleDisplayName } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";

function getNavLinks(role: string) {
  const links = [{ href: "/dashboard", label: "Dashboard" }];

  // All roles are employees first - everyone gets results
  links.push({ href: "/my-reviews", label: "My Reviews" });

  if (["MANAGER", "AREA_LEAD", "LEADERSHIP", "ADMIN"].includes(role)) {
    links.push({ href: "/team", label: "My Team" });
    links.push({ href: "/calibration", label: "Analysis" });
  }

  links.push({ href: "/resources", label: "Resources" });

  if (role === "ADMIN") {
    links.push({ href: "/admin", label: "Admin" });
  }

  return links;
}

export function Navbar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);
  const role = session?.user?.role || "EMPLOYEE";
  const navLinks = getNavLinks(role);

  return (
    <nav className="bg-visory-navy sticky top-0 z-50 no-print">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center gap-8">
            <Link
              href="/dashboard"
              className="text-lg font-bold text-visory font-heading"
            >
              Visory
            </Link>
            <div className="hidden md:flex items-center gap-1">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                    pathname.startsWith(link.href)
                      ? "bg-white/15 text-white"
                      : "text-white/70 hover:bg-white/10 hover:text-white"
                  )}
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>

          <div className="hidden md:flex items-center gap-3">
            {role !== "EMPLOYEE" && (
              <Badge className="bg-white/15 text-white border-white/20 text-xs">
                {getRoleDisplayName(role)}
              </Badge>
            )}
            <span className="text-sm text-white/80">
              {session?.user?.name}
            </span>
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="text-sm text-white/60 hover:text-white font-medium"
            >
              Sign Out
            </button>
          </div>

          <button
            className="md:hidden p-2 text-white/80 hover:text-white"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              {menuOpen ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              )}
            </svg>
          </button>
        </div>

        {menuOpen && (
          <div className="md:hidden pb-4 space-y-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className={cn(
                  "block px-3 py-2 rounded-lg text-sm font-medium",
                  pathname.startsWith(link.href)
                    ? "bg-white/15 text-white"
                    : "text-white/70 hover:bg-white/10 hover:text-white"
                )}
              >
                {link.label}
              </Link>
            ))}
            <div className="border-t border-white/20 pt-2 mt-2 px-3">
              <p className="text-sm text-white/80 mb-1">
                {session?.user?.name}
              </p>
              {role !== "EMPLOYEE" && (
                <Badge className="bg-white/15 text-white border-white/20 text-xs mb-2">
                  {getRoleDisplayName(role)}
                </Badge>
              )}
              <button
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="block text-sm text-visory font-medium mt-2"
              >
                Sign Out
              </button>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
