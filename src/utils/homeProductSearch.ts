import { removeAccents } from "./textNormalize";

/** Champs alignés sur la logique Catalogue (nom + métadonnées indexables). */
export interface HomeSearchableRow {
  name: string;
  category: string;
  set: string;
  id: string;
  badge: string;
}

/** Filtre insensible aux accents, multi-mots (chaque mot doit apparaître dans le texte agrégé). */
export function filterHomeProductsBySearch<T extends HomeSearchableRow>(products: T[], query: string): T[] {
  const trimmed = query.trim();
  if (!trimmed) return products;

  const normalizedQuery = removeAccents(query.toLowerCase().trim());
  const queryWords = normalizedQuery.split(/\s+/).filter((w) => w.length > 0);
  if (queryWords.length === 0) return products;

  return products.filter((p) => {
    const searchableText = removeAccents(
      [p.name, p.category, p.set, p.id, p.badge].filter(Boolean).join(" ").toLowerCase()
    );
    if (queryWords.length === 1) return searchableText.includes(queryWords[0]);
    return queryWords.every((word) => searchableText.includes(word));
  });
}

function categoryTypeRank(cat: string): number {
  if (cat === "ETB") return 0;
  if (cat === "Displays") return 1;
  if (cat === "UPC") return 2;
  return 3;
}

/** Même règles que le tri Catalogue : préfixe sur le nom (sans accents), puis ETB > Display > UPC si même préfixe, puis localeCompare. */
export function sortHomeProductsBySearch<T extends HomeSearchableRow>(products: T[], query: string): T[] {
  const q = query.trim();
  if (!q) return [...products];

  const normalizedQuerySort = removeAccents(q.toLowerCase());
  return [...products].sort((a, b) => {
    const nameA = (a.name || "").toLowerCase();
    const nameB = (b.name || "").toLowerCase();
    const aStarts = removeAccents(nameA).startsWith(normalizedQuerySort);
    const bStarts = removeAccents(nameB).startsWith(normalizedQuerySort);
    if (aStarts && !bStarts) return -1;
    if (!aStarts && bStarts) return 1;
    if (aStarts && bStarts) {
      const tr = categoryTypeRank(a.category) - categoryTypeRank(b.category);
      if (tr !== 0) return tr;
    }
    return nameA.localeCompare(nameB);
  });
}
