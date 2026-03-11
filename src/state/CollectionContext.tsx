import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { Product } from "./ProductsContext";

export interface CollectionItem {
  id: string;
  product: Product;
  buyPrice: number;
  quantity: number;
  /** Month when item was added (YYYY-MM), for investment curve over time */
  addedAt?: string;
  /** Date d'achat (YYYY-MM-DD) */
  purchaseDate?: string;
}

interface CollectionContextValue {
  items: CollectionItem[];
  addToCollection: (
    product: Product,
    buyPrice?: number,
    quantity?: number,
    purchaseDate?: string
  ) => void;
  removeFromCollection: (itemId: string, mode: "one" | "all") => void;
  /** Met à jour le prix d'achat, la date d'achat et/ou la quantité pour une ligne de collection. */
  updateCollectionItem: (
    itemId: string,
    updates: { buyPrice?: number; purchaseDate?: string; quantity?: number }
  ) => void;
}

const CollectionContext = createContext<CollectionContextValue | undefined>(
  undefined
);

const STORAGE_KEY = "pokevault_collection_v1";

function loadCollectionFromStorage(): CollectionItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(Boolean) as CollectionItem[];
  } catch {
    return [];
  }
}

export const CollectionProvider: React.FC<{ children: React.ReactNode }> = ({
  children
}) => {
  const [items, setItems] = useState<CollectionItem[]>(() => loadCollectionFromStorage());

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      // ignore
    }
  }, [items]);

  const value = useMemo<CollectionContextValue>(
    () => ({
      items,
      addToCollection: (
        product: Product,
        buyPrice: number = product.currentPrice,
        quantity: number = 1,
        purchaseDate?: string
      ) => {
        const now = new Date();
        const addedAt = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
        console.log("Adding to collection - product.id:", product.id, "product.imageUrl:", (product as any).imageUrl ?? (product as any).image);
        setItems((prev) => [
          ...prev,
          {
            id: `${product.id}-${Date.now()}`,
            product,
            buyPrice,
            quantity,
            addedAt,
            purchaseDate: purchaseDate || undefined
          }
        ]);
      },
      removeFromCollection: (itemId: string, mode: "one" | "all") => {
        setItems((prev) =>
          prev
            .map((item) => {
              if (item.id !== itemId) return item;
              if (mode === "all") return null;
              if (item.quantity > 1) {
                return { ...item, quantity: item.quantity - 1 };
              }
              return null;
            })
            .filter((it): it is CollectionItem => it !== null)
        );
      },
      updateCollectionItem: (
        itemId: string,
        updates: { buyPrice?: number; purchaseDate?: string; quantity?: number }
      ) => {
        setItems((prev) =>
          prev.map((item) => {
            if (item.id !== itemId) return item;
            const next: CollectionItem = { ...item };
            if (updates.buyPrice != null) next.buyPrice = updates.buyPrice;
            if (updates.purchaseDate !== undefined)
              next.purchaseDate = updates.purchaseDate || undefined;
            if (updates.quantity != null && updates.quantity >= 1)
              next.quantity = updates.quantity;
            return next;
          })
        );
      },
    }),
    [items]
  );

  return (
    <CollectionContext.Provider value={value}>
      {children}
    </CollectionContext.Provider>
  );
};

export const useCollection = (): CollectionContextValue => {
  const ctx = useContext(CollectionContext);
  if (!ctx) {
    throw new Error(
      "useCollection doit être utilisé dans un CollectionProvider"
    );
  }
  return ctx;
};

