import { etbData, type EtbBloc } from "./etbData";
import { displayData } from "./displayData";
import { removeAccents } from "../utils/textNormalize";

export { removeAccents } from "../utils/textNormalize";

export type ModernBlock = "Méga Évolution" | "Écarlate & Violet" | "Épée & Bouclier";

export type ModernSealedType = "Display" | "ETB" | "UPC";

export interface PokemonCatalogueItem {
  id: string;
  name: string;
  block: ModernBlock;
  type: ModernSealedType;
  releaseDate: string; // "YYYY-MM"
  /** Prix de sortie TTC France (approx., ETB 55€, Display 215€ par défaut) */
  msrp: number;
  /** Prix moyen marché FR ~février 2026 (Cardmarket / boutiques EU) */
  currentMarketPrice: number;
  imageUrl: string | null;
  emoji: string;
  /** Marque les sorties du bloc le plus récent (2025/2026) */
  isNew?: boolean;
  /** Id dans etbData pour dériver le prix depuis historique_prix */
  etbId?: string;
}

/** Displays : displayData est la source unique (EB01-EB12, EV01-EV10, ME01-ME03). Aucune entrée manuelle. */
export const pokemonCatalogue: PokemonCatalogueItem[] = [];

// ============================================================================
// Extension automatique du catalogue à partir de etbData (toutes les ETB)
// ============================================================================

const BLOC_LABEL: Record<EtbBloc, ModernBlock> = {
  eb: "Épée & Bouclier",
  ev: "Écarlate & Violet",
  me: "Méga Évolution",
};

// Convertit un "DD/MM/YYYY" (feuille Excel) en "YYYY-MM" pour le catalogue
function excelDateToRelease(dateSortie: string): string {
  const parts = dateSortie.split("/");
  if (parts.length === 3) {
    const [dd, mm, yyyy] = parts;
    if (yyyy && mm) {
      return `${yyyy}-${mm.padStart(2, "0")}`;
    }
  }
  return "2020-01";
}

/** Slug stable par nom d’ETB : plusieurs lignes peuvent partager le même code set (ex. EV04 + EV04 « 2 »). */
function slugifyEtbNom(nom: string): string {
  const s = removeAccents(nom)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return s || "item";
}

// ETB catalogue: single source of truth from etbData.ts (same as home page)
const autoEtbItems: PokemonCatalogueItem[] = etbData.map((etb) => ({
  /** Id unique par produit (évite d’écraser Faille Paradoxe / Faille Paradoxe 2 au dédoublonnage). */
  id: `etb-${etb.id}-${slugifyEtbNom(etb.nom)}`,
  name: `ETB ${etb.nom}`,
    block: BLOC_LABEL[etb.bloc],
    type: "ETB",
    releaseDate: excelDateToRelease(etb.dateSortie),
    msrp: etb.pvcSortie,
    currentMarketPrice: etb.prixActuel,
    imageUrl: etb.imageUrl,
    emoji: "🎁",
    etbId: etb.id,
  }));

const manualAndEtbIds = new Set([
  ...pokemonCatalogue.map((i) => i.id),
  ...autoEtbItems.map((i) => i.id),
]);

const autoDisplayItems: PokemonCatalogueItem[] = displayData
  .filter((d) => d.category === "Displays" && !manualAndEtbIds.has(d.id) && !manualAndEtbIds.has(`display-${d.id}`))
  .map((d) => ({
    id: d.id.startsWith("display-") ? d.id : `display-${d.id}`,
    name: d.name.includes(" FR") ? d.name : `${d.name} FR`,
    block: d.block as ModernBlock,
    type: "Display" as const,
    releaseDate: d.releaseDate,
    msrp: d.msrp,
    currentMarketPrice: d.currentMarketPrice,
    imageUrl: d.imageUrl,
    emoji: "📦",
    etbId: d.id.replace(/^display-/, ""),
  }));

const autoUpcItems: PokemonCatalogueItem[] = displayData
  .filter((d) => d.category === "UPC")
  .map((d) => ({
    id: d.id.startsWith("upc-") ? d.id : `upc-${d.id}`,
    name: d.name.includes(" FR") ? d.name : `${d.name} FR`,
    block: d.block as ModernBlock,
    type: "UPC" as const,
    releaseDate: d.releaseDate,
    msrp: d.msrp,
    currentMarketPrice: d.currentMarketPrice,
    imageUrl: d.imageUrl,
    emoji: "🎁",
    etbId: d.id.replace(/^upc-/, ""),
  }));

/** Pour chaque item de type Display, remplace imageUrl par celui de displayData si un entrant correspond (nom ou bloc). */
function resolveDisplayImageUrls(
  items: PokemonCatalogueItem[]
): PokemonCatalogueItem[] {
  return items.map((item) => {
    if (item.type !== "Display") return item;
    const match = displayData.find(
      (d) =>
        item.name.includes(d.name) ||
        (item.block && d.name.includes(item.block))
    );
    if (match) return { ...item, imageUrl: match.imageUrl };
    return item;
  });
}

const FULL_CATALOGUE: PokemonCatalogueItem[] = resolveDisplayImageUrls([
  ...pokemonCatalogue,
  ...autoEtbItems,
  ...autoDisplayItems,
  ...autoUpcItems,
]);

console.log(
  "Display items sample:",
  FULL_CATALOGUE.filter((i) => JSON.stringify(i).toLowerCase().includes("display")).slice(0, 3)
);

function dedupeCatalogueById(items: PokemonCatalogueItem[]): PokemonCatalogueItem[] {
  return Array.from(new Map(items.map((item) => [item.id, item])).values());
}

/**
 * Recherche : texte agrégé (nom, type, bloc, id) — les Displays n’ont souvent pas « Display » dans le nom (ex. « EV03 Flammes… »), mais `type` vaut « Display ».
 * 1 mot → sous-chaîne ; plusieurs mots → chaque mot doit apparaître dans ce texte.
 * Déduplication par `id`. Le tri pour l’affichage est fait dans `SearchCatalogue` après filtrage.
 */
type SearchableCatalogueFields = PokemonCatalogueItem &
  Partial<{ title: string; label: string; category: string }>;

export const searchPokemonCatalogue = (query: string): PokemonCatalogueItem[] => {
  const trimmed = query.trim();
  if (!trimmed) return dedupeCatalogueById(FULL_CATALOGUE);

  const normalizedQuery = removeAccents(query.toLowerCase().trim());
  const queryWords = normalizedQuery.split(/\s+/).filter((w) => w.length > 0);
  if (queryWords.length === 0) return dedupeCatalogueById(FULL_CATALOGUE);

  const filtered = FULL_CATALOGUE.filter((raw) => {
    const item = raw as SearchableCatalogueFields;
    const searchableText = removeAccents(
      [item.name, item.title, item.label, item.type, item.category, item.block, item.id]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
    );

    if (queryWords.length === 1) {
      return searchableText.includes(queryWords[0]);
    }
    return queryWords.every((word) => searchableText.includes(word));
  });

  return Array.from(new Map(filtered.map((item) => [item.id, item])).values());
};

