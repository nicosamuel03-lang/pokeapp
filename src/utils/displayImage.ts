/**
 * Utilitaire pour les images Display — même source et transform que la page d'accueil.
 * La page d'accueil utilise displayData.imageUrl avec la transformation ci-dessous.
 */
import { displayData } from "../data/displayData";

/** Transforme l'URL image Display : chemins locaux utilisés tels quels, URLs externes dépouillées du préfixe pokedata. */
export function normalizeDisplayImageUrl(imageUrl: string | null | undefined): string | null {
  if (!imageUrl || typeof imageUrl !== "string") return null;
  const trimmed = imageUrl.trim();
  if (!trimmed) return null;
  // Chemins locaux (/images/displays/...) : utiliser tels quels
  if (trimmed.startsWith("/images/displays/")) return trimmed;
  // URLs externes (préfixées par /images/pokedata/) : retirer le préfixe pour obtenir l'URL directe
  if (trimmed.includes("https://") || trimmed.includes("http://")) {
    return trimmed.replace(/^\/images\/pokedata\//, "");
  }
  return trimmed;
}

/**
 * Retourne l'URL image Display ou UPC pour un item catalogue, en utilisant displayData.
 */
export function getDisplayImageUrlForCatalogueItem(
  item: { id?: string; name?: string; type?: string }
): string | null {
  if (!item) return null;
  const isDisplay = item.type === "Display";
  const isUPC = item.type === "UPC";
  if (!isDisplay && !isUPC) return null;

  const data = Array.isArray(displayData) ? displayData : [];
  let found: (typeof displayData)[number] | undefined;

  if (item.id?.startsWith("display-")) {
    const baseId = item.id.slice("display-".length);
    found = data.find((d) => d?.id === baseId);
  }
  if (!found && item.id?.startsWith("upc-")) {
    const baseId = item.id.slice("upc-".length);
    found = data.find((d) => d?.id === baseId);
  }

  if (!found && item.name) {
    const codeMatch = item.name.match(/\b(?:EB|EV|ME)[0-9.]+/i);
    if (codeMatch) {
      const code = codeMatch[0].toUpperCase();
      found = data.find((d) => d?.id?.toUpperCase() === code);
    }
  }

  if (!found && item.name) {
    const itemNameLower = item.name.toLowerCase();
    found = data.find((d) => {
      const displayName = (d?.name ?? "").toLowerCase();
      if (!displayName) return false;
      return itemNameLower.includes(displayName) || displayName.includes(itemNameLower);
    });
  }

  return normalizeDisplayImageUrl(found?.imageUrl ?? null);
}
