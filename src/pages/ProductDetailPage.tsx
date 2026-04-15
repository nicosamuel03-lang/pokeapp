import { Component, useEffect, useMemo, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@clerk/react";
import {
  Area,
  ComposedChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  ReferenceLine,
} from "recharts";
import { PriceHistoryChartGaps, type PriceHistoryGapEndpoint } from "../components/PriceHistoryChartGaps";
import { useProducts, type Product } from "../state/ProductsContext";
import { useCollection } from "../state/CollectionContext";
import { setSalePrice } from "../utils/salesStorage";
import { getPrixMarcheForProduct } from "../utils/prixMarche";
import { useEbayTrackedPrice } from "../hooks/useEbayTrackedPrice";
import { isEbayMockMode } from "../services/ebayMarketPrice";
import { useSalesHistory } from "../hooks/useSalesHistory";
import { etbData } from "../data/etbData";
import { displayData } from "../data/displayData";
import rawUpcData from "../data/upc-data.json";
import { ItemIcon } from "../components/ItemIcon";
import { RasterImage } from "../components/RasterImage";
import { ChevronLeft } from "lucide-react";
import { useUser } from "@clerk/react";
import { useSubscription } from "../state/SubscriptionContext";
import { useTheme } from "../state/ThemeContext";
import { supabase } from "../lib/supabase";
import { fetchSalesCounterCount, incrementSalesCounterByOne } from "../lib/salesSupabase";
import { getGuestSalesTransactionCount } from "../utils/salesHistoryStorage";
import { STAT_CARD_VALUE_CLASS } from "../constants/statCardValueClass";
import type { PortfolioChartPeriod } from "../utils/portfolioChartData";
import { formatProductNameWithSetCode, getSetCodeFromProduct } from "../utils/formatProduct";
import { getMarketDataWarningForDisplayedPrice } from "../utils/ebayMarketDataWarning";
import { getEraBadge, getEraNeonBadgeStyle, getEraStyle } from "../utils/eraBadge";
import {
  isKnownProductCardEraLabel,
  productCardEraBadgeClassName,
} from "../utils/productCardEraBadge";
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

const MOIS_COURTS_FR = [
  "Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sept", "Oct", "Nov", "Déc",
] as const;

const MOIS_LONGS_FR = [
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre",
] as const;

/** Clé ISO mois → libellé tableau type « Mars 2026 ». */
function isoMonthToFrenchLongLabel(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})/);
  if (!m) return iso;
  const mi = parseInt(m[2], 10) - 1;
  if (mi < 0 || mi > 11) return iso;
  const name = MOIS_LONGS_FR[mi];
  const cap = name.charAt(0).toUpperCase() + name.slice(1);
  return `${cap} ${m[1]}`;
}

/** Clé ISO mois (2026-03) → libellé court axe X type « Mar 26 ». */
function isoMonthToShortLabel(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})/);
  if (!m) return iso;
  const mi = parseInt(m[2], 10) - 1;
  if (mi < 0 || mi > 11) return iso;
  return `${MOIS_COURTS_FR[mi]} ${String(m[1]).slice(-2)}`;
}

/** Date de sortie FR (catalogue display / `dateSortie`) → clé `YYYY-MM`. */
function parseReleaseDateToMonthKey(dateSortie: string | undefined | null): string | null {
  if (!dateSortie || typeof dateSortie !== "string") return null;
  const s = dateSortie.trim();
  if (/^\d{4}-\d{2}/.test(s)) return s.slice(0, 7);
  const parts = s.split("/");
  if (parts.length === 3) {
    const [, m, y] = parts;
    const month = String(m ?? "").padStart(2, "0");
    const year = String(y ?? "").trim();
    if (!month || !year) return null;
    return `${year}-${month}`;
  }
  return null;
}

const DISPLAY_CHART_FLOOR_MONTH = "2025-03";
const DISPLAY_PRICE_HISTORY_CHART_END_MONTH = "2026-03";

type DetailHistRow = { mois?: string; mois_label?: string; prix?: number | null };

/** Chronologie complète : Display / UPC = une seule série (pokedisplay) ; ETB = 2024 + 2025 + 2026 (etbData). */
function mergeProductDetailHistory(
  category: string | undefined,
  displayHist: DetailHistRow[] | undefined,
  h2024: DetailHistRow[],
  h2025: DetailHistRow[],
  h2026: DetailHistRow[]
): DetailHistRow[] {
  if (
    (category === "Displays" || category === "UPC") &&
    Array.isArray(displayHist) &&
    displayHist.length > 0
  ) {
    return [...displayHist]
      .filter((h) => h?.mois)
      .sort((a, b) => String(a.mois).localeCompare(String(b.mois)));
  }
  const rows = [...h2024, ...h2025, ...h2026].filter((h) => h?.mois);
  rows.sort((a, b) => String(a.mois).localeCompare(String(b.mois)));
  return rows;
}

/**
 * Axe X : du premier au dernier mois avec un prix > 0 (aucun mois « fantôme » après la dernière donnée).
 */
function trimHistoryToPrixBounds<T extends { mois?: string; prix?: number | null }>(
  rows: T[],
  getPrix: (r: T) => number | null
): T[] {
  const isValid = (v: number | null) =>
    v != null && !Number.isNaN(Number(v)) && Number(v) > 0;
  let first = -1;
  let last = -1;
  for (let i = 0; i < rows.length; i++) {
    const v = getPrix(rows[i]);
    if (isValid(v)) {
      if (first < 0) first = i;
      last = i;
    }
  }
  if (first < 0) return [];
  return rows.slice(first, last + 1);
}

function prixPointIsValid(p: number | null | undefined): boolean {
  return p != null && !Number.isNaN(Number(p)) && Number(p) > 0;
}

function addOneCalendarMonth(ym: string): string | null {
  const m = ym.match(/^(\d{4})-(\d{2})/);
  if (!m) return null;
  let y = Number(m[1]);
  let mo = Number(m[2]);
  mo += 1;
  if (mo > 12) {
    mo = 1;
    y += 1;
  }
  return `${y}-${String(mo).padStart(2, "0")}`;
}

/** Recule de `n` mois (n ≥ 0) depuis une clé YYYY-MM. */
function subtractCalendarMonths(isoYm: string, n: number): string {
  const m = isoYm.match(/^(\d{4})-(\d{2})/);
  if (!m) return isoYm;
  let y = Number(m[1]);
  let mo = Number(m[2]);
  let left = Math.max(0, Math.floor(n));
  while (left > 0) {
    mo -= 1;
    if (mo < 1) {
      mo = 12;
      y -= 1;
    }
    left -= 1;
  }
  return `${y}-${String(mo).padStart(2, "0")}`;
}

/**
 * Insère chaque mois calendaire entre le premier et le dernier mois (sans inventer de prix : null si absent).
 * Permet à l’Area de ne pas tracer un plein entre deux mois éloignés.
 */
function densifyMonthlyChartRows(
  rows: Array<{ mois: string; mois_label: string; mois_court: string; prix: number | null }>
): Array<{ mois: string; mois_label: string; mois_court: string; prix: number | null }> {
  if (rows.length === 0) return rows;
  const byMois = new Map(rows.map((r) => [r.mois, r]));
  const firstM = rows[0].mois;
  const lastM = rows[rows.length - 1].mois;
  const out: Array<{ mois: string; mois_label: string; mois_court: string; prix: number | null }> = [];
  let cur: string | null = firstM;
  while (cur) {
    const existing = byMois.get(cur);
    if (existing) {
      out.push(existing);
    } else {
      const short = isoMonthToShortLabel(cur);
      out.push({
        mois: cur,
        mois_label: short,
        mois_court: short,
        prix: null,
      });
    }
    if (cur >= lastM) break;
    const next = addOneCalendarMonth(cur);
    if (!next || next > lastM) break;
    cur = next;
  }
  return out;
}

/** Segments en pointillés entre deux mois avec prix en laissant au moins un mois sans donnée entre les deux. */
function buildGapBridgeEndpoints(
  points: Array<{ mois: string; mois_court: string; mois_label: string; prix: number | null }>
): [PriceHistoryGapEndpoint, PriceHistoryGapEndpoint][] {
  const bridges: [PriceHistoryGapEndpoint, PriceHistoryGapEndpoint][] = [];
  let lastIdx = -1;
  for (let i = 0; i < points.length; i++) {
    if (!prixPointIsValid(points[i]?.prix)) continue;
    const b = points[i];
    if (lastIdx >= 0 && i - lastIdx > 1) {
      const a = points[lastIdx];
      bridges.push([
        {
          mois: a.mois,
          mois_court: a.mois_court,
          mois_label: a.mois_label,
          prix: Number(a.prix),
        },
        {
          mois: b.mois,
          mois_court: b.mois_court,
          mois_label: b.mois_label,
          prix: Number(b.prix),
        },
      ]);
    }
    lastIdx = i;
  }
  return bridges;
}

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
  const { isSignedIn } = useAuth();
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
  const [authMessage, setAuthMessage] = useState(false);

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

  /** Même nom complet que sur les cartes accueil (code set entre parenthèses). */
  const categoryForFormat = useMemo((): "ETB" | "Displays" | "UPC" => {
    if (!product) return "ETB";
    if (product.category === "UPC") return "UPC";
    if (product.category === "ETB") return "ETB";
    return "Displays";
  }, [product?.category]);

  const displayProductName = useMemo(() => {
    if (!product) return "";
    return formatProductNameWithSetCode(
      product.name,
      getSetCodeFromProduct(product),
      categoryForFormat
    );
  }, [product, categoryForFormat]);

  const catalogPrixMarche = useMemo(
    () => (product ? getPrixMarcheForProduct(product, etbData) : 0),
    [product, etbData]
  );

  // ID produit tel qu'il est stocké dans ebay_prices (ETB : etbId, Display/UPC : product.id)
  const trackedProductId = (() => {
    const rawId = product?.etbId ?? product?.id ?? null;
    if (!rawId) return null;
    const category = (product?.category || "").toLowerCase();
    if (category === "displays" || category === "display") {
      const cleanId = rawId.replace(/^display-/i, "");
      return `display-${cleanId}`;
    }
    if (category === "upc") {
      const cleanId = rawId.replace(/^upc-/i, "");
      return `upc-${cleanId}`;
    }
    return rawId;
  })();
  const ebayTracked = useEbayTrackedPrice(trackedProductId, !!product && !isEbayMockMode());
  const prixSource: "ebay_tracked" | "catalog" =
    ebayTracked.available &&
    ebayTracked.averagePriceEur != null &&
    ebayTracked.averagePriceEur > 0
      ? "ebay_tracked"
      : "catalog";

  useEffect(() => {
    if (!product) return;
    console.log("[ProductDetail eBay]", {
      trackedProductId,
      loading: ebayTracked.loading,
      available: ebayTracked.available,
      count: ebayTracked.count,
      averagePriceEur: ebayTracked.averagePriceEur,
      prixSource,
      productId: product.id,
      category: product.category,
    });
  }, [
    product,
    trackedProductId,
    ebayTracked.loading,
    ebayTracked.available,
    ebayTracked.count,
    ebayTracked.averagePriceEur,
    prixSource,
  ]);

  /** Même badge d’ère / pilule néon que sur les cartes produit (accueil). */
  const eraBadgeForDetail = useMemo(() => {
    if (!product) return null;
    if (product.category !== "ETB" && product.category !== "Displays" && product.category !== "UPC") return null;
    return (
      getEraBadge(product.id, product.set) ??
      (product.set ? { label: product.set, ...getEraStyle(product.set) } : null)
    );
  }, [product]);

  const [saleInput, setSaleInput] = useState<string>("");
  /** Quantité à vendre pour cette ligne (1 … quantité possédée). */
  const [saleQuantityToSell, setSaleQuantityToSell] = useState(1);
  const [chartPeriod, setChartPeriod] = useState<PortfolioChartPeriod>("1an");
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

  // UPC : une seule fenêtre (6 mois) → état figé.
  useEffect(() => {
    if (product?.category === "UPC") setChartPeriod("6m");
  }, [product?.category]);

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

  const { chartData, priceListRows, xAxisInterval, validPriceCount, gapBridgeSegments } = useMemo(() => {
    try {
      const safe2024 = Array.isArray(history2024) ? history2024 : [];
      const safe2025 = Array.isArray(history2025) ? history2025 : [];
      const safe2026 = Array.isArray(history2026) ? history2026 : [];

      /** Historique graphique : toujours la série pokedisplay (display-data.json), jamais une version enrichie côté contexte. */
      let historiqueChartSource: DetailHistRow[] | undefined;
      let displayCatalogRow: (typeof displayData)[number] | undefined;
      if (
        product &&
        (product.category === "Displays" || product.category === "UPC")
      ) {
        const pid = product.id ?? "";
        if (product.category === "UPC") {
          const upcData = rawUpcData as {
            id?: string;
            code?: string;
            historique_prix?: DetailHistRow[];
            priceHistory?: { month?: string; price?: number | null }[];
            name?: string;
          }[];

          const normalize = (v: unknown) =>
            String(v ?? "")
              .trim()
              .toLowerCase()
              .replace(/^upc-/, "")
              .replace(/^display-/, "");

          const extractUpcCode = (p: Product | null): string | null => {
            if (!p) return null;
            const anyP = p as unknown as { code?: unknown; id?: unknown; name?: unknown };
            const direct = normalize(anyP.code);
            if (/^upc\d{2}$/.test(direct)) return direct.toUpperCase();
            const candidates = [anyP.id, anyP.name].map((x) => String(x ?? ""));
            for (const s of candidates) {
              const m = s.match(/UPC\d{2}/i);
              if (m) return m[0].toUpperCase();
            }
            return null;
          };

          const pidNorm = normalize(pid);
          const codeGuess = normalize(extractUpcCode(product));
          const productNameNorm = normalize((product as unknown as { name?: unknown } | null)?.name);

          const upcRow = upcData.find((u) => {
            const idNorm = normalize(u.id);
            const codeNorm = normalize(u.code);
            const upcNameNorm = normalize(u.name);
            return (
              (pidNorm && idNorm && idNorm === pidNorm) ||
              (pidNorm && codeNorm && codeNorm === pidNorm) ||
              (codeGuess && idNorm && idNorm === codeGuess) ||
              (codeGuess && codeNorm && codeNorm === codeGuess) ||
              // Fallback collection : `product.id` = UUID Supabase, `code` absent → match fuzzy par nom.
              (productNameNorm &&
                upcNameNorm &&
                (productNameNorm.includes(upcNameNorm) || upcNameNorm.includes(productNameNorm))) ||
              // tolérance : certains chemins stockent `UPC01` alors que l'ID JSON est `upc-UPC01`
              (pidNorm && idNorm && idNorm === normalize(`upc-${pidNorm}`)) ||
              (pidNorm && codeNorm && codeNorm === normalize(`upc-${pidNorm}`)) ||
              (codeGuess && idNorm && idNorm === normalize(`upc-${codeGuess}`)) ||
              (codeGuess && codeNorm && codeNorm === normalize(`upc-${codeGuess}`))
            );
          });

          if (upcRow) {
            if (Array.isArray(upcRow.historique_prix) && upcRow.historique_prix.length > 0) {
              historiqueChartSource = upcRow.historique_prix as DetailHistRow[];
            } else if (Array.isArray(upcRow.priceHistory) && upcRow.priceHistory.length > 0) {
              // Fallback : certains chemins peuvent ne pas embarquer `historique_prix`.
              historiqueChartSource = upcRow.priceHistory
                .filter((p) => p?.month)
                .map((p) => ({
                  mois: String(p.month),
                  mois_label: String(p.month),
                  prix: p.price ?? null,
                }));
            }
          }
        } else {
          const normalizeDisplay = (v: unknown) =>
            String(v ?? "")
              .trim()
              .toLowerCase()
              .replace(/^display-/, "")
              .replace(/^upc-/, "");

          const rawId = pid.startsWith("display-") ? pid.slice("display-".length) : "";
          if (rawId) {
            displayCatalogRow = displayData.find(
              (d) => d.id.toLowerCase() === rawId.toLowerCase()
            );
            if (displayCatalogRow?.historique_prix?.length) {
              historiqueChartSource = displayCatalogRow.historique_prix as DetailHistRow[];
            }
          }
          // Fallback collection : `product.id` = UUID Supabase, pas de préfixe display-* → match par nom (comme UPC).
          if (!historiqueChartSource?.length) {
            const productNameNorm = normalizeDisplay(product.name);
            if (productNameNorm) {
              displayCatalogRow = displayData.find((d) => {
                const displayNameNorm = normalizeDisplay(d.name);
                return (
                  displayNameNorm.length > 0 &&
                  (productNameNorm.includes(displayNameNorm) ||
                    displayNameNorm.includes(productNameNorm))
                );
              });
              if (displayCatalogRow?.historique_prix?.length) {
                historiqueChartSource = displayCatalogRow.historique_prix as DetailHistRow[];
              }
            }
          }
        }
      }

      // Fallback UPC quand le produit vient de la collection (`collectionId`) mais n'a pas l'historique attaché
      // ou quand la catégorie est mal propagée : on tente une résolution UPC par code/id.
      if (
        product &&
        !historiqueChartSource?.length &&
        (collectionIdFromUrl || product.category === "UPC" || /upc/i.test(String(product.id ?? "")) || /UPC\d{2}/i.test(String(product.name ?? "")))
      ) {
        const upcData = rawUpcData as {
          id?: string;
          code?: string;
          historique_prix?: DetailHistRow[];
          priceHistory?: { month?: string; price?: number | null }[];
          name?: string;
        }[];

        const normalize = (v: unknown) =>
          String(v ?? "")
            .trim()
            .toLowerCase()
            .replace(/^upc-/, "")
            .replace(/^display-/, "");

        const pidNorm = normalize(product.id);
        const productNameNorm = normalize((product as unknown as { name?: unknown } | null)?.name);
        const codeFromText = (() => {
          const anyP = product as unknown as { code?: unknown; id?: unknown; name?: unknown };
          const direct = normalize(anyP.code);
          if (/^upc\d{2}$/.test(direct)) return direct;
          const candidates = [anyP.id, anyP.name].map((x) => String(x ?? ""));
          for (const s of candidates) {
            const m = s.match(/UPC\d{2}/i);
            if (m) return normalize(m[0]);
          }
          return "";
        })();

        const upcRow = upcData.find((u) => {
          const idNorm = normalize(u.id);
          const codeNorm = normalize(u.code);
          const upcNameNorm = normalize(u.name);
          return (
            (pidNorm && (idNorm === pidNorm || codeNorm === pidNorm)) ||
            (codeFromText && (idNorm === codeFromText || codeNorm === codeFromText)) ||
            (productNameNorm &&
              upcNameNorm &&
              (productNameNorm.includes(upcNameNorm) || upcNameNorm.includes(productNameNorm))) ||
            (pidNorm && (idNorm === normalize(`upc-${pidNorm}`) || codeNorm === normalize(`upc-${pidNorm}`))) ||
            (codeFromText && (idNorm === normalize(`upc-${codeFromText}`) || codeNorm === normalize(`upc-${codeFromText}`)))
          );
        });

        if (upcRow) {
          if (Array.isArray(upcRow.historique_prix) && upcRow.historique_prix.length > 0) {
            historiqueChartSource = upcRow.historique_prix as DetailHistRow[];
          } else if (Array.isArray(upcRow.priceHistory) && upcRow.priceHistory.length > 0) {
            historiqueChartSource = upcRow.priceHistory
              .filter((p) => p?.month)
              .map((p) => ({
                mois: String(p.month),
                mois_label: String(p.month),
                prix: p.price ?? null,
              }));
          }
        }
      }
      const displayHistForChart =
        historiqueChartSource ??
        (product && Array.isArray(product.historique_prix)
          ? (product.historique_prix as DetailHistRow[])
          : undefined);

      /** Display / UPC : grille des prix depuis la même source que le graphique (Excel / JSON). */
      const displayPrixMap =
        (product?.category === "Displays" || product?.category === "UPC") &&
        displayHistForChart?.length
          ? (() => {
              const m = new Map<string, number | null>();
              for (const h of displayHistForChart) {
                if (h?.mois) m.set(h.mois, h.prix ?? null);
              }
              return m;
            })()
          : null;

      /** Mois >= date de sortie produit (YYYY-MM). */
      const filterFromRelease = <T extends { mois?: string }>(
        items: T[],
        releaseMonth: string | null
      ): T[] => {
        if (!releaseMonth) return items;
        return items.filter((item) => item.mois && item.mois >= releaseMonth);
      };

      /** Lignes sans prix (tableau récap uniquement). */
      const filterEmptyRows = <T extends { prix?: number | null }>(items: T[]): T[] =>
        items.filter((item) => item.prix != null && !Number.isNaN(Number(item.prix)));

      const merged = mergeProductDetailHistory(
        product?.category,
        displayHistForChart,
        safe2024,
        safe2025,
        safe2026
      );

      const afterRelease = filterFromRelease(merged, releaseMonthKey);

      const getPrixForRow = (p: DetailHistRow) => {
        const mois = p.mois ?? "";
        if (displayPrixMap?.has(mois)) return displayPrixMap.get(mois) ?? null;
        return p.prix ?? null;
      };

      let displayChartStartKey: string | null = null;
      if (product?.category === "Displays") {
        const displayReleaseKey =
          parseReleaseDateToMonthKey(displayCatalogRow?.releaseDate) ??
          releaseMonthKey ??
          parseReleaseDateToMonthKey(product?.dateSortie);
        let raw =
          displayReleaseKey && /^\d{4}-\d{2}/.test(displayReleaseKey)
            ? displayReleaseKey
            : null;
        if (!raw) raw = afterRelease[0]?.mois ?? null;
        if (raw && /^\d{4}-\d{2}/.test(raw)) {
          displayChartStartKey =
            raw > DISPLAY_CHART_FLOOR_MONTH ? raw : DISPLAY_CHART_FLOOR_MONTH;
        } else {
          displayChartStartKey = DISPLAY_CHART_FLOOR_MONTH;
        }
      }

      let etbChartStartKey: string | null = null;
      if (product?.category === "ETB") {
        let raw =
          releaseMonthKey && /^\d{4}-\d{2}/.test(releaseMonthKey)
            ? releaseMonthKey
            : null;
        if (!raw) raw = afterRelease[0]?.mois ?? null;
        if (raw && /^\d{4}-\d{2}/.test(raw)) {
          etbChartStartKey =
            raw > DISPLAY_CHART_FLOOR_MONTH ? raw : DISPLAY_CHART_FLOOR_MONTH;
        } else {
          etbChartStartKey = DISPLAY_CHART_FLOOR_MONTH;
        }
      }

      /**
       * Displays : de max(releaseDate, mars 2025) jusqu’à mars 2026 inclus.
       * ETB : même fenêtre calendaire (données disponibles sur la plage).
       * UPC : fenêtre 6 ou 12 derniers mois depuis la fin de la série.
       */
      let windowed: DetailHistRow[];
      if (product?.category === "Displays") {
        const startKey = displayChartStartKey;
        if (
          !startKey ||
          !/^\d{4}-\d{2}/.test(startKey) ||
          startKey > DISPLAY_PRICE_HISTORY_CHART_END_MONTH
        ) {
          windowed = [];
        } else {
          windowed = [];
          let cur: string | null = startKey;
          while (cur && cur <= DISPLAY_PRICE_HISTORY_CHART_END_MONTH) {
            const fromHist = displayHistForChart?.find((h) => h.mois === cur);
            const prix = displayPrixMap?.has(cur)
              ? displayPrixMap.get(cur) ?? null
              : fromHist?.prix ?? null;
            windowed.push({
              mois: cur,
              mois_label: fromHist?.mois_label ?? cur,
              prix,
            });
            const next = addOneCalendarMonth(cur);
            if (!next || next > DISPLAY_PRICE_HISTORY_CHART_END_MONTH) break;
            cur = next;
          }
        }
      } else if (product?.category === "UPC") {
        // UPC : fenêtre fixe 2025-10 → 2026-03 (6 mois), sans dépendre de displayData.
        const UPC_START_MONTH = "2025-10";
        const UPC_END_MONTH = "2026-03";
        windowed = afterRelease.filter(
          (r) => r.mois && r.mois >= UPC_START_MONTH && r.mois <= UPC_END_MONTH
        );
      } else if (product?.category === "ETB") {
        const startKey = etbChartStartKey;
        if (
          !startKey ||
          !/^\d{4}-\d{2}/.test(startKey) ||
          startKey > DISPLAY_PRICE_HISTORY_CHART_END_MONTH
        ) {
          windowed = [];
        } else {
          const mergedByMois = new Map<string, DetailHistRow>();
          for (const r of merged) {
            if (r.mois) mergedByMois.set(String(r.mois), r);
          }
          windowed = [];
          let cur: string | null = startKey;
          while (cur && cur <= DISPLAY_PRICE_HISTORY_CHART_END_MONTH) {
            const fromRow = mergedByMois.get(cur);
            const prix = fromRow ? getPrixForRow(fromRow) : null;
            windowed.push({
              mois: cur,
              mois_label: fromRow?.mois_label ?? cur,
              prix,
            });
            const next = addOneCalendarMonth(cur);
            if (!next || next > DISPLAY_PRICE_HISTORY_CHART_END_MONTH) break;
            cur = next;
          }
        }
      } else {
        const trimmed = trimHistoryToPrixBounds(afterRelease, getPrixForRow);
        const maxPoints = chartPeriod === "1an" ? 12 : 6;
        windowed = trimmed.length > 0 ? trimmed.slice(-maxPoints) : [];
      }

      const rows: { mois: string; mois_label: string; prix: number | null }[] = windowed.map((p) => {
        const mois = p.mois ?? "";
        const prix = displayPrixMap?.has(mois)
          ? (displayPrixMap.get(mois) ?? null)
          : (p.prix ?? null);
        return {
          mois,
          mois_label:
            product?.category === "Displays" && mois
              ? isoMonthToFrenchLongLabel(mois)
              : p.mois_label || mois,
          prix,
        };
      });

      const data = rows.map((p) => ({
        ...p,
        mois_court: p.mois ? isoMonthToShortLabel(p.mois) : "",
      }));

      const chartReleaseFilterKey =
        product?.category === "Displays"
          ? displayChartStartKey ?? DISPLAY_CHART_FLOOR_MONTH
          : product?.category === "ETB"
            ? etbChartStartKey ?? DISPLAY_CHART_FLOOR_MONTH
            : releaseMonthKey;

      const filteredData =
        product?.category === "UPC"
          ? data
          : filterFromRelease(data, chartReleaseFilterKey);
      const filteredRows =
        product?.category === "UPC"
          ? rows
          : filterEmptyRows(filterFromRelease(rows, chartReleaseFilterKey));

      let chartSeriesDense = densifyMonthlyChartRows(filteredData);

      if (product?.category === "Displays" || product?.category === "ETB") {
        const start =
          product?.category === "Displays"
            ? displayChartStartKey ?? DISPLAY_CHART_FLOOR_MONTH
            : etbChartStartKey ?? DISPLAY_CHART_FLOOR_MONTH;
        chartSeriesDense = chartSeriesDense.filter(
          (p) =>
            !!p.mois &&
            p.mois >= start &&
            p.mois <= DISPLAY_PRICE_HISTORY_CHART_END_MONTH
        );
        if (chartPeriod === "6m") {
          let s = chartSeriesDense;
          while (s.length > 0 && !prixPointIsValid(s[0]?.prix)) {
            s = s.slice(1);
          }
          chartSeriesDense = s.length > 0 ? s.slice(-6) : [];
        }
      }

      const n = chartSeriesDense.length;
      const xAxisInterval = n > 20 ? 2 : n > 12 ? 1 : 0;

      const validPriceCount = chartSeriesDense.filter((p) => prixPointIsValid(p.prix)).length;
      const gapBridgeSegments = buildGapBridgeEndpoints(chartSeriesDense);

      return {
        chartData: chartSeriesDense,
        priceListRows: filteredRows,
        xAxisInterval,
        validPriceCount,
        gapBridgeSegments,
      };
    } catch (err) {
      console.error("[ProductDetailPage] chart data error", err);
      return {
        chartData: [],
        priceListRows: [],
        xAxisInterval: 1 as const,
        validPriceCount: 0,
        gapBridgeSegments: [] as [PriceHistoryGapEndpoint, PriceHistoryGapEndpoint][],
      };
    }
  }, [chartPeriod, history2024, history2025, history2026, releaseMonthKey, product]);

  /** Premier mois sans prix dans la série affichée : tooltip Recharts visible au chargement (defaultIndex). */
  const defaultTooltipIndexForNull = useMemo(() => {
    if (!premiumLoading && isPremium && chartData.length > 0) {
      const idx = chartData.findIndex((d) => d.prix === null);
      return idx >= 0 ? idx : undefined;
    }
    return undefined;
  }, [chartData, premiumLoading, isPremium]);

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
  const composedChartData =
    !premiumLoading && isPremium && chartData.length > 0 ? chartData : MOCK_CHART_DATA;

  const prixMarche =
    ebayTracked.available &&
    ebayTracked.averagePriceEur != null &&
    ebayTracked.averagePriceEur > 0
      ? ebayTracked.averagePriceEur
      : catalogPrixMarche;
  const marketDataWarning = useMemo(
    () =>
      product ? getMarketDataWarningForDisplayedPrice(product, prixMarche) : false,
    [product, prixMarche]
  );
  const performanceVsPurchasePercent =
    collectionMatch != null && collectionMatch.buyPrice > 0 && Number.isFinite(prixMarche)
      ? ((prixMarche - collectionMatch.buyPrice) / collectionMatch.buyPrice) * 100
      : null;
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
    if (!isSignedIn) {
      setAuthMessage(true);
      setTimeout(() => setAuthMessage(false), 4000);
      return;
    }
    if (navigator.vibrate) navigator.vibrate(50);
    const itemId = product.etbId ?? product.id;
    navigate(`/ajouter?item=${encodeURIComponent(itemId)}`);
  };

  const handleVendre = async () => {
    if (!hasSale || !product || !collectionMatch) return;

    setSaleError(null);
    setSaleLimitMessage(null);

    const userId = user?.id ?? null;

    // Limite free : table `sales_counter` (+1 par vente, clé = Clerk id) ou compteur monotone invité.
    if (authState === "free") {
      const currentTxCount = userId
        ? await fetchSalesCounterCount(userId)
        : getGuestSalesTransactionCount();
      if (currentTxCount + 1 > FREE_SALE_LIMIT) {
        setSaleLimitMessage(
          `Limite gratuite : ${FREE_SALE_LIMIT} ventes max. Passez à Boss Access pour continuer à vendre.`
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
        product_name: String(displayProductName || product.name || ""),
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
        const countOk = await incrementSalesCounterByOne(userId);
        if (!countOk) {
          setSaleError(
            "Vente enregistrée, mais le compteur « Ventes utilisées » n’a pas pu être mis à jour (table sales_counter / RLS)."
          );
        }
        refreshSales();
      } else {
        try {
          await addSaleRecord({
            productId: product.id,
            productName: displayProductName || product.name || "",
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
      {authMessage && (
        <div
          style={{
            position: "fixed",
            top: 16,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 10000,
            background: "#1a1a1a",
            color: "#ffffff",
            padding: "10px 20px",
            borderRadius: 12,
            fontSize: 13,
            fontWeight: 500,
            boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
            textAlign: "center",
            maxWidth: "90vw",
          }}
        >
          Vous devez vous connecter pour ajouter un item à votre collection.
        </div>
      )}
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
        className="mb-0 rounded-2xl px-2 py-3"
        style={{
          background: "var(--card-color)",
          boxShadow: "0 2px 12px rgba(0,0,0,0.15)",
          ...(isLight && { border: "1px solid var(--border-color)", padding: "16px 8px", borderRadius: 12 }),
        }}
      >
        <div style={{ paddingLeft: 12 }}>
          <div className="mb-0 flex items-start justify-between gap-3">
            <div className="flex min-w-0 flex-1 items-stretch gap-2 md:gap-3">
              <div
                className="flex max-h-56 w-[min(35%,130px)] max-w-[130px] shrink-0 items-center justify-center rounded-xl p-1.5 md:w-[220px] md:max-w-[220px] md:p-2"
                style={{
                  background: "var(--img-container-bg)",
                  boxSizing: "border-box",
                }}
              >
                {product.imageUrl ? (
                  <RasterImage
                    src={product.imageUrl}
                    alt={displayProductName}
                    className="h-auto max-h-56 w-full max-w-full object-contain"
                    style={{ objectFit: "contain", maxHeight: "14rem" }}
                    loading="eager"
                    fetchPriority="high"
                    decoding="async"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                      const fallback = e.currentTarget.nextElementSibling as HTMLElement | null;
                      if (fallback) fallback.style.display = "flex";
                    }}
                  />
                ) : null}
                <div
                  className="flex max-h-56 w-full items-center justify-center"
                  style={{
                    display: product.imageUrl ? "none" : "flex",
                    minHeight: 112,
                  }}
                >
                  <ItemIcon
                    imageUrl={null}
                    emoji={product.emoji}
                    name={displayProductName}
                    size={112}
                    frame="none"
                  />
                </div>
              </div>
              <div className="flex min-h-0 min-w-0 flex-1 basis-0 flex-col justify-end overflow-visible">
                <div className="flex w-full min-w-0 flex-col gap-2">
                  {eraBadgeForDetail ? (
                    <span
                      className={`w-fit max-w-[min(100%,200px)] shrink-0 self-start font-semibold ${productCardEraBadgeClassName(eraBadgeForDetail.label)}`}
                      style={
                        isLight && isKnownProductCardEraLabel(eraBadgeForDetail.label)
                          ? undefined
                          : getEraNeonBadgeStyle(eraBadgeForDetail.label)
                      }
                    >
                      {eraBadgeForDetail.label}
                    </span>
                  ) : null}
                  <h2
                    className="app-heading max-w-none text-sm"
                    style={{
                      color: "var(--text-primary)",
                      whiteSpace: "normal",
                      overflow: "visible",
                      wordBreak: "break-word",
                    }}
                  >
                    {displayProductName}
                  </h2>
                  <div className="flex flex-col gap-1">
                    <p
                      className="mb-0 text-[11px] font-medium uppercase tracking-wide"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      Prix actuel
                    </p>
                    <div className="flex flex-wrap items-baseline gap-2">
                      <p
                        className="tabular-nums"
                        style={{
                          fontSize: "2rem",
                          fontWeight: 700,
                          color: accentGold,
                          lineHeight: 1.2,
                        }}
                      >
                        {prixMarche.toLocaleString("fr-FR", {
                          style: "currency",
                          currency: "EUR",
                          maximumFractionDigits: 0
                        })}
                      </p>
                      {ebayTracked.loading ? (
                        <span className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
                          eBay…
                        </span>
                      ) : null}
                      {performanceVsPurchasePercent != null && Number.isFinite(performanceVsPurchasePercent) ? (
                        <span
                          className="tabular-nums"
                          style={{
                            fontSize: "1rem",
                            fontWeight: 500,
                            color:
                              performanceVsPurchasePercent >= 0 ? "var(--gain-green)" : "var(--loss-red)",
                          }}
                        >
                          {performanceVsPurchasePercent >= 0 ? "+" : ""}
                          {performanceVsPurchasePercent.toFixed(1)}%
                        </span>
                      ) : !isInCollection &&
                        typeof product.change30dPercent === "number" &&
                        Number.isFinite(product.change30dPercent) ? (
                        <span
                          className="tabular-nums"
                          style={{
                            fontSize: "1rem",
                            fontWeight: 500,
                            color:
                              product.change30dPercent >= 0 ? "var(--gain-green)" : "var(--loss-red)",
                          }}
                        >
                          {product.change30dPercent >= 0 ? "+" : ""}
                          {product.change30dPercent.toFixed(1)}%
                        </span>
                      ) : null}
                    </div>

                    {!isEbayMockMode() && !ebayTracked.loading ? (
                      <div className="mt-1 flex flex-col gap-1">
                        <div className="flex items-center gap-1.5">
                          <span
                            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
                            style={{
                              background: "rgba(59,130,246,0.15)",
                              color: "#60a5fa",
                              border: "1px solid rgba(59,130,246,0.3)",
                            }}
                          >
                            <svg width="8" height="8" viewBox="0 0 8 8" fill="currentColor" aria-hidden="true">
                              <circle cx="4" cy="4" r="3" />
                            </svg>
                            Prix marché eBay
                          </span>
                          <span className="text-[10px]" style={{ color: "var(--text-secondary)" }}>
                            {prixSource === "ebay_tracked"
                              ? `moy. 90j · ${ebayTracked.count} ${ebayTracked.count > 1 ? "entrées" : "entrée"}`
                              : "estimé"}
                          </span>
                        </div>
                        {marketDataWarning ? (
                          <p
                            className="rounded-lg px-2 py-1.5 text-[10px] font-medium leading-snug"
                            role="status"
                            style={{
                              background: "rgba(234,179,8,0.12)",
                              color: "#eab308",
                              border: "1px solid rgba(234,179,8,0.35)",
                            }}
                          >
                            Market Data Warning : le prix affiché semble anormalement bas pour ce set —
                            vérifiez les annonces (boosters, codes, erreur de matching).
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                  {isInCollection && (
                    <p className="mt-0 text-xs" style={{ color: "var(--text-secondary)" }}>
                      Achat{" "}
                      <span className={STAT_CARD_VALUE_CLASS} style={{ color: "var(--text-primary)" }}>
                        {prixAchat.toLocaleString("fr-FR", {
                          style: "currency",
                          currency: "EUR",
                          maximumFractionDigits: 0
                        })}
                      </span>{" "}
                      • ×<span className={STAT_CARD_VALUE_CLASS}>{quantite}</span>
                    </p>
                  )}
                </div>
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

      {isInCollection && (
        <div
          className="rounded-2xl px-2 py-3"
          style={{
            background: "var(--card-color)",
            boxShadow: "0 2px 12px rgba(0,0,0,0.15)",
            ...(isLight && { border: "1px solid var(--border-color)", padding: "16px 8px", borderRadius: 12 }),
          }}
        >
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
                  className={`${STAT_CARD_VALUE_CLASS} w-full bg-transparent focus:outline-none`}
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
              <span className="font-normal opacity-80">
                (max. <span className={STAT_CARD_VALUE_CLASS}>{quantite}</span>)
              </span>
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
                  className={`${STAT_CARD_VALUE_CLASS} w-full bg-transparent focus:outline-none`}
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
                  className={`${STAT_CARD_VALUE_CLASS} mt-1`}
                  style={{
                    color: hasSale ? (isPositive ? "var(--gain-green)" : "var(--loss-red)") : "var(--text-secondary)",
                  }}
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
                  className={`${STAT_CARD_VALUE_CLASS} mt-1`}
                  style={{
                    color: hasSale ? (isPositive ? "var(--gain-green)" : "var(--loss-red)") : "var(--text-secondary)",
                  }}
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
        </div>
      )}

      <div
        className="mb-0 rounded-2xl px-2 pb-3 pt-2 !mt-1"
        style={{
          background: "var(--card-color)",
          boxShadow: "0 2px 12px rgba(0,0,0,0.15)",
          ...(isLight && {
            border: "1px solid var(--border-color)",
            padding: "8px 8px 16px 8px",
            borderRadius: 12,
          }),
        }}
      >
        <div className="space-y-3">
          <div style={{ paddingLeft: 8, paddingRight: 8 }}>
            <h3 className="app-heading mb-1 text-sm" style={{ color: "var(--text-primary)" }}>
              Historique de prix & vente
            </h3>
            <div className="flex gap-2">
              <button
            type="button"
            onClick={product?.category === "UPC" ? undefined : (!premiumLoading && isPremium ? () => setChartPeriod("6m") : undefined)}
            className={product?.category === "UPC" ? "text-xs font-medium" : "text-xs font-medium transition"}
            style={{
              background: product?.category === "UPC" ? accentGold : (chartPeriod === "6m" ? accentGold : "var(--input-bg)"),
              color: product?.category === "UPC" ? "#000" : (chartPeriod === "6m" ? "#000" : "var(--text-primary)"),
              border: product?.category === "UPC" ? "none" : (chartPeriod === "6m" ? "none" : "1px solid var(--border-color)"),
              borderRadius: 20,
              padding: "4px 12px",
              fontWeight: "bold",
              ...(product?.category === "UPC"
                ? { cursor: "default", pointerEvents: "none" as const }
                : (!premiumLoading && !isPremium && { pointerEvents: "none", opacity: 0.4 })),
            }}
          >
            6 mois
          </button>
          {product?.category === "UPC" ? null : (
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
          )}
            </div>
          </div>
          <div
            style={{
              position: "relative",
              marginLeft: -8,
              marginRight: -8,
              width: "calc(100% + 16px)",
            }}
          >
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
                height: 350,
                width: "100%",
                minHeight: 200,
                boxSizing: "border-box",
              }}
            >
              <div
                className="mewtwo-png-watermark-layer"
                aria-hidden
                style={{
                  position: "absolute",
                  inset: 0,
                  zIndex: 0,
                  backgroundImage: `url(${isDark ? "/images/fond%20graphique/mewtwoo.png?v=2" : "/images/fond%20graphique/mewtwoo_gris.png"})`,
                  backgroundSize: "contain",
                  backgroundRepeat: "no-repeat",
                  backgroundPosition: "center",
                  pointerEvents: "none",
                }}
              />
              <div style={{ position: "relative", zIndex: 1, height: "100%" }}>
              {!premiumLoading &&
              isPremium &&
              validPriceCount < 1 ? (
                <div
                  className="flex h-full w-full items-center justify-center px-4 text-center text-xs"
                  style={{ color: "var(--text-secondary)" }}
                >
                  Données insuffisantes pour afficher l&apos;historique complet
                </div>
              ) : (
              <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={composedChartData}
                margin={{ top: 12, right: 8, left: 0, bottom: 8 }}
              >
                <defs>
                  <linearGradient id="areaGradDetail" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={accentGold} stopOpacity={0.3} />
                    <stop offset="100%" stopColor={accentGold} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="mois_court"
                  type="category"
                  domain={
                    product.category === "Displays" &&
                    !premiumLoading &&
                    isPremium &&
                    chartData.length > 0
                      ? chartData.map((d) => d.mois_court)
                      : undefined
                  }
                  ticks={
                    product.category === "Displays" &&
                    !premiumLoading &&
                    isPremium &&
                    chartData.length > 0
                      ? chartData.map((d) => d.mois_court)
                      : undefined
                  }
                  tick={{ fontSize: 10, fill: "#9CA3AF" }}
                  tickLine={false}
                  axisLine={false}
                  interval={chartData.length > 0 ? xAxisInterval : 1}
                />
                <YAxis
                  tickFormatter={(v) => `${v}€`}
                  tick={{
                    fontSize: 10,
                    fill: "#9CA3AF",
                  }}
                  tickLine={false}
                  axisLine={false}
                  width={32}
                />
                <Tooltip
                  defaultIndex={defaultTooltipIndexForNull}
                  filterNull={false}
                  content={({ active, payload, activeIndex, label }) => {
                    if (!active) return null;
                    const idx =
                      typeof activeIndex === "number"
                        ? activeIndex
                        : typeof activeIndex === "string" && /^\d+$/.test(activeIndex)
                          ? Number.parseInt(activeIndex, 10)
                          : -1;
                    type Row = { mois_label?: string; prix?: number | null };
                    const fromPayload = payload?.[0]?.payload as Row | undefined;
                    const fromChart =
                      idx >= 0 && idx < composedChartData.length ? (composedChartData[idx] as Row) : undefined;
                    const p = fromPayload ?? fromChart;
                    if (!p) return null;
                    const moisLabel =
                      p.mois_label ?? (typeof label === "string" || typeof label === "number" ? String(label) : "");
                    const prixVal = p.prix;
                    const isNullPrix = prixVal === null || prixVal === undefined;
                    return (
                      <div
                        className="rounded-xl px-3 py-2"
                        style={{
                          background: "var(--card-color)",
                          color: accentGold,
                          boxShadow: "0 2px 12px rgba(0,0,0,0.2)",
                        }}
                      >
                        <p className="mb-1.5 text-[10px]">{moisLabel}</p>
                        <p className="text-xs">
                          {isNullPrix ? (
                            <span className={STAT_CARD_VALUE_CLASS}>
                              Données non disponibles pour cette période
                            </span>
                          ) : (
                            <span className={STAT_CARD_VALUE_CLASS}>
                              {!Number.isNaN(Number(prixVal)) ? `${Number(prixVal)} €` : "—"}
                            </span>
                          )}
                        </p>
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
                  dot={(dotProps) => {
                    const { cx, cy, payload } = dotProps as {
                      cx?: number;
                      cy?: number;
                      payload?: { prix?: number | null };
                    };
                    if (cx == null || cy == null || !prixPointIsValid(payload?.prix)) return null;
                    return <circle cx={cx} cy={cy} r={2} fill={accentGold} />;
                  }}
                  activeDot={(dotProps) => {
                    const { cx, cy, payload } = dotProps as {
                      cx?: number;
                      cy?: number;
                      payload?: { prix?: number | null };
                    };
                    if (cx == null || cy == null || !prixPointIsValid(payload?.prix)) return null;
                    return <circle cx={cx} cy={cy} r={4} fill={accentGold} />;
                  }}
                  connectNulls={false}
                />
                {!premiumLoading &&
                  isPremium &&
                  validPriceCount >= 1 &&
                  chartData.length > 0 &&
                  gapBridgeSegments.length > 0 && (
                    <PriceHistoryChartGaps segments={gapBridgeSegments} stroke={accentGold} />
                  )}
              </ComposedChart>
              </ResponsiveContainer>
              )}
              </div>
            </div>
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
                  marginTop: 12,
                  marginLeft: 8,
                  marginRight: 8,
                  width: "calc(100% - 16px)",
                  boxSizing: "border-box",
                }}
              >
                <span>Ajouter à ma collection</span>
              </button>
            )}
            {priceListRows.length > 0 && (
              <div
                className="overflow-hidden text-xs"
                style={{
                  background: "var(--card-color)",
                  border: "1px solid var(--border-color)",
                  borderRadius: 12,
                  padding: 16,
                  marginTop: 12,
                  marginLeft: 8,
                  marginRight: 8,
                  width: "calc(100% - 16px)",
                  boxSizing: "border-box",
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
                          className={`${STAT_CARD_VALUE_CLASS} py-2 pr-3 text-right`}
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
          {!premiumLoading && !isPremium && (
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                height: 350,
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
                    color: "#111827",
                    fontSize: 12,
                    fontWeight: 600,
                    textDecoration: "none",
                  }}
                >
                  S&apos;abonner
                </a>
              </div>
            </div>
          )}
          </div>
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
