/** Rewrite remote skin URLs through same-origin proxy for canvas-safe export */
export function proxiedImageUrl(src?: string | null): string | undefined {
  if (!src) return undefined;
  if (src.startsWith("data:") || src.startsWith("blob:")) return src;
  if (src.startsWith("/api/img")) return src;

  try {
    const url = new URL(src, typeof window !== "undefined" ? window.location.origin : "https://localhost");
    if (url.protocol !== "http:" && url.protocol !== "https:") return undefined;
    // Already same-origin
    if (typeof window !== "undefined" && url.origin === window.location.origin) {
      return url.pathname + url.search;
    }
    return `/api/img?u=${encodeURIComponent(url.toString())}`;
  } catch {
    return undefined;
  }
}
