"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useTheme } from "next-themes";
import { Bookmark, Home, Layers, LogIn, LogOut, Moon, Search, Shuffle, Sun, UserRound, Zap } from "lucide-react";
import { useSearch } from "./search";
import { useAuth } from "@/lib/progress/sync";
import { cn } from "@/lib/utils";

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
            <span>
              prep<span className="hl-mark">os</span>
            </span>
          </Link>
          <nav className="hidden items-center gap-0.5 md:flex" aria-label="Main">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                aria-current={n.match(pathname) ? "page" : undefined}
                className={cn(
                  "rounded-md px-3 py-1.5 text-[14px] text-ink-2 hover:bg-sunken hover:text-ink",
                  n.match(pathname) && "bg-sunken font-medium text-ink",
                )}
              >
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-1">
            <button
              onClick={open}
              className="flex h-9 items-center gap-2 rounded-lg border border-line bg-surface px-2.5 text-[14px] text-ink-3 hover:border-line-strong md:w-56"
              aria-label="Search questions"
            >
              <Search className="h-4 w-4" aria-hidden />
              <span className="hidden md:inline">Search</span>
              <kbd className="ml-auto hidden rounded border border-line px-1.5 font-sans text-[11px] md:inline">⌘K</kbd>
            </button>
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
                  className={cn("flex flex-col items-center gap-0.5 py-2 text-[11px]", active ? "text-blue" : "text-ink-3")}
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
      <rect x="3" y="3" width="18" height="18" rx="4" fill="var(--blue)" />
      <path d="M8 8.5h5.2a2.6 2.6 0 0 1 0 5.2H10.4V16" stroke="var(--surface)" strokeWidth="2" fill="none" strokeLinecap="round" />
      <rect x="6" y="17.6" width="12" height="2.4" rx="1.2" fill="var(--hl)" />
    </svg>
  );
}

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const dark = mounted && resolvedTheme === "dark";
  return (
    <button
      onClick={() => setTheme(dark ? "light" : "dark")}
      className="grid h-9 w-9 place-items-center rounded-lg text-ink-2 hover:bg-sunken"
      aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
    >
      {mounted ? dark ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" /> : <span className="h-[18px] w-[18px]" />}
    </button>
  );
}

function AccountMenu() {
  const { enabled, user, loading, signIn, signOut, syncError } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!enabled) return null;
  if (loading) return <span className="h-9 w-9" />;

  if (!user)
    return (
      <button onClick={signIn} className="flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-[14px] font-medium text-blue hover:bg-blue-soft">
        <LogIn className="h-4 w-4" aria-hidden />
        <span className="hidden sm:inline">Sign in</span>
      </button>
    );

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="grid h-9 w-9 place-items-center overflow-hidden rounded-full border border-line"
        aria-label="Account"
        aria-expanded={open}
      >
        {user.photoURL ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={user.photoURL} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
        ) : (
          <UserRound className="h-4 w-4" />
        )}
      </button>
      {syncError && <span className="absolute right-0 top-0 h-2.5 w-2.5 rounded-full border-2 border-paper bg-[var(--lv-hard)]" />}
      {open && (
        <div className="absolute right-0 top-11 w-64 rounded-xl border border-line bg-surface p-2 shadow-xl">
          <div className="px-2 py-1.5">
            <div className="truncate text-[14px] font-medium">{user.displayName ?? "Signed in"}</div>
            <div className="truncate text-[12px] text-ink-3">{user.email}</div>
          </div>
          <p className="px-2 pb-2 text-[12px] text-ink-3">
            {syncError ? `Progress isn't syncing: ${syncError}` : "Progress syncs across your devices."}
          </p>
          <button
            onClick={() => {
              setOpen(false);
              signOut();
            }}
            className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-[14px] text-ink-2 hover:bg-sunken"
          >
            <LogOut className="h-4 w-4" aria-hidden /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}
