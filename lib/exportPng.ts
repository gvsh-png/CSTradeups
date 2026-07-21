"use client";

import { createRoot, type Root } from "react-dom/client";
import { createElement } from "react";
import type { TradeUpResult } from "@/lib/tradeup/types";
import TradeUpExport from "@/components/TradeUpExport";
import type { CurrencyCode } from "@/lib/currency";

function waitForImages(root: HTMLElement, timeoutMs = 8000): Promise<void> {
  const images = Array.from(root.querySelectorAll("img"));
  if (!images.length) return Promise.resolve();

  return Promise.all(
    images.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete && img.naturalWidth > 0) {
            resolve();
            return;
          }
          const done = () => resolve();
          img.addEventListener("load", done, { once: true });
          img.addEventListener("error", done, { once: true });
          // Safety timeout per image
          setTimeout(done, timeoutMs);
        })
    )
  ).then(() => undefined);
}

function downloadDataUrl(dataUrl: string, filename: string) {
  const link = document.createElement("a");
  link.download = filename;
  link.href = dataUrl;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
}

/** Render a clean trade-up card off-screen and download as PNG */
export async function exportTradeUpPng(tradeUp: TradeUpResult): Promise<void> {
  const host = document.createElement("div");
  host.setAttribute("data-tradeup-export-host", "true");
  Object.assign(host.style, {
    position: "fixed",
    left: "-10000px",
    top: "0",
    width: "720px",
    pointerEvents: "none",
    zIndex: "-1",
  });
  document.body.appendChild(host);

  let root: Root | null = null;
  try {
    root = createRoot(host);
    root.render(
      createElement(TradeUpExport, {
        tradeUp,
        currencyCode: (() => {
          try {
            const raw = localStorage.getItem("tradeup-gen-currency");
            return (raw as CurrencyCode) || "USD";
          } catch {
            return "USD";
          }
        })(),
      })
    );

    // Allow React commit + layout
    await new Promise<void>((r) => requestAnimationFrame(() => r()));
    await new Promise<void>((r) => requestAnimationFrame(() => r()));

    const card = host.querySelector(
      "[data-tradeup-export]"
    ) as HTMLElement | null;
    if (!card) throw new Error("Export card failed to render");

    await waitForImages(card);

    const { toPng } = await import("html-to-image");

    const options = {
      backgroundColor: "#1a1f27",
      pixelRatio: 2,
      cacheBust: true,
      width: 720,
      style: {
        margin: "0",
        transform: "none",
      },
    };

    let dataUrl: string;
    try {
      dataUrl = await toPng(card, options);
    } catch {
      // Retry without images if any remaining CORS/taint issue
      card.querySelectorAll("img").forEach((img) => {
        img.removeAttribute("src");
        img.style.display = "none";
      });
      dataUrl = await toPng(card, options);
    }

    if (!dataUrl || dataUrl.length < 100) {
      throw new Error("Empty PNG");
    }

    downloadDataUrl(dataUrl, `tradeup-${tradeUp.id.slice(0, 10)}.png`);
  } finally {
    try {
      root?.unmount();
    } catch {
      /* ignore */
    }
    host.remove();
  }
}
