import { useCallback, useEffect, useState } from "react";
import { useUser } from "@clerk/react";
import {
  type SaleRecord,
  getSalesHistory as getLocalSalesHistory,
  addSaleRecord as addLocalSaleRecord,
  updateSaleRecord as updateLocalSaleRecord,
  deleteSaleRecord as deleteLocalSaleRecord,
} from "../utils/salesHistoryStorage";
import {
  fetchSalesByUserId,
  insertSale,
  updateSaleInSupabase,
  deleteSaleInSupabase,
} from "../lib/salesSupabase";

export function useSalesHistory(): {
  sales: SaleRecord[];
  loading: boolean;
  addSaleRecord: (record: Omit<SaleRecord, "id">) => Promise<void>;
  updateSaleRecord: (id: string, updates: { buyPrice?: number; salePrice?: number; saleDate?: string }) => Promise<boolean>;
  deleteSaleRecord: (id: string) => Promise<boolean>;
  refreshSales: () => void;
} {
  const { user } = useUser();
  const userId = user?.id ?? null;
  const [sales, setSales] = useState<SaleRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const refreshSales = useCallback(() => {
    if (!userId) {
      setSales(getLocalSalesHistory());
      setLoading(false);
      return;
    }
    setLoading(true);
    fetchSalesByUserId(userId)
      .then(setSales)
      .finally(() => setLoading(false));
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setSales(getLocalSalesHistory());
      setLoading(false);
      return;
    }
    setLoading(true);
    fetchSalesByUserId(userId)
      .then(setSales)
      .finally(() => setLoading(false));
  }, [userId]);

  const addSaleRecord = useCallback(
    async (record: Omit<SaleRecord, "id">) => {
      if (!userId) {
        addLocalSaleRecord(record);
        refreshSales();
        return;
      }
      await insertSale(userId, record);
      refreshSales();
    },
    [userId, refreshSales]
  );

  const updateSaleRecord = useCallback(
    async (
      id: string,
      updates: { buyPrice?: number; salePrice?: number; saleDate?: string }
    ): Promise<boolean> => {
      if (!userId) {
        const ok = updateLocalSaleRecord(id, updates);
        if (ok) refreshSales();
        return ok;
      }
      const ok = await updateSaleInSupabase(userId, id, updates);
      if (ok) refreshSales();
      return ok;
    },
    [userId, refreshSales]
  );

  const deleteSaleRecord = useCallback(
    async (id: string): Promise<boolean> => {
      if (!userId) {
        const ok = deleteLocalSaleRecord(id);
        if (ok) refreshSales();
        return ok;
      }
      const ok = await deleteSaleInSupabase(userId, id);
      if (ok) refreshSales();
      return ok;
    },
    [userId, refreshSales]
  );

  return {
    sales,
    loading,
    addSaleRecord,
    updateSaleRecord,
    deleteSaleRecord,
    refreshSales,
  };
}
