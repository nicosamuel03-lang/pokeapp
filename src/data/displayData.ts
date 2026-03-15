/** Généré par scripts/build-display-data.mjs (pokedisplay.xlsx).
 * Source de vérité: src/data/display-data.json
 */
import rawDisplayData from "./display-data.json";

export interface DisplayHistoriquePrixPoint {
  mois: string;
  mois_label: string;
  prix: number | null;
}

export interface DisplayDataItem {
  id: string;
  name: string;
  category: "Displays" | "ETB";
  block: string;
  releaseDate: string;
  msrp: number;
  currentMarketPrice: number;
  imageUrl: string | null;
  historique_prix: DisplayHistoriquePrixPoint[];
}

export const displayData = rawDisplayData as DisplayDataItem[];
