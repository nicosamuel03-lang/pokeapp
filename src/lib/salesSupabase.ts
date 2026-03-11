/**
 * Persistance des ventes dans Supabase (par user_id Clerk).
 * Utilisé quand l'utilisateur est connecté pour que le nombre de ventes persiste entre sessions.
 */

import { supabase } from "./supabase";
import type { SaleRecord } from "../utils/salesHistoryStorage";

const TABLE = "sales";

export type SaleRow = {
  id: string;
  user_id: string;
  product_id: string;
  product_name: string;
  image: string | null;
  buy_price: number;
  sale_price: number;
  quantity: number;
  sale_date: string;
  profit: number;
  created_at?: string;
};

function rowToRecord(r: SaleRow): SaleRecord {
  return {
    id: r.id,
    productId: r.product_id,
    productName: r.product_name,
    image: r.image ?? undefined,
    buyPrice: Number(r.buy_price),
    salePrice: Number(r.sale_price),
    quantity: Number(r.quantity),
    saleDate: r.sale_date,
    profit: Number(r.profit),
  };
}

export async function fetchSalesByUserId(userId: string): Promise<SaleRecord[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("user_id", userId)
    .order("sale_date", { ascending: false });
  if (error) {
    console.warn("[salesSupabase] fetchSalesByUserId error", error);
    return [];
  }
  return (data ?? []).map((r) => rowToRecord(r as SaleRow));
}

export async function sumSoldQuantityByUserId(userId: string): Promise<number> {
  const { data, error } = await supabase
    .from(TABLE)
    .select("quantity")
    .eq("user_id", userId);
  if (error) {
    console.warn("[salesSupabase] sumSoldQuantityByUserId error", error);
    return 0;
  }
  const rows = (data as Pick<SaleRow, "quantity">[]) ?? [];
  return rows.reduce((sum, row) => sum + Number(row.quantity ?? 0), 0);
}

/** Row shape must match Supabase table 'sales' (snake_case columns). */
export async function insertSale(
  userId: string,
  record: Omit<SaleRecord, "id">
): Promise<SaleRecord | null> {
  const row = {
    user_id: String(userId),
    product_id: String(record.productId ?? ""),
    product_name: String(record.productName ?? ""),
    image: record.image != null ? String(record.image) : null,
    buy_price: Number(record.buyPrice),
    sale_price: Number(record.salePrice),
    quantity: Math.floor(Number(record.quantity)) || 1,
    sale_date: String(record.saleDate ?? ""),
    profit: Number(record.profit),
  };
  const { data, error } = await supabase.from(TABLE).insert(row).select("id").single();
  if (error) {
    console.error("SUPABASE_ERROR:", error);
    throw error;
  }
  return { ...record, id: (data as { id: string }).id };
}

export async function updateSaleInSupabase(
  userId: string,
  id: string,
  updates: { buyPrice?: number; salePrice?: number; saleDate?: string }
): Promise<boolean> {
  const { data: existing } = await supabase
    .from(TABLE)
    .select("buy_price, sale_price, sale_date, quantity")
    .eq("user_id", userId)
    .eq("id", id)
    .single();
  if (!existing) return false;
  const row = existing as SaleRow;
  const buyPrice = updates.buyPrice ?? Number(row.buy_price);
  const salePrice = updates.salePrice ?? Number(row.sale_price);
  const saleDate = updates.saleDate ?? row.sale_date;
  const profit = (salePrice - buyPrice) * Number(row.quantity);
  const { error } = await supabase
    .from(TABLE)
    .update({ buy_price: buyPrice, sale_price: salePrice, sale_date: saleDate, profit })
    .eq("user_id", userId)
    .eq("id", id);
  if (error) {
    console.warn("[salesSupabase] updateSale error", error);
    return false;
  }
  return true;
}

export async function deleteSaleInSupabase(userId: string, id: string): Promise<boolean> {
  const { error } = await supabase.from(TABLE).delete().eq("user_id", userId).eq("id", id);
  if (error) {
    console.warn("[salesSupabase] deleteSale error", error);
    return false;
  }
  return true;
}
