const ERA_STYLES: Record<string, { bg: string; color: string }> = {
  "Épée & Bouclier": { bg: "#2E5FA3", color: "#FFFFFF" },
  "Écarlate & Violet": { bg: "#6B3A9E", color: "#FFFFFF" },
  "Méga Évolution": { bg: "#C4621A", color: "#FFFFFF" },
  "Célébrations": { bg: "#D4A017", color: "#FFFFFF" },
};

/** Badge d'ère pour ETB, Display et UPC : EB → Épée & Bouclier, EV → Écarlate & Violet, ME → Méga Évolution. Pour UPC, utilise blockLabel si fourni (ex. "Méga Évolution"). */
export function getEraBadge(id: string, blockLabel?: string): { label: string; bg: string; color: string } | null {
  const idToCheck = id.replace(/^display-/i, "").replace(/^upc-/i, "") || id;
  const upper = idToCheck.toUpperCase();
  if (upper.startsWith("EB")) return { label: "Épée & Bouclier", ...ERA_STYLES["Épée & Bouclier"] };
  if (upper.startsWith("EV")) return { label: "Écarlate & Violet", ...ERA_STYLES["Écarlate & Violet"] };
  if (upper.startsWith("ME")) return { label: "Méga Évolution", ...ERA_STYLES["Méga Évolution"] };
  if (upper.startsWith("UPC")) {
    if (blockLabel) return { label: blockLabel, ...getEraStyle(blockLabel) };
    return { label: "UPC", ...ERA_STYLES["Célébrations"] };
  }
  return null;
}

/** Styles pour un libellé d'ère (ex. filtres par génération). Fallback gris si inconnu. */
export function getEraStyle(label: string): { bg: string; color: string } {
  return ERA_STYLES[label] ?? { bg: "#4A5568", color: "#FFFFFF" };
}

/** Badge d'ère pour un item catalogue (ETB, Display ou UPC). Infère l'ère depuis le code dans le nom si id ne matche pas. Pour UPC, utilise item.block (bloc) au lieu de "UPC". */
export function getEraBadgeForCatalogueItem(item: {
  id?: string;
  etbId?: string;
  name?: string;
  block?: string;
  type?: string;
}): { label: string; bg: string; color: string } | null {
  if (!item) return null;
  let badge = getEraBadge(item.etbId ?? item.id ?? "", item.block);
  if (!badge && item.name) {
    const codeMatch = item.name.match(/\b(EB|EV|ME)\d{2}(?:\.\d)?/i);
    if (codeMatch) badge = getEraBadge(codeMatch[0]);
  }
  if (!badge && item.block && ERA_STYLES[item.block]) {
    badge = { label: item.block, ...ERA_STYLES[item.block] };
  }
  return badge;
}
