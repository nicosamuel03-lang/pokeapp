import { etbData } from "../data/etbData";
import { displayData } from "../data/displayData";

/** Collecte toutes les URLs d'images produits (ETB + Display) pour préchargement. */
function collectProductImageUrls(): string[] {
  const urls: string[] = [];
  const seen = new Set<string>();

  for (const item of etbData) {
    const url = item.imageUrl;
    if (url && typeof url === "string" && url.startsWith("/") && !seen.has(url)) {
      seen.add(url);
      urls.push(url);
    }
  }

  for (const d of displayData) {
    let url = d.imageUrl;
    if (url && typeof url === "string") {
      // Chemins locaux (/images/displays/...) : utiliser tels quels
      if (!url.startsWith("/images/displays/") && (url.includes("https://") || url.includes("http://"))) {
        url = url.replace(/^\/images\/pokedata\//, "");
      }
      if (url.trim() && !seen.has(url)) {
        seen.add(url);
        urls.push(url);
      }
    }
  }

  return urls;
}

/**
 * Précharge les images produits (opt-in via VITE_PRELOAD_PRODUCT_IMAGES=true).
 * Par défaut désactivé dans main.tsx pour limiter le « Fast Data Transfer » sur Vercel.
 */
export function preloadProductImages(): void {
  const urls = collectProductImageUrls();
  for (const url of urls) {
    try {
      const img = new Image();
      img.src = url;
    } catch {
      /* ignorer les erreurs de préchargement */
    }
  }
}
