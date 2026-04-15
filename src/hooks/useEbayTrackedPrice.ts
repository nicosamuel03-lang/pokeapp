/**
 * Hook : prix de marché eBay issu de la table Supabase `ebay_prices`
 * (médiane robuste 90j, filtre ±40 %, corridor catalogue optionnel, jitter en bordure).
 *
 * Logique :
 *   - Si des entrées existent sur 90 jours (ou backfill serveur) → médiane affichée
 *   - Sinon → null, fallback catalogue
 *
 * @param productId  ID du produit (ex. "ME02.5", "display-ME02", "upc-UPC08")
 * @param enabled    Désactiver le fetch si false (ex. produit non ETB)
 */

import { useEffect, useRef, useState } from "react";
import { apiUrl } from "../config/apiUrl";
import { getEbayPriceCorridor } from "../data/ebayPriceCorridor";
import { robustMedianFromSamplePrices } from "../utils/ebayTrackedPriceStats";

/** Après un backfill serveur, au moins une entrée suffit pour afficher le prix marché. */
const MIN_ENTRIES = 1;

export interface TrackedPriceResult {
  /** true si le prix marché eBay est utilisable (≥1 entrée ou backfill) */
  available: boolean;
  /** Médiane robuste eBay sur 90 jours (null si available=false) — nom historique `averagePriceEur`. */
  averagePriceEur: number | null;
  /** Nombre d'entrées utilisées */
  count: number;
  /** En cours de chargement */
  loading: boolean;
  /** Message d'erreur éventuel */
  error: string | null;
}

// Pas de cache client : après INSERT côté serveur ou suppression en base, le prix doit se mettre à jour tout de suite.

export function useEbayTrackedPrice(
  productId: string | null | undefined,
  enabled = true
): TrackedPriceResult {
  const [state, setState] = useState<TrackedPriceResult>({
    available: false,
    averagePriceEur: null,
    count: 0,
    loading: false,
    error: null,
  });

  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!enabled || !productId) {
      setState({ available: false, averagePriceEur: null, count: 0, loading: false, error: null });
      return;
    }

    // Annule la requête précédente
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setState((s) => ({ ...s, loading: true, error: null }));

    fetch(apiUrl(`/api/ebay/tracked-price?productId=${encodeURIComponent(productId)}`), {
      signal: controller.signal,
    })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<{
          available: boolean;
          pricesEur?: number[];
          /** Ancienne forme API (moyenne serveur) */
          averagePriceEur?: number;
          count?: number;
          error?: string;
        }>;
      })
      .then((data) => {
        const rawList = Array.isArray(data.pricesEur)
          ? data.pricesEur.map((p) => Number(p)).filter(Number.isFinite)
          : typeof data.averagePriceEur === "number" && Number.isFinite(data.averagePriceEur)
            ? [data.averagePriceEur]
            : [];
        const count = data.count ?? rawList.length;
        const corridor = productId ? getEbayPriceCorridor(productId) : undefined;
        const robust = robustMedianFromSamplePrices(rawList, undefined, {
          corridor,
          productId: productId ?? undefined,
        });
        const median = robust?.medianPriceEur ?? null;
        const isReliable =
          (data.available ?? false) &&
          count >= MIN_ENTRIES &&
          median != null &&
          Number.isFinite(median);
        const result: TrackedPriceResult = {
          available: isReliable,
          averagePriceEur: isReliable ? median : null,
          count,
          loading: false,
          error: data.error ?? null,
        };
        setState(result);
      })
      .catch((err) => {
        if (err.name === "AbortError") return;
        setState({ available: false, averagePriceEur: null, count: 0, loading: false, error: err.message });
      });

    return () => {
      controller.abort();
    };
  }, [productId, enabled]);

  return state;
}

/**
 * Retourne le prix à afficher : prix tracké eBay (si dispo) ou prix catalogue en fallback.
 *
 * @param trackedPrice  Résultat de useEbayTrackedPrice
 * @param catalogPrice  Prix catalogue (etbData.prixActuel ou getPrixMarcheForProduct)
 */
export function resolveDisplayPrice(
  trackedPrice: TrackedPriceResult,
  catalogPrice: number
): { price: number; source: "ebay_tracked" | "catalog" } {
  if (
    trackedPrice.available &&
    trackedPrice.averagePriceEur != null &&
    Number.isFinite(trackedPrice.averagePriceEur)
  ) {
    return { price: trackedPrice.averagePriceEur, source: "ebay_tracked" };
  }
  return { price: catalogPrice, source: "catalog" };
}
