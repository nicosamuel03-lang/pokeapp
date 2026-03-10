import { useCallback, useEffect, useState } from "react";
import { useUser } from "@clerk/react";
import {
  getSalesHistory,
  addSaleRecord as addSaleLocal,
  updateSaleRecord as updateSaleLocal,
  deleteSaleRecord as deleteSaleLocal,
  type SaleRecord,
} from "../utils/salesHistoryStorage";
import {
  fetchSalesByUserId,
  insertSale,
  updateSaleInSupabase,
  deleteSaleInSupabase,
} from "../lib/salesSupabase";

const FREE_SALE_LIMIT = 10;

export function useSalesHistory(): {
  sales: SaleRecord[];
  saleCount: number;
  loading: boolean;
  addSaleRecord: (record: Omit<SaleRecord, "id">) => Promise<void>;
  updateSaleRecord: (id: string, updates: { buyPrice?: number; salePrice?: number; saleDate?: string }) => Promise<boolean>;
  deleteSaleRecord: (id: string) => Promise<boolean>;
  refreshSales: () => void;
  isAtFreeLimit: boolean;
} {
  const { user } = useUser();
  const userId = user?.id ?? null;
  const [sales, setSales] = useState<SaleRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const refreshSales = useCallback(() => {
    if (userId) {
      setLoading(true);
      fetchSalesByUserId(userId)
        .then(setSales)
        .finally(() => setLoading(false));
    } else {
      setSales(getSalesHistory());
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (userId) {
      setLoading(true);
      fetchSalesByUserId(userId)
        .then(setSales)
        .finally(() => setLoading(false));
    } else {
      setSales(getSalesHistory());
      setLoading(false);
    }
  }, [userId]);

  const addSaleRecord = useCallback(
    async (record: Omit<SaleRecord, "id">) => {
      if (userId) {
        const created = await insertSale(userId, record);
        if (created) refreshSales();
      } else {
        addSaleLocal(record);
        setSales(getSalesHistory());
      }
    },
    [userId, refreshSales]
  );

  const updateSaleRecord = useCallback(
    async (
      id: string,
      updates: { buyPrice?: number; salePrice?: number; saleDate?: string }
    ): Promise<boolean> => {
      if (userId) {
        const ok = await updateSaleInSupabase(userId, id, updates);
        if (ok) refreshSales();
        return ok;
      }
      const ok = updateSaleLocal(id, updates);
      if (ok) setSales(getSalesHistory());
      return ok;
    },
    [userId, refreshSales]
  );

  const deleteSaleRecord = useCallback(
    async (id: string): Promise<boolean> => {
      if (userId) {
        const ok = await deleteSaleInSupabase(userId, id);
        if (ok) refreshSales();
        return ok;
      }
      const ok = deleteSaleLocal(id);
      if (ok) setSales(getSalesHistory());
      return ok;
    },
    [userId, refreshSales]
  );

  const saleCount = sales.length;
  const isAtFreeLimit = saleCount >= FREE_SALE_LIMIT;

  return {
    sales,
    saleCount,
    loading,
    addSaleRecord,
    updateSaleRecord,
    deleteSaleRecord,
    refreshSales,
    isAtFreeLimit,
  };
}
