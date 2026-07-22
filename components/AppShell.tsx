"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import AuthMenu from "./AuthMenu";
import CurrencySelect from "./CurrencySelect";
import { useSaved } from "./SavedProvider";

const NAV = [
  { href: "/", label: "Home", icon: "home", match: (p: string) => p === "/" },
  {
    href: "/generate",
    label: "Generate",
    icon: "scan",
    match: (p: string) => p.startsWith("/generate"),
  },
  {
    href: "/saved",
    label: "Saved",
    icon: "saved",
    match: (p: string) => p.startsWith("/saved"),
  },
  {
    href: "/profile",
    label: "Profile",
    icon: "profile",
    match: (p: string) => p.startsWith("/profile") || p.startsWith("/subscription"),
  },
] as const;

function NavIcon({ name, active }: { name: string; active?: boolean }) {
  const cls = `w-[18px] h-[18px] ${active ? "text-accent" : "currentColor"}`;
  switch (name) {
    case "home":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-9.5z" />
        </svg>
      );
    case "scan":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 8V5a1 1 0 0 1 1-1h3M20 8V5a1 1 0 0 0-1-1h-3M4 16v3a1 1 0 0 0 1 1h3M20 16v3a1 1 0 0 1-1 1h-3M8 12h8" />
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
    <div className="min-h-dvh flex flex-col relative">
      <header className="header-shell">
        <div className="mx-auto max-w-container px-4 sm:px-6 h-12 lg:h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-8 min-w-0">
            <Link
              href="/"
              className="flex items-center gap-2 shrink-0 group"
            >
              <span className="inline-flex h-7 w-7 items-center justify-center rounded border border-accent/35 bg-accent/10 text-accent">
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" d="M4 20 L12 4 L20 20 Z" />
                  <path strokeLinecap="round" d="M8 14 h8" />
                </svg>
              </span>
              <span className="font-semibold tracking-tight text-accent text-[15px] lg:text-base">
                CSTradeups
              </span>
            </Link>

            <nav className="hidden lg:flex items-center gap-1 h-full">
              {NAV.map((item) => {
                const active = item.match(pathname);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`relative h-14 inline-flex items-center px-3 text-[12px] font-mono uppercase tracking-[0.12em] transition-colors ${
                      active
                        ? "text-accent"
                        : "text-[var(--text-soft)] hover:text-[var(--text)]"
                    }`}
                  >
                    {item.label}
                    {item.href === "/saved" && savedCount > 0 && (
                      <span className="ml-1.5 text-[10px] text-accent/80">
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
          hideMobileTabs ? "" : "pb-20 lg:pb-0"
        }`}
      >
        {children}
      </main>

      {!hideMobileTabs && (
        <nav className="mobile-tabbar" aria-label="Primary">
          <div className="mx-auto max-w-container flex h-[3.75rem] items-stretch justify-around px-1">
            {NAV.map((item) => {
              const active = item.match(pathname);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors ${
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
