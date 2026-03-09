import React, { createContext, useContext, useMemo, useState } from "react";
import { etbData } from "../data/etbData";
import type { HistoriquePrixPoint } from "../data/etbData";
import { displayData } from "../data/displayData";

function generateProductId(): string {
  const c = (globalThis as unknown as { crypto?: Crypto }).crypto;
  const randomUUID = c?.randomUUID?.bind(c);
  if (typeof randomUUID === "function") return randomUUID();
  return `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export type Category =
  | "Blisters"
  | "Displays"
  | "ETB"
  | "UPC"
  | "Coffrets"
  | "Gradées"
  | string;

export type HistoriquePoint = {
  mois: string;
  prix: number;
};

export interface Product {
  id: string;
  name: string;
  emoji: string;
  category: Category;
  set: string;
  condition: string;
  currentPrice: number;
  change30dPercent: number;
  badge: string;
  createdAt: number;
  dateSortie?: string;
  imageUrl?: string | null;
  quantite?: number;
  prixAchat?: number;
  prixMarcheActuel?: number;
  prixVente?: number | null;
  historique?: HistoriquePoint[];
  /** Données 12 mois 2026 pour la page détail (ETB) */
  historique_prix?: HistoriquePrixPoint[];
  /** Id ETB dans etbData (pour produits ajoutés depuis le catalogue) */
  etbId?: string;
}

interface ProductsContextValue {
  products: Product[];
  addProduct: (product: Omit<Product, "id" | "createdAt">) => Product;
}

const ProductsContext = createContext<ProductsContextValue | undefined>(
  undefined
);

const mapInitialProducts = (): Product[] => {
  const now = Date.now();

  const etbProducts: Product[] = etbData.map((item, index) => {
    const pvcSortie = item.pvcSortie || 0;
    const prixActuel = item.prixActuel ?? pvcSortie;
    const perfPct =
      pvcSortie > 0 ? ((prixActuel - pvcSortie) / pvcSortie) * 100 : 0;
    const historique: HistoriquePoint[] = (item.historique_prix || [])
      .filter((p): p is HistoriquePrixPoint & { prix: number } => p.prix != null && !Number.isNaN(p.prix))
      .map((p) => ({ mois: p.mois, prix: p.prix }));

    // Image ETB : priorité aux PNG locaux définis dans etbData (public/images/etb),
    // puis éventuellement image de displayData en fallback si présente.
    const fallbackDisplayImageUrl =
      displayData.find((d) => d.id === item.id)?.imageUrl ?? null;
    const imageUrl = item.imageUrl ?? fallbackDisplayImageUrl ?? null;

    return {
      id: item.id,
      name: `ETB ${item.nom}`,
      emoji: "🎴",
      category: "ETB",
      set: item.bloc === "eb" ? "Épée & Bouclier" : item.bloc === "ev" ? "Écarlate & Violet" : "Méga Évolution",
      condition: item.statut,
      currentPrice: prixActuel,
      change30dPercent: perfPct,
      badge: item.statut,
      createdAt: now - etbData.length * 86400000 + index * 86400000,
      dateSortie: item.dateSortie,
      imageUrl: imageUrl ?? undefined,
      quantite: 1,
      prixAchat: pvcSortie,
      prixMarcheActuel: prixActuel,
      prixVente: null,
      historique,
      historique_prix: item.historique_prix,
      etbId: item.id,
    };
  });

  const displayProducts: Product[] = displayData
    .filter((d) => d.category === "Displays")
    .map((d, index) => {
      const pvcSortie = d.msrp || 0;
      const prixActuel = d.currentMarketPrice || pvcSortie;
      const perfPct = pvcSortie > 0 ? ((prixActuel - pvcSortie) / pvcSortie) * 100 : 0;
      const historique: HistoriquePoint[] = (d.historique_prix || [])
        .filter((p) => p.prix != null && !Number.isNaN(p.prix as number))
        .map((p) => ({ mois: p.mois, prix: (p.prix as number) }));

      return {
        id: `display-${d.id}`,
        name: d.name,
        emoji: "📦",
        category: "Displays",
        set: d.block,
        condition: "Neuf scellé",
        currentPrice: prixActuel,
        change30dPercent: perfPct,
        badge: d.block,
        createdAt: now + index,
        dateSortie: d.releaseDate,
        imageUrl: d.imageUrl ?? undefined,
        quantite: 1,
        prixAchat: pvcSortie,
        prixMarcheActuel: prixActuel,
        prixVente: null,
        historique,
        historique_prix: d.historique_prix as unknown as HistoriquePrixPoint[],
      };
    });

  const upcProducts: Product[] = displayData
    .filter((d) => d.category === "UPC")
    .map((d, index) => {
      const pvcSortie = d.msrp || 0;
      const prixActuel = d.currentMarketPrice || pvcSortie;
      const perfPct = pvcSortie > 0 ? ((prixActuel - pvcSortie) / pvcSortie) * 100 : 0;
      const historique: HistoriquePoint[] = (d.historique_prix || [])
        .filter((p) => p.prix != null && !Number.isNaN(p.prix as number))
        .map((p) => ({ mois: p.mois, prix: (p.prix as number) }));

      return {
        id: `upc-${d.id}`,
        name: d.name,
        emoji: "🎁",
        category: "UPC",
        set: d.block,
        condition: "Neuf scellé",
        currentPrice: prixActuel,
        change30dPercent: perfPct,
        badge: d.block,
        createdAt: now + 100000 + index,
        dateSortie: d.releaseDate,
        imageUrl: d.imageUrl ?? undefined,
        quantite: 1,
        prixAchat: pvcSortie,
        prixMarcheActuel: prixActuel,
        prixVente: null,
        historique,
        historique_prix: d.historique_prix as unknown as HistoriquePrixPoint[],
      };
    });

  return [...etbProducts, ...displayProducts, ...upcProducts];
};

export const ProductsProvider: React.FC<{ children: React.ReactNode }> = ({
  children
}) => {
  const [products, setProducts] = useState<Product[]>(() => mapInitialProducts());

  const value = useMemo(
    () => ({
      products,
      addProduct: (productInput: Omit<Product, "id" | "createdAt">) => {
        const now = Date.now();
        const basePrice = productInput.currentPrice;
        const quantite = productInput.quantite ?? 1;
        const prixAchat = productInput.prixAchat ?? basePrice;
        const prixMarcheActuel = productInput.prixMarcheActuel ?? basePrice;

        const defaultHistorique: HistoriquePoint[] = Array.from(
          { length: 12 },
          (_, i) => ({
            mois: `2025-${String(i + 1).padStart(2, "0")}`,
            prix: prixAchat
          })
        );

        const newProduct: Product = {
          ...productInput,
          id: generateProductId(),
          createdAt: now,
          quantite,
          prixAchat,
          prixMarcheActuel,
          historique: productInput.historique ?? defaultHistorique,
          etbId: productInput.etbId
        };
        setProducts((prev) => [...prev, newProduct]);
        return newProduct;
      }
    }),
    [products]
  );

  return (
    <ProductsContext.Provider value={value}>
      {children}
    </ProductsContext.Provider>
  );
};

export const useProducts = (): ProductsContextValue => {
  const ctx = useContext(ProductsContext);
  if (!ctx) {
    throw new Error("useProducts doit être utilisé dans un ProductsProvider");
  }
  return ctx;
};

