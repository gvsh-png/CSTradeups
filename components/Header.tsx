"use client";

type Tab = "generate" | "saved";

interface HeaderProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  savedCount: number;
  /** Currency select — left of auth/profile */
  currencySlot?: React.ReactNode;
  authSlot?: React.ReactNode;
}

export default function Header({
  activeTab,
  onTabChange,
  savedCount,
  currencySlot,
  authSlot,
}: HeaderProps) {
  return (
    <header className="sticky top-0 z-50 border-b border-[var(--border)] bg-[var(--bg)]/85 backdrop-blur-xl header-desktop">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14 lg:h-16 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 shrink-0 rounded-md border border-accent/35 bg-gradient-to-br from-accent/15 to-transparent flex items-center justify-center shadow-[0_0_24px_-8px_rgba(212,168,75,0.45)]">
              <svg
                className="w-3.5 h-3.5 text-accent"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" d="M4 20 L12 4 L20 20 Z" />
                <path strokeLinecap="round" d="M8 14 h8" />
              </svg>
            </div>
            <div className="min-w-0">
              <h1 className="text-sm lg:text-[15px] font-semibold tracking-tight font-mono uppercase truncate leading-none">
                TradeUp<span className="text-accent">.gen</span>
              </h1>
              <p className="hidden lg:block text-[10px] font-mono text-[var(--text-muted)] mt-1 tracking-wide">
                CS2 contract scanner
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <nav className="flex shrink-0 gap-0.5 p-0.5 rounded-md border border-[var(--border)] bg-[var(--surface)]/80">
              {(["generate", "saved"] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => onTabChange(tab)}
                  className={`px-3 sm:px-4 py-1.5 rounded text-xs font-medium transition-colors duration-150 ${
                    activeTab === tab
                      ? "bg-[var(--surface-raised)] text-[var(--text)] shadow-sm"
                      : "text-[var(--text-muted)] hover:text-[var(--text)]"
                  }`}
                >
                  {tab === "generate" ? "Scan" : "Saved"}
                  {tab === "saved" && savedCount > 0 && (
                    <span className="ml-1.5 text-[10px] font-mono text-accent">
                      {savedCount > 9 ? "9+" : savedCount}
                    </span>
                  )}
                </button>
              ))}
            </nav>
            {currencySlot}
            {authSlot}
            {/* Placeholder for future Steam profile avatar */}
            <div
              className="hidden lg:flex h-8 w-8 items-center justify-center rounded-md border border-dashed border-[var(--border)] text-[10px] font-mono text-[var(--text-muted)]/50"
              title="Profile coming soon"
              aria-hidden
            >
              ···
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
