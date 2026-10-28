"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { useTheme } from "next-themes";
import { Bookmark, Home, Layers, LogIn, LogOut, Moon, Search, Shuffle, Sun, UserRound, Zap } from "lucide-react";
import { useSearch } from "./search";
import { useAuth } from "@/lib/progress/sync";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

const NAV = [
  { href: "/", label: "Home", icon: Home, match: (p: string) => p === "/" },
  { href: "/tracks", label: "Tracks", icon: Layers, match: (p: string) => p.startsWith("/tracks") },
  { href: "/revise", label: "Revise", icon: Zap, match: (p: string) => p.startsWith("/revise") },
  { href: "/mock", label: "Mock", icon: Shuffle, match: (p: string) => p.startsWith("/mock") },
  { href: "/saved", label: "Saved", icon: Bookmark, match: (p: string) => p.startsWith("/saved") },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { open } = useSearch();
  const immersive = pathname.startsWith("/revise/");

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 border-b border-line bg-paper/85 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-2 px-4">
          <Link href="/" className="mr-2 flex items-center gap-2 font-serif text-[19px] font-semibold tracking-tight">
            <Logo />
            <span>prepos</span>
          </Link>
          <nav className="hidden items-center gap-0.5 md:flex" aria-label="Main">
            {NAV.map((n) => (
              <Button
                key={n.href}
                asChild
                variant="ghost"
                size="sm"
                className={cn("text-[14px]", n.match(pathname) && "bg-sunken font-medium text-ink")}
              >
                <Link href={n.href} aria-current={n.match(pathname) ? "page" : undefined}>
                  {n.label}
                </Link>
              </Button>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-1">
            <Button variant="outline" onClick={open} aria-label="Search questions" className="h-9 justify-start px-2.5 text-ink-3 md:w-56">
              <Search aria-hidden />
              <span className="hidden md:inline">Search</span>
              <Kbd className="ml-auto hidden md:inline-flex">⌘K</Kbd>
            </Button>
            <ThemeToggle />
            <AccountMenu />
          </div>
        </div>
      </header>

      <main className={cn("mx-auto w-full max-w-5xl flex-1 px-4", immersive ? "pb-4" : "pb-28 md:pb-16")}>{children}</main>

      {!immersive && (
        <nav
          className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden"
          aria-label="Main"
        >
          <div className="grid grid-cols-5">
            {NAV.map((n) => {
              const active = n.match(pathname);
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  aria-current={active ? "page" : undefined}
                  className={cn("flex flex-col items-center gap-0.5 py-2 text-[11px]", active ? "text-primary" : "text-ink-3")}
                >
                  <n.icon className="h-5 w-5" strokeWidth={active ? 2.2 : 1.75} aria-hidden />
                  {n.label}
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
}

function Logo() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="4" className="fill-primary" />
      <path d="M8 8.5h5.2a2.6 2.6 0 0 1 0 5.2H10.4V16" className="stroke-primary-foreground" strokeWidth="2" fill="none" strokeLinecap="round" />
      <rect x="6" y="17.6" width="12" height="2.4" rx="1.2" className="fill-hl" />
    </svg>
  );
}

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const dark = mounted && resolvedTheme === "dark";
  const label = dark ? "Switch to light theme" : "Switch to dark theme";
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon" onClick={() => setTheme(dark ? "light" : "dark")} aria-label={label}>
          {mounted ? dark ? <Sun className="size-[18px]" /> : <Moon className="size-[18px]" /> : <Skeleton className="size-[18px] rounded-full" />}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function AccountMenu() {
  const { enabled, user, loading, signIn, signOut, syncError } = useAuth();

  if (!enabled) return null;
  if (loading) return <Skeleton className="size-9 rounded-full" />;

  if (!user)
    return (
      <Button variant="ghost" onClick={signIn} className="text-primary hover:text-primary">
        <LogIn aria-hidden />
        <span className="hidden sm:inline">Sign in</span>
      </Button>
    );

  return (
    <div className="relative">
      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" shape="pill" aria-label="Account" className="overflow-hidden p-0">
                {user.photoURL ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={user.photoURL} alt="" className="size-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <UserRound />
                )}
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent>Account</TooltipContent>
        </Tooltip>
        <DropdownMenuContent className="w-64">
          <DropdownMenuLabel className="font-normal">
            <div className="truncate font-medium">{user.displayName ?? "Signed in"}</div>
            <div className="truncate text-[12px] text-ink-3">{user.email}</div>
          </DropdownMenuLabel>
          <p className="px-2.5 pb-1.5 text-[12px] text-ink-3">
            {syncError ? `Progress isn't syncing: ${syncError}` : "Progress syncs across your devices."}
          </p>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => signOut()}>
            <LogOut /> Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {syncError && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge role="img" aria-label={`Sync error: ${syncError}`} className="absolute right-0 top-0 size-2.5 rounded-full border-2 border-paper bg-lv-hard p-0" />
          </TooltipTrigger>
          <TooltipContent>{`Progress isn't syncing: ${syncError}`}</TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}
