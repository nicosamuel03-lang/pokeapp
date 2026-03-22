/**
 * Mode « marché » sans API eBay : prix figés / dérivés pour le design et les tests.
 * Activez avec : VITE_EBAY_STATUS=MOCK
 *
 * Les clés ci-dessous sont optionnelles ; les produits absents utilisent un prix
 * stable dérivé du prix catalogue + de l’id (pas d’appel réseau).
 */

/**
 * Prix mock explicites (€). Clés namespacées : `etb:`, `display:`, `upc:`
 * (évite les collisions quand un ETB et un Display partagent le même id court).
 */
const EBAY_MOCK_PRICES_EUR: Record<string, number> = {
  "etb:ME02.5": 82,
  "etb:ME02": 78,
  "etb:SV10.5": 95,
  "etb:SV9": 88,
  "display:ME02": 215,
  "display:ME01": 198,
  "upc:UPC08": 195,
};

export function isEbayMockMode(): boolean {
  const v = import.meta.env.VITE_EBAY_STATUS;
  return String(v ?? "").toUpperCase() === "MOCK";
}

function mockKeyForProduct(
  productId: string,
  category: string | undefined
): { namespacedLookup: string; stableSeed: string } {
  const isDisplay =
    productId.startsWith("display-") || category === "Displays";
  const isUPC = productId.startsWith("upc-") || category === "UPC";
  if (isDisplay) {
    const raw = productId.replace(/^display-/, "");
    return {
      namespacedLookup: `display:${raw}`,
      stableSeed: `display:${raw}`,
    };
  }
  if (isUPC) {
    const raw = productId.replace(/^upc-/, "");
    return { namespacedLookup: `upc:${raw}`, stableSeed: `upc:${raw}` };
  }
  return {
    namespacedLookup: `etb:${productId}`,
    stableSeed: `etb:${productId}`,
  };
}

/** Petit hash déterministe pour un décalage € stable par produit. */
function stableEuroDelta(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(31, h) + seed.charCodeAt(i);
    h |= 0;
  }
  // Entre -11 € et +11 €
  return (Math.abs(h) % 23) - 11;
}

/**
 * Applique le mode mock au prix « marché courant » affiché (cartes, détail, portefeuille).
 * Hors mock : retourne `catalogReferencePrice` inchangé.
 */
export function applyEbayMockMarketPrice(params: {
  productId: string;
  category?: string;
  /** Souvent identique à productId pour les ETB */
  etbId?: string;
  catalogReferencePrice: number;
}): number {
  if (!isEbayMockMode()) return params.catalogReferencePrice;

  const { namespacedLookup, stableSeed } = mockKeyForProduct(
    params.productId,
    params.category
  );

  const explicit =
    EBAY_MOCK_PRICES_EUR[namespacedLookup] ??
    (params.etbId
      ? EBAY_MOCK_PRICES_EUR[`etb:${params.etbId}`] ??
        EBAY_MOCK_PRICES_EUR[`display:${params.etbId}`] ??
        EBAY_MOCK_PRICES_EUR[`upc:${params.etbId}`]
      : undefined);

  if (explicit != null && Number.isFinite(explicit) && explicit > 0) {
    return Math.round(explicit);
  }

  const base =
    params.catalogReferencePrice > 0
      ? params.catalogReferencePrice
      : 49;
  const next = Math.max(1, Math.round(base + stableEuroDelta(stableSeed)));
  return next;
}
