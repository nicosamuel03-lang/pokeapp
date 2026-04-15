/**
 * Agrégation des prix `ebay_prices` (fenêtre 90j) : médiane sur les entrées persistées
 * (échantillon marché issu des synchros eBay), exclusion des valeurs extrêmes ±40 %,
 * puis corridor optionnel [minPrice, maxPrice] et « life » en bordure.
 */

const DEFAULT_OUTLIER_BAND = 0.4;
/** Variation quotidienne stable lorsque le prix est plafonné / plancher (±0,3 %). */
const BOUNDARY_JITTER = 0.003;

function medianSorted(sorted: number[]): number | null {
  if (sorted.length === 0) return null;
  const m = sorted.length;
  const mid = Math.floor(m / 2);
  return m % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}

function medianOfPositivePrices(prices: number[]): number | null {
  const valid = prices.filter((p) => Number.isFinite(p) && p > 0);
  if (valid.length === 0) return null;
  return medianSorted([...valid].sort((a, b) => a - b));
}

/**
 * Fraction pseudo-aléatoire dans [-BOUNDARY_JITTER, +BOUNDARY_JITTER], identique pour un
 * même couple (productId, jour UTC) pour un léger mouvement quotidien en bordure de corridor.
 */
function dailyBoundaryJitterFraction(productId: string): number {
  const day = new Date().toISOString().slice(0, 10);
  let h = 2166136261;
  const str = `${productId}\0${day}`;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const u = (h >>> 0) / 0xffff_ffff;
  return -BOUNDARY_JITTER + u * (2 * BOUNDARY_JITTER);
}

export type RobustMedianOptions = {
  corridor?: { minPrice: number; maxPrice: number };
  /** Requis pour le jitter en bordure de corridor */
  productId?: string;
};

/**
 * Médiane sur l’échantillon, puis on retire tout prix hors [M×(1−band), M×(1+band)],
 * puis médiane sur les prix conservés (si tout est exclu, on garde la première médiane).
 *
 * Corridor : si défini, borne le résultat ; si le prix a été plafonné ou plancher,
 * applique une petite variation ±0,3 % (stable sur la journée) puis re-clamp dans le corridor.
 */
export function robustMedianFromSamplePrices(
  prices: number[],
  band: number = DEFAULT_OUTLIER_BAND,
  options?: RobustMedianOptions
): { medianPriceEur: number; usedCount: number; rawCount: number } | null {
  const corridor = options?.corridor;
  const productId = options?.productId;

  const raw = prices.filter((p) => Number.isFinite(p) && p > 0);
  if (raw.length === 0) return null;

  const m0 = medianOfPositivePrices(raw);
  if (m0 == null) return null;

  const low = m0 * (1 - band);
  const high = m0 * (1 + band);
  const kept = raw.filter((p) => p >= low && p <= high);
  const final = kept.length > 0 ? kept : raw;
  const m1 = medianOfPositivePrices(final);
  if (m1 == null) return null;

  let display = m1;
  let hitBoundary = false;

  if (corridor && Number.isFinite(corridor.minPrice) && Number.isFinite(corridor.maxPrice)) {
    const { minPrice, maxPrice } = corridor;
    if (display > maxPrice) {
      display = maxPrice;
      hitBoundary = true;
    } else if (display < minPrice) {
      display = minPrice;
      hitBoundary = true;
    }

    if (hitBoundary && productId) {
      const jitter = dailyBoundaryJitterFraction(productId);
      display = display * (1 + jitter);
      display = Math.min(maxPrice, Math.max(minPrice, display));
    }
  }

  return {
    medianPriceEur: Math.round(display * 100) / 100,
    usedCount: final.length,
    rawCount: raw.length,
  };
}
