import { getSetCodeFromProduct } from "./formatProduct";

/**
 * Seuils planchers (€) pour détecter un prix marché manifestement sous-évalué
 * (ex. Display EB07 pollué par boosters / codes). À ajuster selon le marché.
 * Doit rester aligné avec la logique serveur dans `server/ebayBrowse.js`.
 */
const MIN_DISPLAY_MARKET_EUR_BY_SET: Partial<Record<string, number>> = {
  EB07: 450,
};

/**
 * Affiche l’avertissement « Market Data Warning » si le prix affiché est trop bas
 * pour un Display connu (code set catalogue).
 */
export function getMarketDataWarningForDisplayedPrice(
  product: { category?: string | null; id?: string; etbId?: string } | null,
  priceEur: number
): boolean {
  if (!product || !Number.isFinite(priceEur) || priceEur <= 0) return false;
  const cat = (product.category || "").toLowerCase();
  const isDisplay =
    cat === "displays" ||
    cat === "display" ||
    (typeof product.id === "string" && product.id.startsWith("display-"));
  if (!isDisplay) return false;
  const code = getSetCodeFromProduct(product);
  if (!code) return false;
  const min = MIN_DISPLAY_MARKET_EUR_BY_SET[code];
  if (min == null) return false;
  return priceEur < min;
}
