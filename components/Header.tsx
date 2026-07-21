"use client";

type Tab = "generate" | "saved";

interface HeaderProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  savedCount: number;
}

export default function Header({ activeTab, onTabChange, savedCount }: HeaderProps) {
  return (
    <header className="sticky top-0 z-50 border-b border-[var(--border)] bg-[var(--bg)]/90 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-md border border-accent/30 bg-accent/5 flex items-center justify-center">
              <svg className="w-3.5 h-3.5 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" d="M4 20 L12 4 L20 20 Z" />
                <path strokeLinecap="round" d="M8 14 h8" />
              </svg>
            </div>
            <div>
              <h1 className="text-sm font-semibold tracking-tight font-mono uppercase">
                TradeUp<span className="text-accent">.gen</span>
              </h1>
            </div>
          </div>

          <nav className="flex gap-0.5 p-0.5 rounded-md border border-[var(--border)] bg-[var(--surface)]">
            {(["generate", "saved"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => onTabChange(tab)}
                className={`relative px-3 sm:px-4 py-1.5 rounded text-xs font-medium transition-colors duration-150 ${
                  activeTab === tab
                    ? "bg-[var(--surface-raised)] text-[var(--text)]"
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
        </div>
      </div>
    </header>
  );
}
