import Link from "next/link";

export default function HomePage() {
  return (
    <div className="relative">
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-[var(--border-subtle)]">
        <div className="pointer-events-none absolute inset-0 industrial-dots opacity-60" />
        <div className="pointer-events-none absolute -top-24 left-1/2 h-72 w-[36rem] -translate-x-1/2 rounded-full bg-accent/[0.07] blur-3xl" />

        <div className="relative mx-auto max-w-container px-4 sm:px-6 py-16 sm:py-24 lg:py-28 text-center animate-fade-up">
          <p className="label mb-4 text-accent/80">CS2 contract scanner</p>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-[var(--text)] max-w-3xl mx-auto leading-[1.05]">
            <span className="text-accent">CSTradeups</span>
            <span className="block mt-2 sm:mt-3 text-[0.72em] font-semibold text-[var(--text)]">
              Precision trade-up engineering
            </span>
          </h1>
          <p className="mt-5 sm:mt-6 text-sm sm:text-base text-[var(--text-soft)] max-w-xl mx-auto leading-relaxed">
            Find profitable CS2 trade-ups with live market prices, float
            targets, and expected-value math — built for traders who run
            contracts, not guesswork.
          </p>

          <div className="mt-8 sm:mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href="/generate" className="btn-primary w-full sm:w-auto px-8 h-12">
              Open scanner
            </Link>
            <Link
              href="/subscription"
              className="btn-ghost w-full sm:w-auto px-6 h-12 border-[var(--border)]"
            >
              View plans
            </Link>
          </div>

          <div className="mt-14 sm:mt-16 grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 max-w-4xl mx-auto text-left">
            {[
              {
                step: "01",
                title: "Configure",
                body: "Set budget, target win chance, and complexity — wear-only or exact floats.",
              },
              {
                step: "02",
                title: "Scan",
                body: "Pull live prices and rank contracts by EV, liquidity, and outcome odds.",
              },
              {
                step: "03",
                title: "Execute",
                body: "Save contracts, refresh prices, and share builds when you’re ready.",
              },
            ].map((item, i) => (
              <div
                key={item.step}
                className="panel p-5 sm:p-6 hover:border-accent/35 transition-colors animate-fade-up"
                style={{ animationDelay: `${120 + i * 90}ms` }}
              >
                <p className="font-mono text-[11px] text-accent mb-3">
                  {item.step}
                </p>
                <h2 className="text-base font-semibold mb-1.5">{item.title}</h2>
                <p className="text-[12px] text-[var(--text-muted)] leading-relaxed">
                  {item.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Compact feature strip — no fake live feed */}
      <section className="mx-auto max-w-container px-4 sm:px-6 py-12 sm:py-16">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            {
              title: "Float-aware",
              body: "Wear tiers or precise float caps — pick the sourcing difficulty you can fill.",
            },
            {
              title: "Market-priced",
              body: "Steam and CSFloat fee modes so EV matches where you actually sell.",
            },
            {
              title: "Save & share",
              body: "Keep contracts on your device, refresh prices later, export or share when set.",
            },
          ].map((f) => (
            <div key={f.title} className="border-l-2 border-accent/40 pl-4 py-1">
              <h3 className="text-sm font-semibold">{f.title}</h3>
              <p className="mt-1 text-[12px] text-[var(--text-muted)] leading-relaxed">
                {f.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-[var(--border-subtle)] py-4 text-center text-[10px] font-mono text-[var(--text-muted)]">
        CSTradeups · market data cached 24h
      </footer>
    </div>
  );
}
