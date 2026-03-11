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

// Local storage backing has been removed. These helpers are no-ops
// kept only for type compatibility while all sales move to Supabase.

export function addSaleRecord(_record: Omit<SaleRecord, "id">): void {
  // no-op
}

export function getSalesHistory(): SaleRecord[] {
  return [];
}

export function getTotalRealizedGain(): number {
  return 0;
}

export function updateSaleRecord(
  _id: string,
  _updates: { buyPrice?: number; salePrice?: number; saleDate?: string }
): boolean {
  return false;
}

export function deleteSaleRecord(_id: string): boolean {
  return false;
}
