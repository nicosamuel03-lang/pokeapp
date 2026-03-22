/**
 * Classes pour `index.css` (html.light) : badges ère sur cartes produit (accueil, collection).
 */
export function productCardEraBadgeClassName(eraLabel: string): string {
  const base =
    "shrink-0 max-w-[min(100%,140px)] truncate font-semibold product-card-era-badge";
  if (eraLabel === "Méga Évolution") return `${base} badge-mega-evolution`;
  if (eraLabel === "Écarlate & Violet") return `${base} badge-ecarlate`;
  if (eraLabel === "Épée & Bouclier") return `${base} badge-epee`;
  return base;
}

export function isKnownProductCardEraLabel(label: string): boolean {
  return (
    label === "Méga Évolution" ||
    label === "Écarlate & Violet" ||
    label === "Épée & Bouclier"
  );
}
