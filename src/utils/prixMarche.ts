import { applyEbayMockMarketPrice } from "../services/ebayMarketPrice";

/** Dernier prix non null dans historique_prix (mois le plus récent avec un prix). */
export function getLastPrixFromHistorique(
  hist: { prix: number | null }[] | undefined
): number {
  if (!hist?.length) return 0;
  const found = [...hist].reverse().find((h) => h.prix !== null && !Number.isNaN(h.prix));
  return found?.prix ?? 0;
}

/** Prix du mois le plus récent <= mois courant (évite les mois futurs). Pour Displays. */
export function getMostRecentPrixFromHistorique(
  hist: { mois?: string; prix: number | null }[] | undefined,
  fallbackPrix?: number
): number {
  if (!hist?.length) return fallbackPrix ?? 0;
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const past = hist
    .filter((h) => h.mois && h.mois <= currentMonth && h.prix != null && !Number.isNaN(h.prix))
    .sort((a, b) => (a.mois ?? "").localeCompare(b.mois ?? ""));
  const lastPast = past[past.length - 1];
  if (lastPast?.prix != null) return lastPast.prix;
  if (fallbackPrix != null && fallbackPrix > 0) return fallbackPrix;
  return getLastPrixFromHistorique(hist);
}

export interface ProductForPrix {
  id: string;
  currentPrice?: number;
  prixMarcheActuel?: number;
  historique_prix?: { prix: number | null }[];
  etbId?: string;
}

export interface EtbForPrix {
  id: string;
  prixActuel?: number;
  historique_prix?: { prix: number | null }[];
}

/** Prix marché affichable : for Displays use product data only (not etbData); for ETB use etbData. */
export function getPrixMarcheForProduct(
  product: ProductForPrix & { category?: string },
  etbData: EtbForPrix[]
): number {
  const isDisplay =
    product.id?.startsWith("display-") || product.category === "Displays";
  const isUPC = product.id?.startsWith("upc-") || product.category === "UPC";

  let base: number;

  if (isDisplay || isUPC) {
    const fromSource = product.prixMarcheActuel ?? product.currentPrice ?? 0;
    if (fromSource > 0) {
      base = fromSource;
    } else if (product.historique_prix?.length) {
      const p = getMostRecentPrixFromHistorique(
        product.historique_prix as { mois?: string; prix: number | null }[],
        fromSource
      );
      base = p > 0 ? p : fromSource;
    } else {
      base = fromSource;
    }
  } else {
    const etb =
      product.etbId && etbData.find((e) => e.id === product.etbId);
    const byId = etbData.find(
      (e) => e.id === product.id || product.id.startsWith(e.id)
    );
    const fromHist = (h: { prix: number | null }[] | undefined) =>
      getLastPrixFromHistorique(h);

    if (etb?.prixActuel != null && etb.prixActuel > 0) {
      base = etb.prixActuel;
    } else if (byId?.prixActuel != null && byId.prixActuel > 0) {
      base = byId.prixActuel;
    } else {
      base = 0;
      if (product.historique_prix?.length) {
        const p = fromHist(product.historique_prix);
        if (p > 0) base = p;
      }
      if (!(base > 0) && etb?.historique_prix?.length) {
        const p = fromHist(etb.historique_prix);
        if (p > 0) base = p;
      }
      if (!(base > 0) && byId?.historique_prix?.length) {
        const p = fromHist(byId.historique_prix);
        if (p > 0) base = p;
      }
      if (!(base > 0)) {
        base = product.prixMarcheActuel ?? product.currentPrice ?? 0;
      }
    }
  }

  return applyEbayMockMarketPrice({
    productId: product.id,
    category: product.category,
    etbId: product.etbId,
    catalogReferencePrice: base,
  });
}

/**
 * Clé `product_id` dans `ebay_prices` / batch `tracked-prices` — même règle que `ProductDetailPage` (`trackedProductId`).
 */
export function ebayPricesTableProductId(product: {
  id?: string | null;
  etbId?: string | null;
  category?: string | null;
}): string | null {
  const rawId = product.etbId ?? product.id ?? null;
  if (!rawId) return null;
  const category = (product.category || "").toLowerCase();
  if (category === "displays" || category === "display") {
    return `display-${String(rawId).replace(/^display-/i, "")}`;
  }
  if (category === "upc") {
    return `upc-${String(rawId).replace(/^upc-/i, "")}`;
  }
  return String(rawId);
}
