/**
 * Hook : prix eBay trackés (7 derniers jours, Supabase) pour toute la collection.
 * Appelle /api/ebay/tracked-prices?ids=... en une seule requête batch.
 *
 * Retourne une Map<productId, averagePriceEur> avec uniquement les produits
 * qui ont au moins 3 entrées disponibles dans ebay_prices (les autres = null,
 * le calcul du portfolio utilisera le prix catalogue en fallback).
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { apiUrl } from "../config/apiUrl";
import type { CollectionLineForChart } from "../utils/portfolioChartData";

export interface PortfolioEbayPricesResult {
  /** Map productId → prix eBay moyen 7j (présent seulement si ≥ 3 entrées) */
  priceMap: Map<string, number>;
  loading: boolean;
  /** Nombre de produits avec un prix eBay disponible */
  coveredCount: number;
}

const CACHE_TTL_MS = 60 * 60 * 1000; // 1h

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
          ids.add(`UPC${rawId.replace(/^UPC/i, "")}`);
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
        return res.json() as Promise<{ prices: Record<string, number | null> }>;
      })
      .then(({ prices }) => {
        console.log("[EbayPrices] 📦 Raw API response:", JSON.stringify(prices, null, 2));
        const priceMap = new Map<string, number>();
        for (const [id, price] of Object.entries(prices)) {
          if (price != null && price > 0) priceMap.set(id, price);
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
