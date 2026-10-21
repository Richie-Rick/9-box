"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import {
  LayoutDashboard,
  ClipboardCheck,
  SquareCheckBig,
  Target,
  Users,
  Grid2x2,
  KanbanSquare,
  BookOpen,
  Settings,
  LogOut,
  type LucideIcon,
} from "lucide-react";
import { cn, getRoleDisplayName } from "@/lib/utils";
import { Avatar } from "@/components/ui/avatar";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}
interface NavSection {
  title: string;
  roles?: string[];
  items: NavItem[];
}

const NAV: NavSection[] = [
  {
    title: "Overview",
    items: [{ href: "/dashboard", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    title: "You",
    items: [
      { href: "/my-reviews", label: "My Reviews", icon: ClipboardCheck },
      { href: "/goals", label: "Goals & Metrics", icon: Target },
      { href: "/tasks", label: "Tasks", icon: SquareCheckBig },
    ],
  },
  {
    title: "Team",
    roles: ["MANAGER", "AREA_LEAD", "LEADERSHIP", "ADMIN"],
    items: [
      { href: "/team", label: "My Team", icon: Users },
      { href: "/team/cycles", label: "Assessment Cycles", icon: KanbanSquare },
      { href: "/calibration", label: "Analysis", icon: Grid2x2 },
    ],
  },
  {
    title: "Library",
    items: [{ href: "/resources", label: "Resources", icon: BookOpen }],
  },
  {
    title: "Admin",
    roles: ["ADMIN"],
    items: [{ href: "/admin", label: "Admin", icon: Settings }],
  },
];

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const role = session?.user?.role || "EMPLOYEE";
  const name = session?.user?.name || "You";

  const sections = NAV.filter((s) => !s.roles || s.roles.includes(role));

  // Pick the single best match so nested siblings (e.g. /team vs /team/cycles)
  // don't both highlight — the longest matching href wins.
  const activeHref =
    sections
      .flatMap((s) => s.items.map((i) => i.href))
      .filter((h) => pathname === h || pathname.startsWith(h + "/"))
      .sort((a, b) => b.length - a.length)[0] ?? "";

  return (
    <nav className="sidebar">
      <Link href="/dashboard" className="brand" aria-label="Visory — go to dashboard">
        <span className="brand-mark">
          <span className="v-glyph" />
        </span>
        <div>
          <div className="brand-name">Visory</div>
          <div className="brand-sub">Performance &amp; Growth</div>
        </div>
      </Link>

      <div className="nav flex-1 overflow-y-auto">
        {sections.map((section) => (
          <div key={section.title}>
            <div className="nav-section">{section.title}</div>
            {section.items.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  className={cn("nav-item", item.href === activeHref && "active")}
                >
                  <span className="ico">
                    <Icon size={16} strokeWidth={1.6} />
                  </span>
                  {item.label}
                </Link>
              );
            })}
          </div>
        ))}
      </div>

      <div className="sidebar-foot">
        <Avatar name={name} size="md" />
        <div className="meta flex-1 min-w-0">
          <div className="truncate">{name}</div>
          <small>{getRoleDisplayName(role)}</small>
        </div>
        <button
          type="button"
          className="icon-btn"
          aria-label="Sign out"
          onClick={() => signOut({ callbackUrl: "/login" })}
        >
          <LogOut size={16} />
        </button>
      </div>
    </nav>
  );
}
