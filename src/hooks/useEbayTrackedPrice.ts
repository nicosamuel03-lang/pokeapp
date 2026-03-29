/**
 * Hook : prix de marché eBay issu de la table Supabase `ebay_prices`
 * (moyenne des 30 derniers jours synchronisés par priceSyncJob).
 *
 * Logique :
 *   - Si ≥ MIN_ENTRIES entrées disponibles → retourne la moyenne sur 30 jours
 *   - Sinon → retourne null et le composant utilise le prix catalogue
 *
 * @param productId  ID du produit (ex. "ME02.5", "display-ME02", "upc-UPC08")
 * @param enabled    Désactiver le fetch si false (ex. produit non ETB)
 */

import { useEffect, useRef, useState } from "react";
import { apiUrl } from "../config/apiUrl";

/** Nombre minimum d'entrées dans ebay_prices pour considérer le prix fiable. */
const MIN_ENTRIES = 1;

export interface TrackedPriceResult {
  /** true si au moins MIN_ENTRIES entrées disponibles dans Supabase */
  available: boolean;
  /** Moyenne eBay sur 30 jours (null si available=false) */
  averagePriceEur: number | null;
  /** Nombre d'entrées utilisées */
  count: number;
  /** En cours de chargement */
  loading: boolean;
  /** Message d'erreur éventuel */
  error: string | null;
}

const CACHE_TTL_MS = 60 * 60 * 1000; // 1h en mémoire côté client

// Cache en mémoire partagé entre les instances du hook
const _cache = new Map<string, { result: TrackedPriceResult; expiresAt: number }>();

function getCached(productId: string): TrackedPriceResult | null {
  const entry = _cache.get(productId);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) { _cache.delete(productId); return null; }
  return entry.result;
}

function setCached(productId: string, result: TrackedPriceResult) {
  _cache.set(productId, { result, expiresAt: Date.now() + CACHE_TTL_MS });
}

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

    // Cache hit
    const cached = getCached(productId);
    if (cached) {
      setState(cached);
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
          averagePriceEur?: number;
          count?: number;
          error?: string;
        }>;
      })
      .then((data) => {
        const count = data.count ?? 0;
        // Exige au moins MIN_ENTRIES pour lisser les pics de prix
        const isReliable = (data.available ?? false) && count >= MIN_ENTRIES;
        const result: TrackedPriceResult = {
          available:       isReliable,
          averagePriceEur: isReliable ? (data.averagePriceEur ?? null) : null,
          count,
          loading:         false,
          error:           data.error ?? null,
        };
        setCached(productId, result);
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
