import Link from "next/link";

export default function HomePage() {
  return (
    <div className="relative">
      <section className="relative overflow-hidden border-b border-[var(--border-brass)]">
        <div className="pointer-events-none absolute inset-0 industrial-dots opacity-80" />
        <div className="pointer-events-none absolute -top-20 left-1/2 h-64 w-[28rem] -translate-x-1/2 rounded-full bg-accent/[0.06] blur-3xl" />

        <div className="relative mx-auto max-w-container px-4 sm:px-6 py-16 sm:py-22 lg:py-28 text-center animate-fade-up">
          <p className="label mb-4 text-accent">CS2 contract scanner</p>
          <h1 className="text-4xl sm:text-5xl lg:text-[3.5rem] font-bold tracking-tight leading-[1.05] max-w-3xl mx-auto">
            <span className="text-accent">tradeupcsgo.net</span>
            <span className="block mt-3 text-[0.68em] font-semibold text-[var(--text)]">
              Precision trade-up engineering
            </span>
          </h1>
          <p className="mt-5 sm:mt-6 text-sm sm:text-base text-[var(--text-soft)] max-w-xl mx-auto leading-relaxed">
            Systematically find profitable CS2 trade-ups with live market data,
            float targets, and expected-value math.
          </p>

          <div className="mt-8 sm:mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/generate"
              className="btn-primary w-full sm:w-auto px-8 h-12 min-w-[200px]"
            >
              Open scanner
            </Link>
            <Link
              href="/subscription"
              className="btn-accent-outline w-full sm:w-auto px-6 h-12"
            >
              View plans
            </Link>
          </div>

          <div className="mt-14 sm:mt-16 grid grid-cols-1 md:grid-cols-3 gap-4 max-w-4xl mx-auto text-left">
            {[
              {
                step: "01",
                title: "Configure",
                body: "Budget, risk chance, and contract type — standard, covert, or souvenir.",
              },
              {
                step: "02",
                title: "Scan",
                body: "Live prices ranked by EV, liquidity, and outcome odds.",
              },
              {
                step: "03",
                title: "Execute",
                body: "Save blueprints, refresh prices, share when ready.",
              },
            ].map((item, i) => (
              <div
                key={item.step}
                className="panel panel-desktop p-5 hover:border-accent/30 transition-colors duration-150 animate-fade-up"
                style={{ animationDelay: `${100 + i * 70}ms` }}
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

      <footer className="border-t border-[var(--border)] py-4 text-center text-[10px] font-mono text-[var(--text-muted)]">
        tradeupcsgo.net · market data cached 24h
      </footer>
    </div>
  );
}
