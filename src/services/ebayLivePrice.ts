import { apiUrl } from "../config/apiUrl";
import { isEbayMockMode } from "./ebayMarketPrice";

export type EbayPriceResponse =
  | {
      ok: true;
      averagePriceEur: number;
      resultCount: number;
      itemsUsed: number;
      /** Prix suspect vs seuils connus (ex. Display EB07). */
      marketDataWarning: boolean;
    }
  | { ok: false; error: string; status?: number };

/**
 * Appelle le backend `GET /api/ebay/price?query=…` (médiane robuste sur annonces eBay FR).
 */
export async function fetchEbayAveragePriceEur(
  query: string,
  signal?: AbortSignal
): Promise<EbayPriceResponse> {
  if (isEbayMockMode()) {
    return { ok: false, error: "MOCK" };
  }
  const q = query.trim();
  if (!q) return { ok: false, error: "empty query" };

  const url = `${apiUrl("/api/ebay/price")}?${new URLSearchParams({ query: q })}`;
  const res = await fetch(url, { method: "GET", signal });
  const data = (await res.json().catch(() => ({}))) as {
    error?: string;
    averagePriceEur?: number;
    resultCount?: number;
    itemsUsed?: number;
    marketDataWarning?: boolean;
  };

  if (!res.ok) {
    return {
      ok: false,
      error: data.error || `HTTP ${res.status}`,
      status: res.status,
    };
  }

  const avg = data.averagePriceEur;
  if (typeof avg !== "number" || !Number.isFinite(avg) || avg <= 0) {
    return { ok: false, error: data.error || "invalid response" };
  }

  return {
    ok: true,
    averagePriceEur: avg,
    resultCount: typeof data.resultCount === "number" ? data.resultCount : 0,
    itemsUsed: typeof data.itemsUsed === "number" ? data.itemsUsed : 0,
    marketDataWarning: Boolean(data.marketDataWarning),
  };
}
