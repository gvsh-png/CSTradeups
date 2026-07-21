import type { ReactNode } from "react";
import { csfloatUrl, steamMarketUrl } from "@/lib/marketLinks";

type Props = {
  skinName: string;
  wear: string;
  className?: string;
};

function LinkBtn({
  href,
  title,
  children,
}: {
  href: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={title}
      aria-label={title}
      onClick={(e) => e.stopPropagation()}
      className="inline-flex h-6 w-6 items-center justify-center rounded border border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)] transition-colors duration-150 hover:border-accent/40 hover:text-accent"
    >
      {children}
    </a>
  );
}

/** Steam + CSFloat icons to verify an item's live market price */
export default function MarketLinks({ skinName, wear, className = "" }: Props) {
  return (
    <div className={`flex shrink-0 items-center gap-1 ${className}`}>
      <LinkBtn
        href={steamMarketUrl(skinName, wear)}
        title={`Steam Market — ${skinName} (${wear})`}
      >
        {/* Steam mark */}
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor">
          <path d="M12 2a10 10 0 0 0-10 9.25l5.5 2.27a2.7 2.7 0 0 1 1.5-.45c.1 0 .2 0 .3.02l2.45-3.55v-.05A3.75 3.75 0 1 1 15.5 13l-3.5 2.5c0 .1.02.2.02.3a2.7 2.7 0 1 1-2.7-2.7h.08l3.4-2.48A10 10 0 1 0 12 2zm-5.3 14.2-4.05-1.67A7.55 7.55 0 0 0 12.05 19.5a2.7 2.7 0 0 1-5.35-3.3zm8.05-6.45a2.25 2.25 0 1 0 2.25 2.25 2.25 2.25 0 0 0-2.25-2.25zm0 3.75a1.5 1.5 0 1 1 1.5-1.5 1.5 1.5 0 0 1-1.5 1.5z" />
        </svg>
      </LinkBtn>
      <LinkBtn
        href={csfloatUrl(skinName, wear)}
        title={`CSFloat — ${skinName} (${wear})`}
      >
        {/* Simple float/market mark */}
        <svg
          viewBox="0 0 24 24"
          className="h-3.5 w-3.5"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3 7h18M6 7v10a2 2 0 002 2h8a2 2 0 002-2V7M9 11h6M9 15h4"
          />
        </svg>
      </LinkBtn>
    </div>
  );
}
