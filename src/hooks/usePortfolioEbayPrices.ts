/**
 * Hook : prix eBay trackés (90 derniers jours, Supabase) pour toute la collection.
 * Appelle /api/ebay/tracked-prices?ids=... en une seule requête batch.
 *
 * Retourne une Map<productId, médiane robuste> pour les produits ayant au moins
 * une entrée dans ebay_prices sur 90 jours (les autres = null → fallback catalogue).
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { apiUrl } from "../config/apiUrl";
import type { CollectionLineForChart } from "../utils/portfolioChartData";
import { getEbayPriceCorridor } from "../data/ebayPriceCorridor";
import { robustMedianFromSamplePrices } from "../utils/ebayTrackedPriceStats";

export interface PortfolioEbayPricesResult {
  /** Map productId → médiane robuste 90j (filtre ±40 %) */
  priceMap: Map<string, number>;
  loading: boolean;
  /** Nombre de produits avec un prix eBay disponible */
  coveredCount: number;
}

/** Court délai : après backfill serveur, un nouvel appel batch doit voir le prix inséré. */
const CACHE_TTL_MS = 60 * 1000; // 1 min

let _cache: { key: string; result: PortfolioEbayPricesResult; expiresAt: number } | null = null;

export function usePortfolioEbayPrices(
  collectionLines: CollectionLineForChart[]
): PortfolioEbayPricesResult {
  const [result, setResult] = useState<PortfolioEbayPricesResult>({
    priceMap: new Map(),
    loading: false,
    coveredCount: 0,
  });

  // Construit la liste des IDs produits de la collection
  const productIds = useMemo(() => {
    const ids = new Set<string>();
    for (const line of collectionLines) {
      const rawId = line.product.etbId ?? line.product.id;
      if (rawId) {
        const category = (line.product.category || "").toLowerCase();
        if (category === "displays" || category === "display") {
          ids.add(`display-${rawId}`);
        } else if (category === "upc") {
          ids.add(`upc-${rawId.replace(/^upc-/i, "")}`);
        } else {
          ids.add(rawId);
        }
      }
    }
    return Array.from(ids);
  }, [collectionLines]);

  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (productIds.length === 0) {
      setResult({ priceMap: new Map(), loading: false, coveredCount: 0 });
      return;
    }

    const cacheKey = productIds.slice().sort().join(",");

    // Cache hit
    if (_cache && _cache.key === cacheKey && Date.now() < _cache.expiresAt) {
      setResult(_cache.result);
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setResult((s) => ({ ...s, loading: true }));

    const url = apiUrl(
      `/api/ebay/tracked-prices?ids=${productIds.map(encodeURIComponent).join(",")}`
    );

    console.log("[EbayPrices] 📡 Fetching URL:", url);

    fetch(url, { signal: controller.signal })
      .then((res) => {
        console.log("[EbayPrices] HTTP status:", res.status);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<{
          priceEntries?: Record<string, number[]>;
          prices?: Record<string, number | null>;
        }>;
      })
      .then(({ priceEntries, prices: legacyPrices }) => {
        console.log("[EbayPrices] 📦 Raw API response:", JSON.stringify(priceEntries ?? legacyPrices, null, 2));
        const priceMap = new Map<string, number>();
        const ids = productIds;
        for (const id of ids) {
          const entries = priceEntries?.[id];
          if (entries && entries.length > 0) {
            const corridor = getEbayPriceCorridor(id);
            const r = robustMedianFromSamplePrices(entries, undefined, {
              corridor,
              productId: id,
            });
            if (r && r.medianPriceEur > 0) priceMap.set(id, r.medianPriceEur);
          } else {
            const p = legacyPrices?.[id];
            if (p != null && p > 0) priceMap.set(id, p);
          }
        }
        console.log("[EbayPrices] ✅ priceMap entries:", priceMap.size, "| keys:", Array.from(priceMap.keys()));
        console.log("[EbayPrices] EB10.5 (Pokémon GO) →", priceMap.get("EB10.5") ?? "NOT IN MAP");
        const fresh: PortfolioEbayPricesResult = {
          priceMap,
          loading: false,
          coveredCount: priceMap.size,
        };
        _cache = { key: cacheKey, result: fresh, expiresAt: Date.now() + CACHE_TTL_MS };
        setResult(fresh);
      })
      .catch((err) => {
        if (err.name === "AbortError") return;
        console.error("[EbayPrices] ❌ Fetch error:", err.message);
        // En cas d'erreur (Supabase indisponible, etc.) on retourne une map vide
        // → le portfolio utilisera silencieusement les prix catalogue
        setResult({ priceMap: new Map(), loading: false, coveredCount: 0 });
      });

    return () => controller.abort();
  }, [productIds.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  return result;
}
