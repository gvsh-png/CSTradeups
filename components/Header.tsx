"use client";

type Tab = "generate" | "saved";

interface HeaderProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  savedCount: number;
}

export default function Header({ activeTab, onTabChange, savedCount }: HeaderProps) {
  return (
    <header className="border-b border-surface-border bg-surface-raised/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14 sm:h-16">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-accent/20 flex items-center justify-center">
              <svg
                className="w-4 h-4 text-accent"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                />
              </svg>
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-semibold tracking-tight">
                TradeUp Gen
              </h1>
              <p className="text-[10px] sm:text-xs text-[var(--text-muted)] hidden sm:block">
                CS2 Trade-Up Finder
              </p>
            </div>
          </div>

          <nav className="flex gap-1 bg-surface rounded-lg p-1">
            <button
              onClick={() => onTabChange("generate")}
              className={`px-3 sm:px-4 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-colors ${
                activeTab === "generate"
                  ? "bg-accent text-white"
                  : "text-[var(--text-muted)] hover:text-white"
              }`}
            >
              Generate
            </button>
            <button
              onClick={() => onTabChange("saved")}
              className={`px-3 sm:px-4 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-colors relative ${
                activeTab === "saved"
                  ? "bg-accent text-white"
                  : "text-[var(--text-muted)] hover:text-white"
              }`}
            >
              Saved
              {savedCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-profit text-[10px] text-black font-bold flex items-center justify-center">
                  {savedCount > 9 ? "9+" : savedCount}
                </span>
              )}
            </button>
          </nav>
        </div>
      </div>
    </header>
  );
}
