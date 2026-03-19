import { Component, useEffect, useMemo, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  ReferenceLine,
} from "recharts";
import { useProducts, type Product } from "../state/ProductsContext";
import { useCollection } from "../state/CollectionContext";
import { setSalePrice } from "../utils/salesStorage";
import { getPrixMarcheForProduct } from "../utils/prixMarche";
import { useSalesHistory } from "../hooks/useSalesHistory";
import { etbData } from "../data/etbData";
import { ItemIcon } from "../components/ItemIcon";
import { ChevronLeft } from "lucide-react";
import { useUser } from "@clerk/react";
import { useSubscription } from "../state/SubscriptionContext";
import { useTheme } from "../state/ThemeContext";
import { supabase } from "../lib/supabase";
import { incrementUserTotalSalesCount } from "../lib/salesSupabase";
import { getGuestLifetimeSalesQuantity } from "../utils/salesHistoryStorage";
/** Mock price history (60€ Jan → 75€) when product has no history. */
const MOCK_CHART_DATA = [
  { mois_court: "Jan", mois_label: "Janvier", prix: 55 },
  { mois_court: "Fév", mois_label: "Février", prix: 72 },
  { mois_court: "Mar", mois_label: "Mars", prix: 61 },
  { mois_court: "Avr", mois_label: "Avril", prix: 85 },
  { mois_court: "Mai", mois_label: "Mai", prix: 68 },
  { mois_court: "Juin", mois_label: "Juin", prix: 90 },
  { mois_court: "Juil", mois_label: "Juillet", prix: 74 },
  { mois_court: "Août", mois_label: "Août", prix: 95 },
  { mois_court: "Sept", mois_label: "Septembre", prix: 80 },
  { mois_court: "Oct", mois_label: "Octobre", prix: 110 },
  { mois_court: "Nov", mois_label: "Novembre", prix: 88 },
  { mois_court: "Déc", mois_label: "Décembre", prix: 120 },
];

const FREE_SALE_LIMIT = 10;

/** Message détaillé pour l’UI et le debug (erreurs PostgREST / Supabase). */
function formatSupabaseInsertError(error: unknown): string {
  if (error == null) return "Erreur inconnue (réponse vide).";
  if (typeof error === "object" && error !== null) {
    const e = error as {
      message?: string;
      code?: string;
      details?: string;
      hint?: string;
    };
    const parts: string[] = [];
    if (e.message) parts.push(e.message);
    if (e.code) parts.push(`code: ${e.code}`);
    if (e.details) parts.push(`détails: ${e.details}`);
    if (e.hint) parts.push(`indice: ${e.hint}`);
    if (parts.length > 0) return parts.join(" · ");
  }
  return String(error);
}

/** Error Boundary: affiche "Produit non trouvé" et log l'erreur pour éviter l'écran noir. */
class ProductDetailErrorBoundary extends Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  state = { hasError: false, error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("[ProductDetailPage]", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          className="rounded-2xl p-4 text-sm"
          style={{ background: "var(--card-color)", color: "var(--text-secondary)", boxShadow: "0 2px 12px rgba(0,0,0,0.12)" }}
        >
          <p className="font-medium">Produit non trouvé</p>
          <p className="mt-2 text-xs opacity-80">
            Une erreur s&apos;est produite. Vérifiez la console (F12) pour plus de détails.
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}

const ProductDetailPageInner = () => {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { products } = useProducts();
  const { items: collectionItems, removeFromCollection, updateCollectionItem } = useCollection();
  const { user } = useUser();
  const { authState, isPremium, isLoading: premiumLoading } = useSubscription();
  console.log("[RENDER] ProductDetailPage", "isPremium:", isPremium, "isLoading:", premiumLoading, new Date().toISOString());
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const isLight = theme === "light";
  const accentGold = isDark ? "#FBBF24" : "#D4A757";
  const { addSaleRecord, refreshSales } = useSalesHistory();
  const [isSelling, setIsSelling] = useState(false);
  const [saleError, setSaleError] = useState<string | null>(null);
  const [saleLimitMessage, setSaleLimitMessage] = useState<string | null>(null);

  const sid = decodeURIComponent((id ?? "").trim());
  const sidLower = sid.toLowerCase();

  const collectionIdFromUrl = useMemo(
    () => new URLSearchParams(location.search).get("collectionId"),
    [location.search]
  );

  /** Ligne collection ciblée par l’URL (permet d’afficher le bon ETB si le segment :id est ambigu / ancien). */
  const collectionLineForDetail = useMemo(() => {
    if (!collectionIdFromUrl) return null;
    return collectionItems.find((c) => c.id === collectionIdFromUrl) ?? null;
  }, [collectionIdFromUrl, collectionItems]);

  const product = useMemo((): Product | null => {
    const list = Array.isArray(products) ? products : [];

    if (collectionLineForDetail?.product) {
      const lineProduct = collectionLineForDetail.product;
      const hit = list.find((p) => p.id === lineProduct.id);
      if (hit) return hit;
      return { ...lineProduct } as Product;
    }

    const fromContext = list.find(
      (p) =>
        (p?.id?.toLowerCase() === sidLower) ||
        (p?.etbId?.toLowerCase() === sidLower)
    );
    if (fromContext) return fromContext;

    if (!sid) return null;
    const etbIdParam = sidLower.replace(/^etb-/, "").replace(/^display-/, "");
    const etbRow = etbData.find((e) => e?.id?.toLowerCase() === etbIdParam);
    if (etbRow) {
      const pvc = etbRow.pvcSortie || 0;
      const prixActuel = etbRow.prixActuel ?? pvc;
      const change30dPercent = pvc > 0 ? ((prixActuel - pvc) / pvc) * 100 : 0;
      return {
        id: etbRow.id,
        name: `ETB ${etbRow.nom}`,
        emoji: "🎴",
        category: "ETB" as const,
        set: etbRow.bloc === "eb" ? "Épée & Bouclier" : etbRow.bloc === "ev" ? "Écarlate & Violet" : "Méga Évolution",
        condition: etbRow.statut,
        currentPrice: prixActuel,
        change30dPercent,
        badge: etbRow.statut,
        createdAt: Date.now(),
        quantite: 1,
        prixAchat:
          collectionItems.find(
            (it) => it.product.etbId === etbRow.id || it.product.id === etbRow.id
          )?.buyPrice ?? pvc,
        prixMarcheActuel: prixActuel,
        prixVente: null as number | null,
        historique_prix: etbRow.historique_prix,
        etbId: etbRow.id,
        imageUrl: etbRow.imageUrl ?? undefined,
        dateSortie: etbRow.dateSortie,
      };
    }
    return null;
  }, [products, sidLower, sid, collectionItems, collectionLineForDetail]);

  /** Ligne etbData alignée sur le produit résolu (pas seulement le segment d’URL). */
  const etb = useMemo(() => {
    if (product?.category === "ETB" && product?.etbId) {
      const row = etbData.find((e) => e.id === product.etbId);
      if (row) return row;
    }
    if (!sid) return undefined;
    const etbIdParam = sidLower.replace(/^etb-/, "").replace(/^display-/, "");
    return etbData.find((e) => e?.id?.toLowerCase() === etbIdParam);
  }, [product?.category, product?.etbId, sid, sidLower]);


  const [saleInput, setSaleInput] = useState<string>("");
  /** Quantité à vendre pour cette ligne (1 … quantité possédée). */
  const [saleQuantityToSell, setSaleQuantityToSell] = useState(1);
  const [chartPeriod, setChartPeriod] = useState<"1an" | "2ans">("1an");
  const [addBtnPressed, setAddBtnPressed] = useState(false);
  const triggerAddPress = () => {
    setAddBtnPressed(true);
    setTimeout(() => setAddBtnPressed(false), 150);
  };

  const history2024 = useMemo(() => {
    const raw = etb?.historique_prix_2024;
    return Array.isArray(raw) ? raw : [];
  }, [etb]);

  const history2025 = useMemo(() => {
    const raw = etb?.historique_prix_2025;
    return Array.isArray(raw) ? raw : [];
  }, [etb]);

  const history2026 = useMemo(() => {
    if (!product) return [];
    const raw =
      product?.category === "Displays"
        ? product?.historique_prix
        : etb?.historique_prix ?? product?.historique_prix;
    return Array.isArray(raw) ? raw : [];
  }, [product, etb]);

  useEffect(() => {
    setSaleInput("");
    setSaleQuantityToSell(1);
  }, [id]);

  /** Parse dateSortie to month key (YYYY-MM) for filtering. Supports DD/MM/YYYY (ETB) and YYYY-MM (Display). */
  const releaseMonthKey = useMemo(() => {
    const dateSortie = etb?.dateSortie ?? product?.dateSortie;
    if (!dateSortie || typeof dateSortie !== "string") return null;
    const s = dateSortie.trim();
    if (/^\d{4}-\d{2}/.test(s)) return s.slice(0, 7);
    const parts = s.split("/");
    if (parts.length !== 3) return null;
    const [, m, y] = parts;
    const month = String(m ?? "").padStart(2, "0");
    const year = String(y ?? "").trim();
    if (!month || !year) return null;
    return `${year}-${month}`;
  }, [etb?.dateSortie, product?.dateSortie]);

  const { chartData, priceListRows, xAxisInterval } = useMemo(() => {
    try {
      const safe2024 = Array.isArray(history2024) ? history2024 : [];
      const safe2025 = Array.isArray(history2025) ? history2025 : [];
      const safe2026 = Array.isArray(history2026) ? history2026 : [];

      /** For Display: map mois -> prix from product.historique_prix (unique per Display). */
      const displayPrixMap = product?.category === "Displays" && product?.historique_prix?.length
        ? (() => {
            const m = new Map<string, number | null>();
            for (const h of product.historique_prix) {
              if (h?.mois) m.set(h.mois, h.prix ?? null);
            }
            return m;
          })()
        : null;

      /** Keep only months >= release month. Returns full array if no release date. */
      const filterFromRelease = <T extends { mois?: string }>(
        items: T[],
        releaseMonth: string | null
      ): T[] => {
        if (!releaseMonth) return items;
        return items.filter((item) => item.mois && item.mois >= releaseMonth);
      };

      const labels1an = ["Fév 25", "Mar 25", "Avr 25", "Mai 25", "Juin 25", "Juil 25", "Août 25", "Sept 25", "Oct 25", "Nov 25", "Déc 25", "Jan 26", "Fév 26"];
      const mois1an = ["2025-02", "2025-03", "2025-04", "2025-05", "2025-06", "2025-07", "2025-08", "2025-09", "2025-10", "2025-11", "2025-12", "2026-01", "2026-02"];
      const labels2ans = [
        "Fév 24", "Mar 24", "Avr 24", "Mai 24", "Juin 24", "Juil 24", "Août 24", "Sept 24", "Oct 24", "Nov 24", "Déc 24",
        "Jan 25", "Fév 25", "Mar 25", "Avr 25", "Mai 25", "Juin 25", "Juil 25", "Août 25", "Sept 25", "Oct 25", "Nov 25", "Déc 25",
        "Jan 26", "Fév 26",
      ];
      const mois2ans = [
        "2024-02", "2024-03", "2024-04", "2024-05", "2024-06", "2024-07", "2024-08", "2024-09", "2024-10", "2024-11", "2024-12",
        "2025-01", "2025-02", "2025-03", "2025-04", "2025-05", "2025-06", "2025-07", "2025-08", "2025-09", "2025-10", "2025-11", "2025-12",
        "2026-01", "2026-02",
      ];

      const buildRow = (
        p: { mois?: string; mois_label?: string; prix?: number | null } | undefined,
        moisFallback: string,
        moisLabelFallback: string
      ) => {
        const mois = p?.mois || moisFallback;
        const prix =
          displayPrixMap?.has(mois)
            ? (displayPrixMap.get(mois) ?? null)
            : (p?.prix ?? null);
        return {
          mois,
          mois_label: p?.mois_label || moisLabelFallback,
          prix,
        };
      };

      /** Remove rows with no price data. */
      const filterEmptyRows = <T extends { prix?: number | null }>(items: T[]): T[] =>
        items.filter((item) => item.prix != null && !Number.isNaN(Number(item.prix)));

      if (chartPeriod === "1an") {
        const slice2025 = safe2025.slice(1, 12);
        const slice2026 = safe2026.slice(0, 2);
        const rows: { mois: string; mois_label: string; prix: number | null }[] = [];
        for (let i = 0; i < 11; i++) rows.push(buildRow(slice2025[i], mois1an[i] ?? "", labels1an[i] ?? ""));
        for (let i = 0; i < 2; i++) rows.push(buildRow(slice2026[i], mois1an[11 + i] ?? "", labels1an[11 + i] ?? ""));
        const data = rows.slice(0, 13).map((p, i) => ({
          ...p,
          mois_court: labels1an[i] ?? p.mois_label ?? "",
        }));
        const filteredData = filterFromRelease(data, releaseMonthKey);
        let filteredRows = filterFromRelease(rows, releaseMonthKey);
        filteredRows = filterEmptyRows(filteredRows);
        return { chartData: filteredData, priceListRows: filteredRows, xAxisInterval: 1 as const };
      }

      const slice2024 = safe2024.slice(1, 12);
      const slice2025Full = safe2025.slice(0, 12);
      const slice2026 = safe2026.slice(0, 2);
      const rows: { mois: string; mois_label: string; prix: number | null }[] = [];
      for (let i = 0; i < 11; i++) rows.push(buildRow(slice2024[i], mois2ans[i] ?? "", labels2ans[i] ?? ""));
      for (let i = 0; i < 12; i++) rows.push(buildRow(slice2025Full[i], mois2ans[11 + i] ?? "", labels2ans[11 + i] ?? ""));
      for (let i = 0; i < 2; i++) rows.push(buildRow(slice2026[i], mois2ans[23 + i] ?? "", labels2ans[23 + i] ?? ""));
      const data = rows.slice(0, 25).map((p, i) => ({
        ...p,
        mois_court: labels2ans[i] ?? p.mois_label ?? "",
      }));
      const filteredData = filterFromRelease(data, releaseMonthKey);
      let filteredRows = filterFromRelease(rows, releaseMonthKey);
      filteredRows = filterEmptyRows(filteredRows);
      return { chartData: filteredData, priceListRows: filteredRows, xAxisInterval: 2 as const };
    } catch (err) {
      console.error("[ProductDetailPage] chart data error", err);
      return {
        chartData: [],
        priceListRows: [],
        xAxisInterval: 1 as const,
      };
    }
  }, [chartPeriod, history2024, history2025, history2026, releaseMonthKey, product]);

  const collectionId = collectionIdFromUrl;

  const collectionMatch = useMemo(() => {
    if (!product) return null;
    if (collectionIdFromUrl && collectionLineForDetail?.id === collectionIdFromUrl) {
      return collectionLineForDetail;
    }
    const pid = product.etbId ?? product.id;
    const matching = collectionItems.filter(
      (it) =>
        it.product.id === product.id ||
        it.product.etbId === pid ||
        it.product.id === pid
    );
    if (matching.length === 0) return null;
    if (collectionIdFromUrl) {
      const exact = matching.find((it) => it.id === collectionIdFromUrl);
      if (exact) return exact;
    }
    return matching[0] ?? null;
  }, [product, collectionItems, collectionIdFromUrl, collectionLineForDetail]);

  useEffect(() => {
    if (!collectionMatch) return;
    const max = Math.max(1, collectionMatch.quantity);
    setSaleQuantityToSell((q) => Math.min(Math.max(1, q), max));
  }, [collectionMatch?.id, collectionMatch?.quantity]);

  if (!product) {
    return (
      <div
        className="rounded-2xl p-4 text-sm"
        style={{ background: "var(--card-color)", color: "var(--text-secondary)", boxShadow: "0 2px 12px rgba(0,0,0,0.12)" }}
      >
        Produit non trouvé
      </div>
    );
  }

  const prixAchat =
    collectionMatch?.buyPrice ?? product.prixAchat ?? product.currentPrice;
  const quantite = collectionMatch?.quantity ?? product.quantite ?? 1;
  /** Unités vendues sur cette opération (borné 1 … stock possédé). */
  const qtyToSell = useMemo(() => {
    const max = Math.max(1, quantite);
    const raw = Math.floor(Number(saleQuantityToSell));
    const q = !Number.isFinite(raw) || raw < 1 ? 1 : raw;
    return Math.min(q, max);
  }, [saleQuantityToSell, quantite]);
  const prixMarche = getPrixMarcheForProduct(product, etbData);
  const salePriceNumber = parseFloat(saleInput.replace(",", "."));
  const hasSale =
    saleInput.trim().length > 0 && !Number.isNaN(salePriceNumber);

  const totalBuyForSale = prixAchat * qtyToSell;
  const totalSaleForSale = salePriceNumber * qtyToSell;
  const brut = hasSale ? totalSaleForSale - totalBuyForSale : 0;
  const perfPct =
    hasSale && prixAchat > 0
      ? ((salePriceNumber - prixAchat) / prixAchat) * 100
      : 0;
  const isPositive = brut >= 0;

  const isInCollection = useMemo(() => !!collectionMatch, [collectionMatch]);

  const handleAddToCollection = () => {
    if (navigator.vibrate) navigator.vibrate(50);
    const itemId = product.etbId ?? product.id;
    navigate(`/ajouter?item=${encodeURIComponent(itemId)}`);
  };

  const handleVendre = async () => {
    if (!hasSale || !product || !collectionMatch) return;

    setSaleError(null);
    setSaleLimitMessage(null);

    const userId = user?.id ?? null;

    // Limite free tier (10 unités vendues) : uniquement si compte résolu comme « free » (pas pendant loading → évite de bloquer un futur premium).
    if (authState === "free") {
      let currentCount = 0;
      if (userId) {
        const { data: userRow, error } = await supabase
          .from("users")
          .select("total_sales_count")
          .eq("id", userId)
          .single();
        if (error) {
          console.error("SUPABASE_ERROR:", error);
        }
        currentCount = Number(
          (userRow as { total_sales_count?: number | null } | null)?.total_sales_count ?? 0
        );
      } else {
        currentCount = getGuestLifetimeSalesQuantity();
      }
      const newTotal = currentCount + qtyToSell;
      if (newTotal > FREE_SALE_LIMIT) {
        setSaleLimitMessage(
          `Limite gratuite : ${FREE_SALE_LIMIT} unités vendues max. Passez à Boss Access pour continuer à vendre.`
        );
        return;
      }
    }

    setIsSelling(true);
    try {
      if (navigator.vibrate) navigator.vibrate(50);

      const totalBuyCost = collectionMatch.buyPrice * qtyToSell;
      const profit = salePriceNumber * qtyToSell - totalBuyCost;
      const today = new Date();
      const saleDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

      let imageToSave: string | null = product.imageUrl ?? null;
      if (!imageToSave && (product.etbId || product.id)) {
        const etb =
          etbData.find((e) => e.id === (product.etbId ?? product.id)) ||
          etbData.find((e) => product.id.startsWith(e.id));
        imageToSave = etb?.imageUrl ?? null;
      }

      const row = {
        user_id: userId ?? "",
        product_id: String(product.id),
        product_name: String(product.name ?? ""),
        image: imageToSave != null ? String(imageToSave) : null,
        buy_price: Number(collectionMatch.buyPrice),
        sale_price: Number(salePriceNumber),
        quantity: Math.floor(Number(qtyToSell)) || 1,
        sale_date: saleDate,
        profit: Number(profit),
      };

      // Operation 1: INSERT into sales table (Supabase table: sales, columns: user_id, product_id, product_name, image, buy_price, sale_price, quantity, sale_date, profit)
      if (userId) {
        const { error: insertError } = await supabase.from("sales").insert([row]).select("id").single();
        if (insertError) {
          console.log(insertError);
          console.error("SUPABASE sales insert failed:", insertError);
          setSaleError(formatSupabaseInsertError(insertError));
          return;
        }
        // Compteur quota (users.total_sales_count) : toujours incrémenter après vente (free, premium, ou abonnement encore en « loading »).
        const countOk = await incrementUserTotalSalesCount(userId, qtyToSell);
        if (!countOk) {
          setSaleError(
            "Vente enregistrée, mais la mise à jour du compteur a échoué. Vérifiez les droits sur la table users (RLS) ou réessayez."
          );
        }
        refreshSales();
      } else {
        try {
          await addSaleRecord({
            productId: product.id,
            productName: product.name ?? "",
            image: imageToSave,
            buyPrice: collectionMatch.buyPrice,
            salePrice: salePriceNumber,
            quantity: qtyToSell,
            saleDate,
            profit,
          });
        } catch (err) {
          console.error("SUPABASE_ERROR:", err);
          setSaleError(
            "Impossible d'enregistrer la vente en local. Vérifiez l'espace de stockage du navigateur."
          );
          return;
        }
        refreshSales();
      }

      setSalePrice(product.id, salePriceNumber);

      // Operation 2: retirer uniquement la quantité vendue du stock collection
      if (qtyToSell >= collectionMatch.quantity) {
        removeFromCollection(collectionMatch.id, "all");
      } else {
        updateCollectionItem(collectionMatch.id, {
          quantity: collectionMatch.quantity - qtyToSell,
        });
      }

      refreshSales();
      navigate("/collection");
    } catch (err) {
      console.error("SUPABASE_ERROR:", err);
    } finally {
      setIsSelling(false);
    }
  };

  return (
    <div className="relative space-y-4 -mx-3">
      <button
        type="button"
        onClick={() => {
          const returnTo = sessionStorage.getItem("returnTo") || "/collection";
          navigate(returnTo);
        }}
        className="mb-1 flex items-center gap-1 text-xs transition-opacity hover:opacity-80 cursor-pointer"
        style={{ color: "var(--text-secondary)", background: "none", border: "none" }}
        aria-label="Retour"
      >
        <ChevronLeft size={28} strokeWidth={1.5} />
      </button>
      <div
        className="rounded-2xl px-2 py-3"
        style={{
          background: "var(--card-color)",
          boxShadow: "0 2px 12px rgba(0,0,0,0.15)",
          ...(isLight && { border: "1px solid var(--border-color)", padding: "16px 8px", borderRadius: 12 }),
        }}
      >
        <div style={{ paddingLeft: 12 }}>
          <div className="mb-2 flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div
                className="flex shrink-0 items-center justify-center overflow-hidden rounded-xl p-3"
                style={{
                  width: 154,
                  height: 154,
                  minWidth: 154,
                  minHeight: 154,
                  background: "var(--img-container-bg)",
                  boxSizing: "border-box",
                }}
              >
                {product.imageUrl ? (
                  <img
                    src={product.imageUrl}
                    alt={product.name}
                    width={130}
                    height={130}
                    className="object-contain"
                    style={{ objectFit: "contain" }}
                    loading="eager"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                      const fallback = e.currentTarget.nextElementSibling as HTMLElement | null;
                      if (fallback) fallback.style.display = "flex";
                    }}
                  />
                ) : null}
                <div
                  className="flex items-center justify-center"
                  style={{
                    display: product.imageUrl ? "none" : "flex",
                    width: 130,
                    height: 130,
                  }}
                >
                  <ItemIcon
                    imageUrl={null}
                    emoji={product.emoji}
                    name={product.name}
                    size={130}
                    frame="none"
                  />
                </div>
              </div>
              <div className="space-y-1 min-w-0 flex-1">
                <h2 className="app-heading text-sm" style={{ color: "var(--text-primary)" }}>
                  {product.name}
                </h2>
                <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                  {product?.set ?? ""}
                </p>
                <p className="text-[11px] uppercase tracking-wide mt-2 mb-0" style={{ color: "var(--text-secondary)" }}>
                  Prix actuel
                </p>
                <p className="text-2xl font-semibold mt-0" style={{ color: accentGold }}>
                  {prixMarche.toLocaleString("fr-FR", {
                    style: "currency",
                    currency: "EUR",
                    maximumFractionDigits: 0
                  })}
                </p>
                {isInCollection && (
                  <p className="mt-1 text-xs" style={{ color: "var(--text-secondary)" }}>
                    Achat{" "}
                    <span className="font-medium" style={{ color: "var(--text-primary)" }}>
                      {prixAchat.toLocaleString("fr-FR", {
                        style: "currency",
                        currency: "EUR",
                        maximumFractionDigits: 0
                      })}
                    </span>{" "}
                    • ×{quantite}
                  </p>
                )}
              </div>
            </div>
            {hasSale && (
              <span className="mt-1 rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-wide shrink-0" style={{ color: "var(--gain-green)", background: "rgba(34,197,94,0.15)" }}>
                Vendu
              </span>
            )}
          </div>
        </div>
      </div>

      <div
        className="rounded-2xl px-2 py-3"
        style={{
          background: "var(--card-color)",
          boxShadow: "0 2px 12px rgba(0,0,0,0.15)",
          ...(isLight && { border: "1px solid var(--border-color)", padding: "16px 8px", borderRadius: 12 }),
        }}
      >
        <div className="space-y-3">
          <div style={{ paddingLeft: 12 }}>
            <h3 className="app-heading mb-1 text-sm" style={{ color: "var(--text-primary)" }}>
              Historique de prix & vente
            </h3>
            <div className="flex gap-2">
              <button
            type="button"
            onClick={!premiumLoading && isPremium ? () => setChartPeriod("1an") : undefined}
            className="text-xs font-medium transition"
            style={{
              background: chartPeriod === "1an" ? accentGold : "var(--input-bg)",
              color: chartPeriod === "1an" ? "#000" : "var(--text-primary)",
              border: chartPeriod === "1an" ? "none" : "1px solid var(--border-color)",
              borderRadius: 20,
              padding: "4px 12px",
              fontWeight: chartPeriod === "1an" ? "bold" : "normal",
              ...(!premiumLoading && !isPremium && { pointerEvents: "none", opacity: 0.4 }),
            }}
          >
            1 an
          </button>
          <button
            type="button"
            onClick={!premiumLoading && isPremium ? () => setChartPeriod("2ans") : undefined}
            className="text-xs font-medium transition"
            style={{
              background: chartPeriod === "2ans" ? accentGold : "var(--input-bg)",
              color: chartPeriod === "2ans" ? "#000" : "var(--text-primary)",
              border: chartPeriod === "2ans" ? "none" : "1px solid var(--border-color)",
              borderRadius: 20,
              padding: "4px 12px",
              fontWeight: chartPeriod === "2ans" ? "bold" : "normal",
              ...(!premiumLoading && !isPremium && { pointerEvents: "none", opacity: 0.4 }),
            }}
          >
            2 ans
          </button>
            </div>
          </div>
          <div style={{ position: "relative" }}>
          <div
            style={
              isPremium
                ? {}
                : {
                    filter: "blur(4px)",
                    opacity: 0.3,
                    pointerEvents: "none",
                    userSelect: "none",
                  }
            }
          >
            <div
              className="rounded-2xl overflow-hidden"
              style={{
                position: "relative",
                background: "var(--bg-card-elevated)",
                height: 260,
                width: "100%",
                minHeight: 200,
              }}
            >
              <div
                aria-hidden
                style={{
                  position: "absolute",
                  inset: 0,
                  zIndex: 0,
                  backgroundImage: `url(${isDark ? "/images/fond%20graphique/mewtwoo.png?v=2" : "/images/fond%20graphique/mewtwoo_gris.png"})`,
                  backgroundSize: "contain",
                  backgroundRepeat: "no-repeat",
                  backgroundPosition: "center",
                  opacity: 0.18,
                  pointerEvents: "none",
                }}
              />
              <div style={{ position: "relative", zIndex: 1, height: "100%" }}>
              <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={!premiumLoading && isPremium && chartData.length > 0 ? chartData : MOCK_CHART_DATA}
                margin={{ top: 12, right: 8, left: 4, bottom: 8 }}
              >
                <defs>
                  <linearGradient id="areaGradDetail" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={accentGold} stopOpacity={0.3} />
                    <stop offset="100%" stopColor={accentGold} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="mois_court"
                  tick={{ fontSize: 9, fill: "#9CA3AF" }}
                  tickLine={false}
                  axisLine={false}
                  interval={chartData.length > 0 ? xAxisInterval : 1}
                />
                <YAxis
                  tickFormatter={(v) => `${v}€`}
                  tick={{ fontSize: 9, fill: "#9CA3AF" }}
                  tickLine={false}
                  axisLine={false}
                  width={32}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const p = payload[0]?.payload;
                    if (!p) return null;
                    const label = p.mois_label ?? "";
                    const prixVal = p.prix;
                    const prixStr = prixVal != null && !Number.isNaN(Number(prixVal)) ? `${Number(prixVal)} €` : "—";
                    return (
                      <div
                        className="rounded-xl px-3 py-2 text-xs"
                        style={{
                          background: "var(--card-color)",
                          color: accentGold,
                          boxShadow: "0 2px 12px rgba(0,0,0,0.2)",
                        }}
                      >
                        {label} : {prixStr}
                      </div>
                    );
                  }}
                />
                {Number.isFinite(prixAchat) && (
                  <ReferenceLine
                    y={prixAchat}
                    stroke="#9CA3AF"
                    strokeDasharray="4 4"
                    strokeWidth={1}
                  />
                )}
                <Area
                  type="monotone"
                  dataKey="prix"
                  stroke={accentGold}
                  strokeWidth={2}
                  fill="url(#areaGradDetail)"
                  dot={{ fill: accentGold, r: 2 }}
                  activeDot={{ fill: accentGold, r: 4 }}
                  connectNulls={false}
                />
              </AreaChart>
              </ResponsiveContainer>
              </div>
            </div>
            {priceListRows.length > 0 && (
              <div
                className="overflow-hidden text-xs"
                style={{
                  background: "var(--card-color)",
                  border: "1px solid var(--border-color)",
                  borderRadius: 12,
                  padding: 16,
                  marginTop: 12,
                }}
              >
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b" style={{ borderColor: "var(--card-color)" }}>
                      <th className="py-2 pl-3 text-left font-medium" style={{ color: "var(--text-secondary)" }}>
                        Mois
                      </th>
                      <th className="py-2 pr-3 text-right font-medium" style={{ color: "var(--text-secondary)" }}>
                        Prix (€)
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...priceListRows].reverse().map((p, idx) => (
                      <tr key={p?.mois ? String(p.mois) : `row-${idx}`} className="border-b" style={{ borderColor: "var(--card-color)" }}>
                        <td className="py-2 pl-3" style={{ color: "var(--text-secondary)" }}>{p?.mois_label ?? "—"}</td>
                        <td
                          className="py-2 pr-3 text-right font-medium"
                          style={{
                            color: p?.prix != null && !Number.isNaN(Number(p?.prix)) ? accentGold : "var(--text-secondary)",
                          }}
                        >
                          {p?.prix != null && !Number.isNaN(Number(p?.prix))
                            ? `${Number(p.prix)} €`
                            : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          {!premiumLoading && !isPremium && (
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                height: 260,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                pointerEvents: "none",
              }}
            >
              <div
                style={{
                  pointerEvents: "auto",
                  textAlign: "center",
                  padding: "12px 16px",
                  borderRadius: 16,
                  background: "rgba(0,0,0,0.65)",
                  color: "var(--text-primary)",
                  maxWidth: 260,
                }}
              >
                <div style={{ marginBottom: 6 }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={accentGold} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" style={{ filter: "drop-shadow(0 2px 4px rgba(212,167,87,0.4))" }}>
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                </div>
                <p
                  style={{
                    fontSize: 12,
                    marginBottom: 10,
                    color: "#FFFFFF",
                  }}
                >
                  Fonctionnalité réservée aux membres Boss Access
                </p>
                <a
                  href="/premium"
                  style={{
                    display: "inline-block",
                    padding: "6px 14px",
                    borderRadius: 9999,
                    background: accentGold,
                    color: "#000",
                    fontSize: 11,
                    fontWeight: 700,
                    textDecoration: "none",
                  }}
                >
                  S&apos;abonner
                </a>
              </div>
            </div>
          )}
        </div>
        {!isInCollection && (
          <button
            type="button"
            onClick={handleAddToCollection}
            onPointerDown={triggerAddPress}
            className={`btn-press flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition hover:opacity-90 ${addBtnPressed ? "btn-press-pressed" : ""}`}
            style={{
              background: "var(--bg-card-elevated)",
              color: "var(--text-primary)",
              boxShadow: "0 2px 12px rgba(0,0,0,0.12)",
            }}
          >
            <span>Ajouter à ma collection</span>
          </button>
        )}
        {isInCollection && (
          <div
            className="space-y-2"
            style={{
              background: "var(--card-color)",
              border: "1px solid var(--border-color)",
              borderRadius: 12,
              padding: 16,
            }}
          >
            <label className="mb-1 block text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
              Prix de vente final (€)
            </label>
            <div className="flex items-center gap-2">
              <div className="flex-1 rounded-2xl px-3 py-2 text-sm focus-within:ring-1 focus-within:ring-[var(--text-secondary)]/30" style={{ background: "var(--input-bg)" }}>
                <input
                  type="number"
                  inputMode="decimal"
                  className="w-full bg-transparent text-sm focus:outline-none"
                  style={{ color: "var(--text-primary)" }}
                  placeholder="Saisir le prix de vente..."
                  value={saleInput}
                  onChange={(e) => {
                    setSaleError(null);
                    setSaleLimitMessage(null);
                    const value = e.target.value;
                    setSaleInput(value);
                    const parsed = parseFloat(value.replace(",", "."));
                    if (!Number.isNaN(parsed)) {
                      setSalePrice(product.id, parsed);
                    } else {
                      setSalePrice(product.id, null);
                    }
                  }}
                />
              </div>
            </div>

            <label className="mb-1 mt-3 block text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
              Quantité à vendre{" "}
              <span className="font-normal opacity-80">(max. {quantite})</span>
            </label>
            <div className="flex items-center gap-2">
              <div
                className="w-full max-w-[120px] rounded-2xl px-3 py-2 text-sm focus-within:ring-1 focus-within:ring-[var(--text-secondary)]/30"
                style={{ background: "var(--input-bg)" }}
              >
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={quantite}
                  className="w-full bg-transparent text-sm focus:outline-none"
                  style={{ color: "var(--text-primary)" }}
                  value={saleQuantityToSell}
                  onChange={(e) => {
                    setSaleError(null);
                    setSaleLimitMessage(null);
                    const raw = e.target.value;
                    if (raw === "") {
                      setSaleQuantityToSell(1);
                      return;
                    }
                    const v = parseInt(raw, 10);
                    if (!Number.isFinite(v)) return;
                    const max = Math.max(1, quantite);
                    setSaleQuantityToSell(Math.min(Math.max(1, v), max));
                  }}
                />
              </div>
            </div>

            <div className="mt-2 grid grid-cols-2 gap-3 text-xs">
              <div
                style={{
                  background: "var(--input-bg)",
                  borderRadius: 8,
                  padding: 12,
                }}
              >
                <p className="text-[10px]" style={{ color: "var(--text-secondary)" }}>Bénéfice brut</p>
                <p
                  className="mt-1 text-base font-semibold"
                  style={{ color: hasSale ? (isPositive ? "var(--gain-green)" : "var(--loss-red)") : "var(--text-secondary)" }}
                >
                  {hasSale
                    ? `${isPositive ? "+" : ""}${brut.toLocaleString("fr-FR", {
                        style: "currency",
                        currency: "EUR",
                        maximumFractionDigits: 0
                      })}`
                    : "—"}
                </p>
              </div>
              <div
                style={{
                  background: "var(--input-bg)",
                  borderRadius: 8,
                  padding: 12,
                }}
              >
                <p className="text-[10px]" style={{ color: "var(--text-secondary)" }}>Performance %</p>
                <p
                  className="mt-1 text-base font-semibold"
                  style={{ color: hasSale ? (isPositive ? "var(--gain-green)" : "var(--loss-red)") : "var(--text-secondary)" }}
                >
                  {hasSale ? `${isPositive ? "+" : ""}${perfPct.toFixed(1)}%` : "—"}
                </p>
              </div>
            </div>

            {saleLimitMessage && (
              <div className="mt-2 space-y-2 rounded-lg px-3 py-2 text-xs" style={{ background: "rgba(239,68,68,0.12)", color: "var(--loss-red)" }}>
                <p>{saleLimitMessage}</p>
                <button
                  type="button"
                  className="font-semibold underline"
                  style={{ color: accentGold, background: "none", border: "none", cursor: "pointer", padding: 0 }}
                  onClick={() => navigate("/premium")}
                >
                  Voir Boss Access
                </button>
              </div>
            )}
            {saleError && (
              <p className="mt-2 text-xs" style={{ color: "var(--loss-red)" }}>
                {saleError}
              </p>
            )}

            <button
              type="button"
              onClick={handleVendre}
              disabled={!hasSale || isSelling}
              className="mt-3 w-full rounded-lg px-4 py-2.5 text-sm transition disabled:cursor-not-allowed"
              style={{
                background: hasSale && !isSelling ? accentGold : "var(--input-bg)",
                color: hasSale && !isSelling ? "var(--text-primary)" : "var(--text-secondary)",
                fontWeight: hasSale ? "bold" : "normal",
                border: "1px solid var(--border-color)",
              }}
            >
              {isSelling ? "Vente…" : "Vendre"}
            </button>
          </div>
        )}
        </div>
      </div>

    </div>
  );
};

export const ProductDetailPage = () => (
  <ProductDetailErrorBoundary>
    <ProductDetailPageInner />
  </ProductDetailErrorBoundary>
);
