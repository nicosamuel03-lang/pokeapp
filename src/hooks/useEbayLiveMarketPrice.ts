import { useEffect, useMemo, useRef, useState } from "react";
import { fetchEbayAveragePriceEur } from "../services/ebayLivePrice";
import { isEbayMockMode } from "../services/ebayMarketPrice";

export type EbayLivePhase = "idle" | "loading" | "ok" | "error";

/** Délai minimal entre deux appels eBay (ms) — évite les bursts. */
const EBAY_CALL_DELAY_MS = 2000;

/**
 * Charge le prix marché eBay FR (Browse API, médiane robuste) pour `searchQuery`.
 * Retombe sur `catalogFallback` si indisponible.
 * Applique un délai de 2s avant d'envoyer la requête pour
 * éviter les bursts lors des changements rapides de page / composants.
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
  marketDataWarning: boolean;
} {
  const query = searchQuery.trim();
  const [phase, setPhase] = useState<EbayLivePhase>("idle");
  const [livePrice, setLivePrice] = useState<number | null>(null);
  const [resultCount, setResultCount] = useState(0);
  const [itemsUsed, setItemsUsed] = useState(0);
  const [marketDataWarning, setMarketDataWarning] = useState(false);

  /** Ref pour l'AbortController courant (annulation si la query change avant fetch). */
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!query || isEbayMockMode()) {
      setPhase("idle");
      setLivePrice(null);
      setResultCount(0);
      setItemsUsed(0);
      setMarketDataWarning(false);
      return;
    }

    setPhase("loading");
    setLivePrice(null);
    setResultCount(0);
    setItemsUsed(0);
    setMarketDataWarning(false);

    /** Annule tout appel précédent immédiatement. */
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    /** Attend 2s avant d'envoyer la requête. */
    const timer = window.setTimeout(async () => {
      if (ac.signal.aborted) return;
      try {
        const r = await fetchEbayAveragePriceEur(query, ac.signal);
        if (ac.signal.aborted) return;
        if (r.ok && r.averagePriceEur > 0) {
          setLivePrice(r.averagePriceEur);
          setResultCount(r.resultCount);
          setItemsUsed(r.itemsUsed);
          setMarketDataWarning(r.marketDataWarning);
          setPhase("ok");
        } else {
          setPhase("error");
        }
      } catch {
        if (!ac.signal.aborted) setPhase("error");
      }
    }, EBAY_CALL_DELAY_MS);

    return () => {
      clearTimeout(timer);
      ac.abort();
    };
  }, [query]);

  const displayPrice = useMemo(() => {
    if (phase === "ok" && livePrice != null && livePrice > 0) return livePrice;
    return catalogFallback;
  }, [phase, livePrice, catalogFallback]);

  return { displayPrice, phase, livePrice, resultCount, itemsUsed, marketDataWarning };
}
