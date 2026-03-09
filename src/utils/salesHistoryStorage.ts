/**
 * Stockage des ventes réalisées : prix de vente, date, bénéfice.
 * Persisté dans localStorage pour mise à jour de la Synthèse de portefeuille.
 */

const STORAGE_KEY = "pokevault_sales_history_v1";

export interface SaleRecord {
  id: string;
  productId: string;
  productName: string;
  /** URL de l'image produit, stockée au moment de la vente pour affichage correct dans l'Historique. */
  image?: string | null;
  /** @deprecated Utiliser `image`. Conservé pour compatibilité avec les anciennes ventes. */
  imageUrl?: string | null;
  buyPrice: number;
  salePrice: number;
  quantity: number;
  saleDate: string; // YYYY-MM-DD
  profit: number; // (salePrice - buyPrice) * quantity
}

function loadSalesHistory(): SaleRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((r): r is SaleRecord => r != null && typeof r === "object");
  } catch {
    return [];
  }
}

function saveSalesHistory(records: SaleRecord[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch {
    // ignore
  }
}

/** Enregistre une vente et persiste en localStorage. */
export function addSaleRecord(record: Omit<SaleRecord, "id">): void {
  const full: SaleRecord = {
    ...record,
    id: `sale-${record.productId}-${Date.now()}`,
  };
  const history = loadSalesHistory();
  history.push(full);
  saveSalesHistory(history);
}

/** Retourne l'historique des ventes. */
export function getSalesHistory(): SaleRecord[] {
  return loadSalesHistory();
}

/** Calcule le gain total réalisé (somme des profits). */
export function getTotalRealizedGain(): number {
  return loadSalesHistory().reduce((sum, r) => sum + (r.profit ?? 0), 0);
}

/** Met à jour une vente existante. */
export function updateSaleRecord(
  id: string,
  updates: { buyPrice?: number; salePrice?: number; saleDate?: string }
): boolean {
  const history = loadSalesHistory();
  const idx = history.findIndex((r) => r.id === id);
  if (idx < 0) return false;
  const current = history[idx];
  const buyPrice = updates.buyPrice ?? current.buyPrice;
  const salePrice = updates.salePrice ?? current.salePrice;
  const saleDate = updates.saleDate ?? current.saleDate;
  const profit = (salePrice - buyPrice) * current.quantity;
  history[idx] = { ...current, buyPrice, salePrice, saleDate, profit };
  saveSalesHistory(history);
  return true;
}

/** Supprime une vente de l'historique. */
export function deleteSaleRecord(id: string): boolean {
  const history = loadSalesHistory();
  const filtered = history.filter((r) => r.id !== id);
  if (filtered.length === history.length) return false;
  saveSalesHistory(filtered);
  return true;
}
