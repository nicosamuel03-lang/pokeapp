/**
 * Évolution mensuelle de la valeur totale du portefeuille global
 * Janvier 2016 → Février 2026
 *
 * Règles de calcul :
 *  - Avant la date de sortie d'un item : valeur = 0 €
 *  - Premier mois de disponibilité    : utilise le MSRP officiel FR
 *    (ETB = 55 €, Display = 215 €, autres = 1er prix historique)
 *  - Mois suivants                    : utilise le prix historique connu
 */
import rawData from "./data.json";

// ── types internes ──────────────────────────────────────────────────────────
type HistPoint = { mois: string; prix: number };
interface RawItem {
  id:               number | string;
  categorie?:       string;
  quantite?:        number;
  dateSortie?:      string;
  prixMarcheActuel?: number;
  historique?:      HistPoint[];
}

// ── MSRP par catégorie ──────────────────────────────────────────────────────
const CATEGORY_MSRP: Record<string, number> = {
  ETB:     55,
  Display: 215,
};

// ── Normalisation des items ─────────────────────────────────────────────────
const items = (rawData as RawItem[]).map((item) => ({
  categorie:   item.categorie ?? "",
  quantite:    typeof item.quantite === "number" && item.quantite > 0 ? item.quantite : 1,
  dateSortie:  typeof item.dateSortie === "string" ? item.dateSortie : null,
  historique:  Array.isArray(item.historique) ? item.historique : [],
}));

// ── Calcul total investi (somme prixAchat × quantite) ───────────────────────
export const GLOBAL_TOTAL_INVESTED: number = (rawData as any[]).reduce(
  (acc, item) =>
    acc +
    (typeof item.prixAchat === "number" ? item.prixAchat : 0) *
      (typeof item.quantite === "number" && item.quantite > 0 ? item.quantite : 1),
  0
);

// ── Interface du point de sortie ────────────────────────────────────────────
export interface GlobalHistoryPoint {
  iso:    string;   // "2021-08"
  date:   string;   // "Août 2021"
  valeur: number;   // valeur totale en €
}

// ── Utilitaire formatage date ────────────────────────────────────────────────
const MONTH_FR: Record<string, string> = {
  "01": "Janv", "02": "Fév",  "03": "Mars", "04": "Avr",
  "05": "Mai",  "06": "Juin", "07": "Juil", "08": "Août",
  "09": "Sept", "10": "Oct",  "11": "Nov",  "12": "Déc",
};

const toLabel = (iso: string): string => {
  const [y, m] = iso.split("-");
  return `${MONTH_FR[m] ?? m} ${y}`;
};

// ── Calcul principal ─────────────────────────────────────────────────────────
const buildHistory = (): GlobalHistoryPoint[] => {
  const result: GlobalHistoryPoint[] = [];

  let year = 2016, month = 1;
  const endYear = 2026, endMonth = 2;

  while (year < endYear || (year === endYear && month <= endMonth)) {
    const iso = `${year}-${String(month).padStart(2, "0")}`;
    let total = 0;

    for (const item of items) {
      // Avant sortie : valeur = 0
      if (item.dateSortie && iso < item.dateSortie) {
        month++; if (month > 12) { month = 1; year++; }
        continue;
      }

      const hist = item.historique;
      if (!hist.length) continue;

      // Chercher le dernier prix connu ≤ iso
      let lastPrice: number | null = null;
      for (const pt of hist) {
        if (pt.mois <= iso) { lastPrice = pt.prix; }
        else break;
      }

      if (lastPrice === null) continue;

      // Premier point disponible → MSRP si catégorie connue
      const isFirstPoint = hist[0].mois === iso;
      const msrp = CATEGORY_MSRP[item.categorie] ?? null;
      const price = isFirstPoint && msrp !== null ? msrp : lastPrice;

      total += price * item.quantite;
    }

    result.push({ iso, date: toLabel(iso), valeur: Math.round(total * 100) / 100 });

    month++;
    if (month > 12) { month = 1; year++; }
  }

  return result;
};

export const globalHistory: GlobalHistoryPoint[] = buildHistory();
