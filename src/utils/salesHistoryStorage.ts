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
/** Unités vendues « à vie » en mode invité : n’est jamais diminué quand une vente est supprimée (anti-abus). */
const LIFETIME_SALES_QTY_KEY = "pokevault_guest_lifetime_sales_qty_v1";

function readLifetimeQtyRaw(): number | null {
  if (typeof window === "undefined") return null;
  try {
    const v = localStorage.getItem(LIFETIME_SALES_QTY_KEY);
    if (v == null) return null;
    const n = parseInt(v, 10);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  } catch {
    return null;
  }
}

function writeLifetimeQty(n: number): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LIFETIME_SALES_QTY_KEY, String(Math.max(0, Math.floor(n))));
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
 * Unités vendues comptées pour le quota free invité : monotone (ne baisse pas si l’utilisateur supprime une vente).
 * À la première utilisation, initialisation depuis l’historique actuel si la clé n’existait pas.
 */
export function getGuestLifetimeSalesQuantity(): number {
  const stored = readLifetimeQtyRaw();
  if (stored !== null) return stored;
  const fromRows = getTotalGuestSoldQuantity();
  writeLifetimeQty(fromRows);
  return fromRows;
}

export function getTotalRealizedGain(): number {
  return getSalesHistory().reduce((sum, r) => sum + (Number(r.profit) || 0), 0);
}

export function addSaleRecord(record: Omit<SaleRecord, "id">): SaleRecord {
  const id = newId();
  const row: SaleRecord = { ...record, id };
  const qty = Math.max(1, Math.floor(Number(record.quantity)) || 1);
  const prevStored = readLifetimeQtyRaw();
  const base =
    prevStored !== null ? prevStored : getTotalGuestSoldQuantity();
  const next = [...loadRaw(), row];
  saveRaw(next);
  writeLifetimeQty(base + qty);
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
