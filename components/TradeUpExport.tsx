import type { TradeUpResult } from "@/lib/tradeup/types";
import { RARITY_COLORS, rarityShort } from "@/lib/constants";
import { proxiedImageUrl } from "@/lib/proxyImage";
import {
  DEFAULT_CURRENCY,
  formatMoney,
  type CurrencyCode,
} from "@/lib/currency";

const COLORS = {
  bg: "#1a1f27",
  panel: "#222831",
  border: "#2f3742",
  text: "#e8eaed",
  mute: "#8b93a0",
  accent: "#d4a84b",
  profit: "#5ecf8e",
  loss: "#e35d5d",
};

function rarityTint(rarity: string) {
  const color = RARITY_COLORS[rarity] || COLORS.mute;
  return {
    color,
    border: `${color}88`,
    bg: `${color}22`,
  };
}

function Thumb({ src, alt, rarity }: { src?: string; alt: string; rarity: string }) {
  const tint = rarityTint(rarity);
  const proxied = proxiedImageUrl(src);
  return (
    <div
      style={{
        width: 44,
        height: 44,
        flexShrink: 0,
        borderRadius: 6,
        border: `1px solid ${tint.border}`,
        background: tint.bg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      {proxied ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={proxied}
          alt={alt}
          crossOrigin="anonymous"
          style={{ width: 40, height: 40, objectFit: "contain" }}
        />
      ) : null}
    </div>
  );
}

function Badge({ rarity }: { rarity: string }) {
  const tint = rarityTint(rarity);
  return (
    <span
      style={{
        display: "inline-block",
        fontSize: 10,
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
        fontWeight: 700,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        padding: "3px 7px",
        borderRadius: 5,
        border: `1px solid ${tint.border}`,
        background: tint.bg,
        color: tint.color,
      }}
    >
      {rarityShort(rarity)}
    </span>
  );
}

function Stat({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div style={{ minWidth: 0 }}>
      <div
        style={{
          fontSize: 10,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: COLORS.mute,
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 16,
          fontWeight: 700,
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
          color: color || COLORS.text,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </div>
    </div>
  );
}

/** Clean, self-contained trade-up frame for PNG export */
export default function TradeUpExport({
  tradeUp,
  currencyCode = DEFAULT_CURRENCY,
}: {
  tradeUp: TradeUpResult;
  currencyCode?: CurrencyCode;
}) {
  const money = (n: number, signed?: boolean) =>
    formatMoney(n, currencyCode, signed ? { signed: true } : undefined);
  const profitColor =
    tradeUp.expectedProfit >= 0 ? COLORS.profit : COLORS.loss;
  const inputTint = rarityTint(tradeUp.inputRarity);
  const outputTint = rarityTint(tradeUp.outputRarity);

  return (
    <div
      data-tradeup-export
      style={{
        width: 720,
        boxSizing: "border-box",
        background: COLORS.bg,
        color: COLORS.text,
        border: `1px solid ${COLORS.border}`,
        borderRadius: 12,
        overflow: "hidden",
        fontFamily:
          "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "18px 22px 14px",
          borderBottom: `1px solid ${COLORS.border}`,
          background: COLORS.panel,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            marginBottom: 12,
          }}
        >
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
              letterSpacing: "0.04em",
              textTransform: "uppercase",
            }}
          >
            TradeUp<span style={{ color: COLORS.accent }}>.gen</span>
          </div>
          <div
            style={{
              fontSize: 11,
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
              color: COLORS.mute,
              textTransform: "uppercase",
            }}
          >
            {tradeUp.complexity}
            {tradeUp.type === "mixed" ? " · mixed" : ""}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexWrap: "wrap",
            marginBottom: 8,
          }}
        >
          <Badge rarity={tradeUp.inputRarity} />
          <span style={{ color: COLORS.mute, fontSize: 12 }}>→</span>
          <Badge rarity={tradeUp.outputRarity} />
        </div>

        <div
          style={{
            fontSize: 12,
            color: COLORS.mute,
            lineHeight: 1.45,
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
          }}
        >
          {tradeUp.description}
        </div>
      </div>

      {/* Stats */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 16,
          padding: "16px 22px",
          borderBottom: `1px solid ${COLORS.border}`,
        }}
      >
        <Stat
          label="Win chance"
          value={`${tradeUp.winPct}%`}
          color={tradeUp.winPct >= 50 ? COLORS.profit : undefined}
        />
        <Stat
          label="Avg profit"
          value={money(tradeUp.expectedProfit, true)}
          color={profitColor}
        />
        <Stat
          label="ROI"
          value={`${tradeUp.roi}%`}
          color={profitColor}
        />
        <Stat label="Cost" value={money(tradeUp.totalCost)} />
      </div>

      {/* Inputs */}
      <div style={{ padding: "16px 22px 8px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 10,
          }}
        >
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: COLORS.mute,
            }}
          >
            Inputs
          </span>
          <Badge rarity={tradeUp.inputRarity} />
        </div>
        <div style={{ display: "grid", gap: 8 }}>
          {tradeUp.inputs.map((input, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "10px 12px",
                borderRadius: 8,
                border: `1px solid ${inputTint.border}`,
                background: inputTint.bg,
              }}
            >
              <Thumb
                src={input.image}
                alt={input.name}
                rarity={tradeUp.inputRarity}
              />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {input.count > 1 ? (
                    <span style={{ color: COLORS.accent }}>{input.count}× </span>
                  ) : null}
                  {input.name}
                </div>
                <div
                  style={{
                    marginTop: 3,
                    fontSize: 11,
                    color: COLORS.mute,
                    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                  }}
                >
                  {input.wear} · {money(input.price)}
                  {tradeUp.complexity !== "simple" &&
                  input.maxFloat != null
                    ? ` · ≤${input.maxFloat.toFixed(4)}`
                    : ""}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Outcomes */}
      <div style={{ padding: "12px 22px 18px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 10,
          }}
        >
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: COLORS.mute,
            }}
          >
            Outcomes
          </span>
          <Badge rarity={tradeUp.outputRarity} />
        </div>
        <div style={{ display: "grid", gap: 8 }}>
          {tradeUp.outcomes.map((outcome, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "10px 12px",
                borderRadius: 8,
                border: `1px solid ${outputTint.border}`,
                background: outputTint.bg,
              }}
            >
              <Thumb
                src={outcome.image}
                alt={outcome.name}
                rarity={tradeUp.outputRarity}
              />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {outcome.name}
                </div>
                <div
                  style={{
                    marginTop: 3,
                    fontSize: 11,
                    color: COLORS.mute,
                    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                  }}
                >
                  {outcome.wear} · {outcome.float.toFixed(4)}
                </div>
              </div>
              <div
                style={{
                  textAlign: "right",
                  flexShrink: 0,
                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                  width: 72,
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 700 }}>
                  {outcome.prob}%
                </div>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color:
                      outcome.profit >= 0 ? COLORS.profit : COLORS.loss,
                    marginTop: 2,
                  }}
                >
                  {money(outcome.price)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {tradeUp.insight ? (
        <div
          style={{
            padding: "14px 22px 18px",
            borderTop: `1px solid ${COLORS.border}`,
            background: COLORS.panel,
          }}
        >
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: COLORS.accent,
              marginBottom: 6,
            }}
          >
            AI analysis
          </div>
          <div
            style={{
              fontSize: 12,
              lineHeight: 1.5,
              color: COLORS.mute,
            }}
          >
            {tradeUp.insight}
          </div>
        </div>
      ) : null}
    </div>
  );
}
