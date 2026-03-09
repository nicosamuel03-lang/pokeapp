import rawData from "./data.json";

type HistoriquePoint = {
  mois: string;
  prix: number;
};

interface RawItem {
  id: number | string;
  quantite?: number;
  dateSortie?: string;
  prixAchat?: number;
  prixMarcheActuel?: number;
  historique?: HistoriquePoint[];
}

const MONTH_LABELS: Record<string, string> = {
  "01": "Janv",
  "02": "Fév",
  "03": "Mars",
  "04": "Avr",
  "05": "Mai",
  "06": "Juin",
  "07": "Juil",
  "08": "Août",
  "09": "Sept",
  "10": "Oct",
  "11": "Nov",
  "12": "Déc"
};

const asItems = (rawData as RawItem[]).map((item) => ({
  id: item.id,
  quantite:
    typeof item.quantite === "number" && item.quantite > 0 ? item.quantite : 1,
  dateSortie:
    typeof item.dateSortie === "string" && item.dateSortie.length === 7
      ? item.dateSortie
      : undefined,
  prixAchat:
    typeof item.prixAchat === "number" && item.prixAchat > 0
      ? item.prixAchat
      : 0,
  prixMarcheActuel:
    typeof item.prixMarcheActuel === "number" && item.prixMarcheActuel > 0
      ? item.prixMarcheActuel
      : undefined,
  historique: Array.isArray(item.historique) ? item.historique : []
}));

export const PORTFOLIO_TOTAL_INVESTED = asItems.reduce((acc, item) => {
  return acc + item.prixAchat * item.quantite;
}, 0);

export interface PortfolioHistoryPoint {
  iso: string;
  date: string;
  valeur: number;
}

const formatMonthLabel = (iso: string): string => {
  const [year, month] = iso.split("-");
  const label = MONTH_LABELS[month] ?? month;
  return `${label} ${year}`;
};

const computePortfolioHistory = (): PortfolioHistoryPoint[] => {
  const points: PortfolioHistoryPoint[] = [];

  const startYear = 2016;
  const startMonth = 1;
  const endYear = 2026;
  const endMonth = 2;

  let year = startYear;
  let month = startMonth;

  const formatIso = (y: number, m: number) =>
    `${y}-${String(m).padStart(2, "0")}`;

  while (year < endYear || (year === endYear && month <= endMonth)) {
    const iso = formatIso(year, month);
    let total = 0;

    for (const item of asItems) {
      if (item.dateSortie && iso < item.dateSortie) {
        continue;
      }

      const historique = item.historique;
      if (!historique.length) continue;

      let lastPrice: number | null = null;
      for (const point of historique) {
        if (point.mois <= iso) {
          lastPrice = point.prix;
        } else {
          break;
        }
      }

      if (lastPrice === null) continue;

      total += lastPrice * item.quantite;
    }

    points.push({
      iso,
      date: formatMonthLabel(iso),
      valeur: total
    });

    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }

  return points;
};

export const portfolioHistory: PortfolioHistoryPoint[] =
  computePortfolioHistory();

