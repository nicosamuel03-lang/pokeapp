import { useEffect, useMemo, useState } from "react";
import { fetchEbayAveragePriceEur } from "../services/ebayLivePrice";
import { isEbayMockMode } from "../services/ebayMarketPrice";

export type EbayLivePhase = "idle" | "loading" | "ok" | "error";

/**
 * Charge la moyenne eBay FR (top 5) pour `searchQuery` ; sinon affiche `catalogFallback`.
 */
export function useEbayLiveMarketPrice(
  searchQuery: string,
  catalogFallback: number
): {
  displayPrice: number;
  phase: EbayLivePhase;
  livePrice: number | null;
  resultCount: number;
  itemsUsed: number;
} {
  const query = searchQuery.trim();
  const [phase, setPhase] = useState<EbayLivePhase>("idle");
  const [livePrice, setLivePrice] = useState<number | null>(null);
  const [resultCount, setResultCount] = useState(0);
  const [itemsUsed, setItemsUsed] = useState(0);

  useEffect(() => {
    if (!query || isEbayMockMode()) {
      setPhase("idle");
      setLivePrice(null);
      setResultCount(0);
      setItemsUsed(0);
      return;
    }

    const ac = new AbortController();
    setPhase("loading");
    setLivePrice(null);
    setResultCount(0);
    setItemsUsed(0);

    fetchEbayAveragePriceEur(query, ac.signal)
      .then((r) => {
        if (ac.signal.aborted) return;
        if (r.ok && r.averagePriceEur > 0) {
          setLivePrice(r.averagePriceEur);
          setResultCount(r.resultCount);
          setItemsUsed(r.itemsUsed);
          setPhase("ok");
        } else {
          setPhase("error");
        }
      })
      .catch(() => {
        if (ac.signal.aborted) return;
        setPhase("error");
      });

    return () => ac.abort();
  }, [query]);

  const displayPrice = useMemo(() => {
    if (phase === "ok" && livePrice != null && livePrice > 0) return livePrice;
    return catalogFallback;
  }, [phase, livePrice, catalogFallback]);

  return {
    displayPrice,
    phase,
    livePrice,
    resultCount,
    itemsUsed,
  };
}
