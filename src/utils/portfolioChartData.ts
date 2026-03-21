import type { Product } from "../state/ProductsContext";
import { etbData } from "../data/etbData";
import { displayData } from "../data/displayData";
import { getPrixMarcheForProduct } from "./prixMarche";

type HistPrix = { mois: string; prix: number | null }[] | undefined;

export const PORTFOLIO_CHART_HEIGHT = 300;

export const MOIS_KEYS_1AN = [
  "2025-02", "2025-03", "2025-04", "2025-05", "2025-06", "2025-07", "2025-08", "2025-09", "2025-10", "2025-11", "2025-12",
  "2026-01", "2026-02",
];
export const MOIS_LABELS_1AN = ["Fév 25", "Mar 25", "Avr 25", "Mai 25", "Juin 25", "Juil 25", "Août 25", "Sept 25", "Oct 25", "Nov 25", "Déc 25", "Jan 26", "Fév 26"];
export const MOIS_KEYS_2ANS = [
  "2024-02", "2024-03", "2024-04", "2024-05", "2024-06", "2024-07", "2024-08", "2024-09", "2024-10", "2024-11", "2024-12",
  "2025-01", "2025-02", "2025-03", "2025-04", "2025-05", "2025-06", "2025-07", "2025-08", "2025-09", "2025-10", "2025-11", "2025-12",
  "2026-01", "2026-02",
];
export const MOIS_LABELS_2ANS = [
  "Fév 24", "Mar 24", "Avr 24", "Mai 24", "Juin 24", "Juil 24", "Août 24", "Sept 24", "Oct 24", "Nov 24", "Déc 24",
  "Jan 25", "Fév 25", "Mar 25", "Avr 25", "Mai 25", "Juin 25", "Juil 25", "Août 25", "Sept 25", "Oct 25", "Nov 25", "Déc 25",
  "Jan 26", "Fév 26",
];

export interface CollectionLineForChart {
  quantity: number;
  buyPrice: number;
  product: Product;
}

function getPriceAtMonthCarryForward(hist: HistPrix, monthKey: string): number {
  if (!hist?.length) return 0;
  let last = 0;
  for (const point of hist) {
    if (point.mois <= monthKey && point.prix != null && !Number.isNaN(point.prix)) last = point.prix;
    if (point.mois === monthKey) return point.prix != null && !Number.isNaN(point.prix) ? point.prix : last;
  }
  return last;
}

function getHistoriquePrix(item: { product: { id: string; etbId?: string; historique_prix?: HistPrix } }): HistPrix {
  if (item.product.historique_prix?.length) return item.product.historique_prix;
  const etb = getEtbForItem(item);
  return etb?.historique_prix;
}

function getEtbForItem(item: { product: { id: string; etbId?: string } }): (typeof etbData)[number] | undefined {
  return item.product.etbId
    ? etbData.find((e) => e.id === item.product.etbId)
    : etbData.find((e) => e.id === item.product.id || item.product.id.startsWith(e.id));
}

export function getReleaseMonthKeyForItem(item: { product: { id: string; etbId?: string; category?: string } }): string | null {
  const etb = getEtbForItem(item);
  if (etb?.dateSortie) {
    const parts = String(etb.dateSortie).trim().split("/");
    if (parts.length === 3) {
      const [, m, y] = parts;
      const month = String(m ?? "").padStart(2, "0");
      const year = String(y ?? "").trim();
      if (month && year) return `${year}-${month}`;
    }
  }
  const displayId = item.product.id.replace(/^display-/, "").replace(/^upc-/, "");
  const display = displayData.find((d) => d.id === displayId || d.id === item.product.etbId);
  if (display?.releaseDate) {
    const d = display.releaseDate;
    return d.length >= 7 ? d.slice(0, 7) : null;
  }
  return null;
}

function getPriceAtMonthForItem(
  item: { product: { id: string; etbId?: string; historique_prix?: HistPrix } },
  moisKey: string
): number {
  const etb = getEtbForItem(item);
  const hist =
    moisKey.startsWith("2024-")
      ? etb?.historique_prix_2024
      : moisKey.startsWith("2025-")
        ? etb?.historique_prix_2025
        : getHistoriquePrix(item);
  let price = getPriceAtMonthCarryForward(hist, moisKey);
  if (price === 0 && !hist?.length) {
    price = getPrixMarcheForProduct(item.product, etbData);
  }
  return price;
}

export function buildPortfolioChartData(
  collectionItems: CollectionLineForChart[],
  chartPeriod: "1an" | "2ans",
  totalInvesti: number
) {
  const keys = chartPeriod === "1an" ? MOIS_KEYS_1AN : MOIS_KEYS_2ANS;
  const labels = chartPeriod === "1an" ? [...MOIS_LABELS_1AN] : MOIS_LABELS_2ANS;
  return keys.map((moisKey, index) => {
    let sum = 0;
    collectionItems.forEach((item) => {
      const releaseMonth = getReleaseMonthKeyForItem(item);
      if (releaseMonth && moisKey < releaseMonth) {
        return;
      }
      sum += getPriceAtMonthForItem(item, moisKey) * Number(item.quantity);
    });
    const valeurMarche = Math.round(sum * 100) / 100;
    return {
      mois: labels[index],
      investissement: totalInvesti,
      valeurMarche,
    };
  });
}

export interface SaleLike {
  profit?: number | null;
}

export function computePortfolioStats(collectionItems: CollectionLineForChart[], sales: SaleLike[]) {
  let totalInvestiP = 0;
  let totalMarcheP = 0;
  collectionItems.forEach((item) => {
    const qty = Number(item.quantity);
    const prixAchat = item.buyPrice ?? item.product.prixAchat ?? 0;
    totalInvestiP += prixAchat * qty;
    totalMarcheP += getPrixMarcheForProduct(item.product, etbData) * qty;
  });
  const plusValueLatente = totalMarcheP - totalInvestiP;
  const gainRealise = sales.reduce((sum, r) => sum + (r.profit ?? 0), 0);
  const plusValueTotale = plusValueLatente + gainRealise;
  const perfGlobale = totalInvestiP > 0 ? (plusValueTotale / totalInvestiP) * 100 : 0;
  return {
    totalInvesti: totalInvestiP,
    totalMarche: totalMarcheP,
    plusValueLatente,
    gainRealise,
    plusValueTotale,
    perfGlobale,
  };
}

export function totalInvestedFromCollection(collectionItems: CollectionLineForChart[]): number {
  return collectionItems.reduce((sum, item) => {
    return sum + (Number(item.buyPrice ?? item.product.prixAchat ?? 0) * Number(item.quantity));
  }, 0);
}
