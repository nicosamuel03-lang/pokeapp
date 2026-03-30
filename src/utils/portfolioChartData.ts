import type { Product } from "../state/ProductsContext";
import { etbData } from "../data/etbData";
import { displayData } from "../data/displayData";
import { getPrixMarcheForProduct } from "./prixMarche";

type HistPrix = { mois: string; prix: number | null }[] | undefined;

export const PORTFOLIO_CHART_HEIGHT = 300;

export type PortfolioChartPeriod = "6m" | "1an";

const MOIS_COURTS_FR = [
  "Jan",
  "Fév",
  "Mar",
  "Avr",
  "Mai",
  "Juin",
  "Juil",
  "Août",
  "Sept",
  "Oct",
  "Nov",
  "Déc",
] as const;

function isoMonthNow(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function addOneCalendarMonth(ym: string): string | null {
  const m = ym.match(/^(\d{4})-(\d{2})/);
  if (!m) return null;
  let y = Number(m[1]);
  let mo = Number(m[2]);
  mo += 1;
  if (mo > 12) {
    mo = 1;
    y += 1;
  }
  return `${y}-${String(mo).padStart(2, "0")}`;
}

function subtractCalendarMonths(ym: string, n: number): string {
  const m = ym.match(/^(\d{4})-(\d{2})/);
  if (!m) return ym;
  let y = Number(m[1]);
  let mo = Number(m[2]);
  let left = Math.max(0, Math.floor(n));
  while (left > 0) {
    mo -= 1;
    if (mo < 1) {
      mo = 12;
      y -= 1;
    }
    left -= 1;
  }
  return `${y}-${String(mo).padStart(2, "0")}`;
}

function isoMonthToShortLabel(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})/);
  if (!m) return iso;
  const mi = parseInt(m[2], 10) - 1;
  if (mi < 0 || mi > 11) return iso;
  return `${MOIS_COURTS_FR[mi]} ${String(m[1]).slice(-2)}`;
}

/** `count` mois calendaires inclusifs jusqu’à `endMonth` (YYYY-MM). */
function getRollingMonthKeys(endMonth: string, count: number): string[] {
  const first = subtractCalendarMonths(endMonth, count - 1);
  const keys: string[] = [];
  let cur: string | null = first;
  while (cur) {
    keys.push(cur);
    if (cur >= endMonth) break;
    const next = addOneCalendarMonth(cur);
    if (!next || next > endMonth) break;
    cur = next;
  }
  return keys;
}

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
  chartPeriod: PortfolioChartPeriod,
  totalInvesti: number
) {
  const monthCount = chartPeriod === "1an" ? 12 : 6;
  const keys = getRollingMonthKeys(isoMonthNow(), monthCount);
  const labels = keys.map(isoMonthToShortLabel);
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

/**
 * @param ebayPriceMap  Map optionnelle `productId → prix eBay moyen 7j`.
 *                      Lorsqu'une entrée est présente, elle remplace le prix catalogue
 *                      pour le calcul de la valeur marché actuelle du portefeuille.
 */
export function computePortfolioStats(
  collectionItems: CollectionLineForChart[],
  sales: SaleLike[],
  ebayPriceMap?: Map<string, number>
) {
  let totalInvestiP = 0;
  let totalMarcheP = 0;
  collectionItems.forEach((item) => {
    const qty = Number(item.quantity);
    const prixAchat = item.buyPrice ?? item.product.prixAchat ?? 0;
    totalInvestiP += prixAchat * qty;

    // Priorité : prix eBay tracké (Supabase 7j) → prix catalogue
    const productId = item.product.etbId ?? item.product.id;
    const ebayPrice = ebayPriceMap?.get(productId);
    const marketPrice =
      ebayPrice != null && ebayPrice > 0
        ? ebayPrice
        : getPrixMarcheForProduct(item.product, etbData);
    totalMarcheP += marketPrice * qty;
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
