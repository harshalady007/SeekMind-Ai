"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BookMarked, FlaskConical, Home, Menu, Settings, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dropdown,
  DropdownContent,
  DropdownItem,
  DropdownSeparator,
  DropdownTrigger,
} from "@/components/ui/dropdown";
import { Wordmark } from "./wordmark";
import { cn } from "@/lib/utils";

export interface ShellIdentity {
  kind: "user" | "anonymous";
  email: string | null;
}

const NAV_ITEMS = [
  { href: "/", label: "Search", icon: Home },
  { href: "/library", label: "Library", icon: BookMarked },
  { href: "/spaces", label: "Spaces", icon: FlaskConical },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

export function AppShell({
  children,
  demoMode,
  supabaseAuth,
  identity,
}: {
  children: React.ReactNode;
  demoMode: boolean;
  supabaseAuth: boolean;
  identity: ShellIdentity;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = React.useState(false);

  React.useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const signOut = async () => {
    await fetch("/api/auth/signout", { method: "POST" });
    router.push("/");
    router.refresh();
  };

  const navLinks = (onNavigate?: () => void) =>
    NAV_ITEMS.map(({ href, label, icon: Icon }) => {
      const active = pathname === href || (href !== "/" && pathname.startsWith(href));
      return (
        <Link
          key={href}
          href={href}
          onClick={onNavigate}
          aria-current={active ? "page" : undefined}
          className={cn(
            "flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
            active
              ? "bg-graphite-800 text-amber-soft"
              : "text-cream-300 hover:bg-graphite-850 hover:text-cream-50",
          )}
        >
          <Icon className="h-4 w-4" aria-hidden="true" />
          {label}
        </Link>
      );
    });

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 border-b border-graphite-800 bg-graphite-950/90 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-3 px-4">
          <div className="flex items-center gap-3">
            <Wordmark />
            {demoMode && (
              <Badge tone="amber" data-testid="demo-badge">
                Demo data
              </Badge>
            )}
          </div>

          <nav aria-label="Primary" className="hidden items-center gap-1 md:flex">
            {navLinks()}
          </nav>

          <div className="flex items-center gap-2">
            {identity.kind === "user" ? (
              <Dropdown>
                <DropdownTrigger asChild>
                  <Button variant="outline" size="sm" data-testid="account-menu">
                    <span
                      className="h-2 w-2 rounded-full bg-success"
                      aria-hidden="true"
                    />
                    <span className="max-w-36 truncate">
                      {identity.email ?? "Account"}
                    </span>
                  </Button>
                </DropdownTrigger>
                <DropdownContent>
                  <DropdownItem onSelect={() => router.push("/settings")}>
                    Settings
                  </DropdownItem>
                  <DropdownSeparator />
                  <DropdownItem destructive onSelect={signOut} data-testid="sign-out">
                    Sign out
                  </DropdownItem>
                </DropdownContent>
              </Dropdown>
            ) : (
              <Button
                variant="primary"
                size="sm"
                data-testid="sign-in"
                onClick={() =>
                  router.push(
                    supabaseAuth
                      ? `/auth/login?next=${encodeURIComponent(pathname)}`
                      : `/auth/login?next=${encodeURIComponent(pathname)}`,
                  )
                }
              >
                Sign in
              </Button>
            )}

            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              aria-expanded={mobileOpen}
              aria-controls="mobile-nav"
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
              onClick={() => setMobileOpen((v) => !v)}
              data-testid="mobile-menu-toggle"
            >
              {mobileOpen ? (
                <X className="h-5 w-5" aria-hidden="true" />
              ) : (
                <Menu className="h-5 w-5" aria-hidden="true" />
              )}
            </Button>
          </div>
        </div>

        {mobileOpen && (
          <nav
            id="mobile-nav"
            aria-label="Mobile"
            className="border-t border-graphite-800 px-4 py-3 md:hidden"
          >
            <div className="flex flex-col gap-1">
              {navLinks(() => setMobileOpen(false))}
            </div>
          </nav>
        )}
      </header>

      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 pb-16">
        {children}
      </main>

      <footer className="border-t border-graphite-800 py-6">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-2 px-4 text-xs text-graphite-400">
          <span>DeepFind — answers you can trace.</span>
          <span>
            Every factual claim links to its source. Verify anything with one click.
          </span>
        </div>
      </footer>
    </div>
  );
}
