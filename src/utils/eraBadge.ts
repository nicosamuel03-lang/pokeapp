import type { CSSProperties } from "react";

/** Style badge ère (cartes produit) : fond semi-transparent + bordure néon alignée filtres / donut. */
const ERA_NEON_CARD_BADGE: Record<string, CSSProperties> = {
  "Méga Évolution": {
    fontSize: "10px",
    padding: "2px 8px",
    borderRadius: "999px",
    background: "rgba(0, 0, 0, 0.6)",
    border: "1px solid #F97316",
    boxShadow: "0 0 4px #F9731680",
    color: "#F97316",
  },
  "Écarlate & Violet": {
    fontSize: "10px",
    padding: "2px 8px",
    borderRadius: "999px",
    background: "rgba(0, 0, 0, 0.6)",
    border: "1px solid #A855F7",
    boxShadow: "0 0 4px #A855F780",
    color: "#A855F7",
  },
  "Épée & Bouclier": {
    fontSize: "10px",
    padding: "2px 8px",
    borderRadius: "999px",
    background: "rgba(0, 0, 0, 0.6)",
    border: "1px solid #22C55E",
    boxShadow: "0 0 4px #22C55E80",
    color: "#22C55E",
  },
  "Soleil et Lune": {
    fontSize: "10px",
    padding: "2px 8px",
    borderRadius: "999px",
    background: "rgba(0, 0, 0, 0.6)",
    border: "1px solid #EAB308",
    boxShadow: "0 0 5px #EAB308CC, 0 0 12px #EAB30880",
    color: "#EAB308",
    textShadow: "0 0 4px #EAB308CC",
  },
};

export function getEraNeonBadgeStyle(eraLabel: string): CSSProperties {
  const base = ERA_NEON_CARD_BADGE[eraLabel];
  if (base) return { ...base };
  return {
    fontSize: "10px",
    padding: "2px 8px",
    borderRadius: "999px",
    background: "rgba(255, 255, 255, 0.08)",
    border: "1px solid rgba(148, 163, 184, 0.45)",
    boxShadow: "0 0 4px #94a3b880",
    color: "var(--text-primary)",
  };
}

const ERA_STYLES: Record<string, { bg: string; color: string }> = {
  "Épée & Bouclier": { bg: "#2E5FA3", color: "#FFFFFF" },
  "Écarlate & Violet": { bg: "#6B3A9E", color: "#FFFFFF" },
  "Méga Évolution": { bg: "#C4621A", color: "#FFFFFF" },
  "Soleil et Lune": { bg: "#EAB308", color: "#FFFFFF" },
  "Célébrations": { bg: "#D4A017", color: "#FFFFFF" },
};

/** Badge d'ère pour ETB, Display et UPC : EB → Épée & Bouclier, EV → Écarlate & Violet, ME → Méga Évolution. Pour UPC, utilise blockLabel si fourni (ex. "Méga Évolution"). */
export function getEraBadge(id: string, blockLabel?: string): { label: string; bg: string; color: string } | null {
  const idToCheck = id.replace(/^display-/i, "").replace(/^upc-/i, "") || id;
  const upper = idToCheck.toUpperCase();
  if (upper.startsWith("EB")) return { label: "Épée & Bouclier", ...ERA_STYLES["Épée & Bouclier"] };
  if (upper.startsWith("EV")) return { label: "Écarlate & Violet", ...ERA_STYLES["Écarlate & Violet"] };
  if (upper.startsWith("ME")) return { label: "Méga Évolution", ...ERA_STYLES["Méga Évolution"] };
  if (upper.startsWith("SL") || upper.startsWith("SM")) return { label: "Soleil et Lune", ...ERA_STYLES["Soleil et Lune"] };
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
    const codeMatch = item.name.match(/\b(EB|EV|ME|SL|SM)\d{2}(?:\.\d)?/i);
    if (codeMatch) badge = getEraBadge(codeMatch[0]);
  }
  if (!badge && item.block && ERA_STYLES[item.block]) {
    badge = { label: item.block, ...ERA_STYLES[item.block] };
  }
  return badge;
}
