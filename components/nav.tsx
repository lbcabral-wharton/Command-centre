"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  User,
  TrendingUp,
  Rocket,
  Bell,
  LogOut,
} from "lucide-react";

const links = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/personal", label: "Personal", icon: User },
  { href: "/finance", label: "Finance", icon: TrendingUp },
  { href: "/ventures", label: "Ventures", icon: Rocket },
];

type SessionUser = {
  name?: string | null;
  email?: string | null;
  image?: string | null;
} | null;

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

function Logo() {
  return (
    <div className="flex items-center justify-between">
      <Link href="/" className="flex items-baseline gap-1.5">
        <span className="text-primary text-lg">⌘</span>
        <span className="font-display text-xl font-semibold tracking-tight text-foreground">
          Centre
        </span>
      </Link>
      <button
        type="button"
        aria-label="Notifications"
        className="text-muted-foreground hover:text-foreground transition-colors"
      >
        <Bell className="w-4 h-4" />
      </button>
    </div>
  );
}

export function Sidebar({ user }: { user: SessionUser }) {
  const pathname = usePathname();

  const initials =
    user?.name
      ?.split(" ")
      .map((n) => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() ?? "?";

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex fixed inset-y-0 left-0 w-64 flex-col gap-6 border-r border-border bg-card/70 backdrop-blur-sm px-4 py-5">
        <Logo />

        <nav className="flex-1">
          <p className="px-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70 mb-2">
            Account
          </p>
          <div className="space-y-1">
            {links.map(({ href, label, icon: Icon }) => {
              const active = isActive(pathname, href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-colors",
                    active
                      ? "bg-accent text-primary font-medium"
                      : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </Link>
              );
            })}
          </div>
        </nav>

        {/* User footer */}
        <div className="border-t border-border pt-4">
          <div className="flex items-center gap-3 px-1">
            {user?.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={user.image}
                alt={user.name ?? "User"}
                className="w-9 h-9 rounded-full object-cover"
              />
            ) : (
              <div className="w-9 h-9 rounded-full bg-primary/15 text-primary flex items-center justify-center text-xs font-medium">
                {initials}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground truncate">
                {user?.name ?? "Signed in"}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {user?.email ?? ""}
              </p>
            </div>
            <a
              href="/api/auth/signout"
              aria-label="Sign out"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </a>
          </div>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="md:hidden sticky top-0 z-40 flex items-center justify-between border-b border-border bg-card/80 backdrop-blur-sm px-4 h-14">
        <Link href="/" className="flex items-baseline gap-1.5">
          <span className="text-primary text-lg">⌘</span>
          <span className="font-display text-lg font-semibold tracking-tight text-foreground">
            Centre
          </span>
        </Link>
        <nav className="flex items-center gap-1">
          {links.map(({ href, label, icon: Icon }) => {
            const active = isActive(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                aria-label={label}
                className={cn(
                  "p-2 rounded-lg transition-colors",
                  active
                    ? "bg-accent text-primary"
                    : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
                )}
              >
                <Icon className="w-5 h-5" />
              </Link>
            );
          })}
        </nav>
      </header>
    </>
  );
}
