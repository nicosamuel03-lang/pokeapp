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

const STORAGE_KEY = "pokevault_guest_sales_v1";
/** Nombre de ventes enregistrées « à vie » (invité) : +1 par vente, jamais diminué à la suppression (aligné sur users.total_sales_count). */
const GUEST_SALES_TX_COUNT_KEY = "pokevault_guest_sale_transactions_v1";

function readGuestTxCountRaw(): number | null {
  if (typeof window === "undefined") return null;
  try {
    const v = localStorage.getItem(GUEST_SALES_TX_COUNT_KEY);
    if (v == null) return null;
    const n = parseInt(v, 10);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  } catch {
    return null;
  }
}

function writeGuestTxCount(n: number): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(GUEST_SALES_TX_COUNT_KEY, String(Math.max(0, Math.floor(n))));
  } catch {
    /* ignore */
  }
}

function loadRaw(): SaleRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed as SaleRecord[];
  } catch {
    return [];
  }
}

function saveRaw(records: SaleRecord[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch {
    /* ignore quota / private mode */
  }
}

function newId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `sale_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

/** Ventes stockées localement (utilisateur non connecté). */
export function getSalesHistory(): SaleRecord[] {
  return loadRaw();
}

/** Somme des quantités des lignes encore présentes (historique actuel). */
export function getTotalGuestSoldQuantity(): number {
  return getSalesHistory().reduce((sum, r) => sum + (Math.floor(Number(r.quantity)) || 0), 0);
}

/**
 * Nombre de ventes comptées pour le quota free invité : monotone (ne baisse pas si une ligne est supprimée).
 * Si la clé n’existe pas, initialisation sur le nombre de lignes d’historique actuelles.
 */
export function getGuestSalesTransactionCount(): number {
  const stored = readGuestTxCountRaw();
  if (stored !== null) return stored;
  const fromRows = loadRaw().length;
  writeGuestTxCount(fromRows);
  return fromRows;
}

/** @deprecated Utiliser getGuestSalesTransactionCount */
export function getGuestLifetimeSalesQuantity(): number {
  return getGuestSalesTransactionCount();
}

export function getTotalRealizedGain(): number {
  return getSalesHistory().reduce((sum, r) => sum + (Number(r.profit) || 0), 0);
}

export function addSaleRecord(record: Omit<SaleRecord, "id">): SaleRecord {
  const id = newId();
  const row: SaleRecord = { ...record, id };
  const next = [...loadRaw(), row];
  saveRaw(next);
  const rawTx = readGuestTxCountRaw();
  const afterLen = loadRaw().length;
  writeGuestTxCount(rawTx !== null ? rawTx + 1 : afterLen);
  return row;
}

export function updateSaleRecord(
  id: string,
  updates: { buyPrice?: number; salePrice?: number; saleDate?: string }
): boolean {
  const list = loadRaw();
  const idx = list.findIndex((r) => r.id === id);
  if (idx < 0) return false;
  const r = list[idx];
  const buyPrice = updates.buyPrice ?? r.buyPrice;
  const salePrice = updates.salePrice ?? r.salePrice;
  const saleDate = updates.saleDate ?? r.saleDate;
  const qty = Math.floor(Number(r.quantity)) || 1;
  const profit = (salePrice - buyPrice) * qty;
  list[idx] = { ...r, buyPrice, salePrice, saleDate, profit };
  saveRaw(list);
  return true;
}

export function deleteSaleRecord(id: string): boolean {
  const list = loadRaw();
  const next = list.filter((r) => r.id !== id);
  if (next.length === list.length) return false;
  saveRaw(next);
  return true;
}
