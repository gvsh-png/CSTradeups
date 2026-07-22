"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import AuthMenu from "./AuthMenu";
import CurrencySelect from "./CurrencySelect";
import { useSaved } from "./SavedProvider";

/** Desktop: Home + Generate + Saved + Profile. Mobile tabs match Stitch: Generate / Saved / Profile */
const DESKTOP_NAV = [
  { href: "/", label: "Home", match: (p: string) => p === "/" },
  {
    href: "/generate",
    label: "Generate",
    match: (p: string) => p.startsWith("/generate"),
  },
  {
    href: "/saved",
    label: "Saved",
    match: (p: string) => p.startsWith("/saved"),
  },
  {
    href: "/profile",
    label: "Profile",
    match: (p: string) =>
      p.startsWith("/profile") || p.startsWith("/subscription"),
  },
] as const;

const MOBILE_NAV = [
  {
    href: "/generate",
    label: "Generate",
    icon: "scan" as const,
    match: (p: string) => p === "/" || p.startsWith("/generate"),
  },
  {
    href: "/saved",
    label: "Saved",
    icon: "saved" as const,
    match: (p: string) => p.startsWith("/saved"),
  },
  {
    href: "/profile",
    label: "Profile",
    icon: "profile" as const,
    match: (p: string) =>
      p.startsWith("/profile") || p.startsWith("/subscription"),
  },
] as const;

function NavIcon({ name, active }: { name: string; active?: boolean }) {
  const cls = `w-[20px] h-[20px] ${active ? "text-accent" : ""}`;
  switch (name) {
    case "scan":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.5 9V5.5A2 2 0 015.5 3.5H9M20.5 9V5.5A2 2 0 0018.5 3.5H15M3.5 15v3.5A2 2 0 005.5 20.5H9M20.5 15v3.5a2 2 0 01-2 2H15M7 12h10" />
        </svg>
      );
    case "saved":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 4h12a1 1 0 0 1 1 1v15l-7-3.5L5 20V5a1 1 0 0 1 1-1z" />
        </svg>
      );
    default:
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 20a8 8 0 0 1 16 0" />
        </svg>
      );
  }
}

type Props = {
  children: ReactNode;
  onUpgrade?: () => void;
  hideMobileTabs?: boolean;
};

export default function AppShell({
  children,
  onUpgrade,
  hideMobileTabs,
}: Props) {
  const pathname = usePathname();
  const { saved } = useSaved();
  const savedCount = saved.length;

  return (
    <div className="min-h-dvh flex flex-col relative z-[1]">
      <header className="header-shell">
        <div className="mx-auto max-w-container px-4 sm:px-6 h-12 flex items-center justify-between gap-3">
          <div className="flex items-center gap-6 lg:gap-10 min-w-0">
            <Link href="/" className="flex items-center gap-2 shrink-0 group">
              <span className="text-accent inline-flex">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <path d="M12 2L4 20h3.2l1.5-3.5h6.6L16.8 20H20L12 2zm0 5.2l2.4 5.8H9.6L12 7.2z" />
                </svg>
              </span>
              <span className="font-bold tracking-tight text-accent text-[15px] sm:text-base">
                CSTradeups
              </span>
            </Link>

            <nav className="hidden md:flex items-center gap-1 h-12">
              {DESKTOP_NAV.filter((n) => n.href !== "/").map((item) => {
                const active = item.match(pathname);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`relative h-12 inline-flex items-center px-3 text-[12px] font-semibold tracking-wide transition-colors duration-150 ${
                      active
                        ? "text-accent"
                        : "text-[var(--text-soft)] hover:text-[var(--text)]"
                    }`}
                  >
                    {item.label}
                    {item.href === "/saved" && savedCount > 0 && (
                      <span className="ml-1.5 text-[10px] font-mono text-accent/80">
                        {savedCount > 9 ? "9+" : savedCount}
                      </span>
                    )}
                    {active && (
                      <span className="absolute inset-x-2 bottom-0 h-0.5 bg-accent rounded-full" />
                    )}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <CurrencySelect />
            <AuthMenu onUpgrade={onUpgrade ?? (() => {})} />
          </div>
        </div>
      </header>

      <main
        className={`flex-1 relative z-10 w-full ${
          hideMobileTabs ? "" : "pb-[4.25rem] lg:pb-0"
        }`}
      >
        {children}
      </main>

      {!hideMobileTabs && (
        <nav className="mobile-tabbar" aria-label="Primary">
          <div className="mx-auto max-w-container flex h-14 items-stretch justify-around px-2">
            {MOBILE_NAV.map((item) => {
              const active = item.match(pathname);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-semibold transition-colors duration-150 ${
                    active ? "text-accent" : "text-[var(--text-muted)]"
                  }`}
                >
                  <NavIcon name={item.icon} active={active} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
}
