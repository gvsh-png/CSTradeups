"use client";

import { createRoot, type Root } from "react-dom/client";
import { createElement } from "react";
import type { TradeUpResult } from "@/lib/tradeup/types";
import TradeUpExport from "@/components/TradeUpExport";
import type { CurrencyCode } from "@/lib/currency";
import { CURRENCY_STORAGE_KEY, DEFAULT_CURRENCY } from "@/lib/currency";
import { proxiedImageUrl } from "@/lib/proxyImage";

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error || new Error("FileReader failed"));
    reader.readAsDataURL(blob);
  });
}

/** Fetch a skin image via same-origin proxy and embed as data URL (canvas-safe) */
async function embedImage(src?: string): Promise<string | undefined> {
  if (!src) return undefined;
  if (src.startsWith("data:")) return src;

  const url = proxiedImageUrl(src);
  if (!url) return undefined;

  try {
    const res = await fetch(url, { cache: "force-cache" });
    if (!res.ok) return undefined;
    const blob = await res.blob();
    if (!blob.type.startsWith("image/") || blob.size < 32) return undefined;
    return await blobToDataUrl(blob);
  } catch {
    return undefined;
  }
}

/** Clone trade-up with every thumbnail inlined as a data URL */
async function withEmbeddedImages(
  tradeUp: TradeUpResult
): Promise<TradeUpResult> {
  const [inputs, outcomes] = await Promise.all([
    Promise.all(
      tradeUp.inputs.map(async (input) => ({
        ...input,
        image: await embedImage(input.image),
      }))
    ),
    Promise.all(
      tradeUp.outcomes.map(async (outcome) => ({
        ...outcome,
        image: await embedImage(outcome.image),
      }))
    ),
  ]);
  return { ...tradeUp, inputs, outcomes };
}

function waitForImages(root: HTMLElement, timeoutMs = 10000): Promise<void> {
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

function activeCurrency(): CurrencyCode {
  try {
    const raw = localStorage.getItem(CURRENCY_STORAGE_KEY);
    return (raw as CurrencyCode) || DEFAULT_CURRENCY;
  } catch {
    return DEFAULT_CURRENCY;
  }
}

/** Render a clean trade-up card off-screen and download as PNG */
export async function exportTradeUpPng(tradeUp: TradeUpResult): Promise<void> {
  // Inline images first — avoids html-to-image cloning bugs that reuse one remote thumb
  const embedded = await withEmbeddedImages(tradeUp);

  const host = document.createElement("div");
  host.setAttribute("data-tradeup-export-host", "true");
  Object.assign(host.style, {
    position: "fixed",
    left: "0",
    top: "0",
    width: "720px",
    opacity: "0",
    pointerEvents: "none",
    zIndex: "-1",
    // Keep in layout so the browser actually paints <img> data URLs
    overflow: "hidden",
  });
  document.body.appendChild(host);

  let root: Root | null = null;
  try {
    root = createRoot(host);
    root.render(
      createElement(TradeUpExport, {
        tradeUp: embedded,
        currencyCode: activeCurrency(),
      })
    );

    await new Promise<void>((r) => requestAnimationFrame(() => r()));
    await new Promise<void>((r) => requestAnimationFrame(() => r()));
    // Extra tick after data-URL images decode
    await new Promise<void>((r) => setTimeout(r, 50));

    const card = host.querySelector(
      "[data-tradeup-export]"
    ) as HTMLElement | null;
    if (!card) throw new Error("Export card failed to render");

    await waitForImages(card);

    const { toPng } = await import("html-to-image");

    const options = {
      backgroundColor: "#1a1f27",
      pixelRatio: 2,
      cacheBust: false,
      width: 720,
      style: {
        margin: "0",
        transform: "none",
        opacity: "1",
      },
    };

    const dataUrl = await toPng(card, options);

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
