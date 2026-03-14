import { useEffect, useMemo, useState } from "react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Category } from "../state/ProductsContext";
import { useCollection } from "../state/CollectionContext";
import { Link, useLocation } from "react-router-dom";
import { ItemIcon } from "../components/ItemIcon";
import { etbData } from "../data/etbData";
import { displayData } from "../data/displayData";
import { getPrixMarcheForProduct } from "../utils/prixMarche";
import { useSalesHistory } from "../hooks/useSalesHistory";
import { getEraBadge, getEraStyle } from "../utils/eraBadge";
import { formatProductNameWithSetCode, formatReleaseDate, getSetCodeFromProduct } from "../utils/formatProduct";
import { useTheme } from "../state/ThemeContext";
import { usePremium } from "../hooks/usePremium";
type HistPrix = { mois: string; prix: number | null }[] | undefined;

function getLastNonNullPrice(hist: HistPrix): number {
  if (!hist?.length) return 0;
  for (let i = hist.length - 1; i >= 0; i--) {
    const p = hist[i].prix;
    if (p != null && !Number.isNaN(p)) return p;
  }
  return 0;
}

function getPriceAtMonthCarryForward(hist: HistPrix, monthKey: string): number {
  if (!hist?.length) return 0;
  let last = 0;
  for (const point of hist) {
    if (point.mois <= monthKey && point.prix != null && !Number.isNaN(point.prix)) last = point.prix;
    if (point.mois === monthKey) return point.prix != null && !Number.isNaN(point.prix) ? point.prix : last;
  }
  return last;
}

function getHistoriquePrix(item: { product: { id: string; etbId?: string; historique_prix?: HistPrix } }): HistPrix {
  if (item.product.historique_prix?.length) return item.product.historique_prix;
  const etb = getEtbForItem(item);
  return etb?.historique_prix;
}

function getEtbForItem(item: { product: { id: string; etbId?: string } }): (typeof etbData)[number] | undefined {
  return item.product.etbId
    ? etbData.find((e) => e.id === item.product.etbId)
    : etbData.find((e) => e.id === item.product.id || item.product.id.startsWith(e.id));
}

/** Mois de sortie (YYYY-MM) pour filtrer les données avant release. ETB: dateSortie DD/MM/YYYY, Display: releaseDate YYYY-MM. */
function getReleaseMonthKeyForItem(item: { product: { id: string; etbId?: string; category?: string } }): string | null {
  const etb = getEtbForItem(item);
  if (etb?.dateSortie) {
    const parts = String(etb.dateSortie).trim().split("/");
    if (parts.length === 3) {
      const [, m, y] = parts;
      const month = String(m ?? "").padStart(2, "0");
      const year = String(y ?? "").trim();
      if (month && year) return `${year}-${month}`;
    }
  }
  const displayId = item.product.id.replace(/^display-/, "").replace(/^upc-/, "");
  const display = displayData.find((d) => d.id === displayId || d.id === item.product.etbId);
  if (display?.releaseDate) {
    const d = display.releaseDate;
    return d.length >= 7 ? d.slice(0, 7) : null;
  }
  return null;
}

/** Prix pour un mois donné : 2024 → historique_prix_2024, 2025 → historique_prix_2025, 2026 → historique_prix. */
function getPriceAtMonthForItem(
  item: { product: { id: string; etbId?: string; historique_prix?: HistPrix } },
  moisKey: string
): number {
  const etb = getEtbForItem(item);
  const hist =
    moisKey.startsWith("2024-")
      ? etb?.historique_prix_2024
      : moisKey.startsWith("2025-")
        ? etb?.historique_prix_2025
        : getHistoriquePrix(item);
  let price = getPriceAtMonthCarryForward(hist, moisKey);
  if (price === 0 && !hist?.length) {
    price = getPrixMarcheForProduct(item.product, etbData);
  }
  return price;
}

const categories: { key: Category; label: string }[] = [
  { key: "Displays", label: "Displays" },
  { key: "ETB", label: "ETB" },
  { key: "UPC", label: "UPC" },
];

interface HomeProduct {
  id: string;
  name: string;
  emoji: string;
  category: Category;
  set: string;
  dateSortie?: string;
  imageUrl?: string | null;
  currentPrice: number;
  prixAchat: number;
  change30dPercent: number;
  badge: string;
}

export const HomePage = () => {
  const { items: collectionItems } = useCollection();
  const { theme } = useTheme();
  const isLight = theme === "light";
  const { isPremium, userProfile, refetchPremium } = usePremium();
  const { pathname } = useLocation();
  const { sales, refreshSales } = useSalesHistory();
  const [selectedCategory, setSelectedCategory] = useState<Category | "Tous">(
    "Tous"
  );
  const [selectedEra, setSelectedEra] = useState<string | null>(null);
  const [chartPeriod, setChartPeriod] = useState<"1an" | "2ans">("1an");

  useEffect(() => {
    if (pathname === "/") {
      refreshSales();
    }
  }, [pathname, refreshSales]);

  useEffect(() => {
    if (pathname === "/") refetchPremium();
  }, [pathname, refetchPremium]);

  useEffect(() => {
    try {
      const returnTo = sessionStorage.getItem("returnTo");
      if (returnTo !== "/") return;
      const filters = sessionStorage.getItem("collectionFilters");
      if (filters && typeof filters === "string") {
        const parsed = JSON.parse(filters) as {
          typeFilter?: Category | "Tous";
          eraFilter?: string | null;
          selectedCategory?: Category | "Tous";
          selectedEra?: string | null;
        };
        const cat = parsed.typeFilter ?? parsed.selectedCategory;
        const era = parsed.eraFilter ?? parsed.selectedEra;
        if (cat) setSelectedCategory(cat);
        if (era !== undefined) setSelectedEra(era ?? null);
      }
    } catch {
      /* ignore parse errors */
    } finally {
      sessionStorage.removeItem("collectionFilters");
      sessionStorage.removeItem("returnTo");
    }
  }, []);

  const handleCategoryChange = (cat: Category | "Tous") => {
    setSelectedCategory(cat);
    if (cat !== "ETB" && cat !== "Displays" && cat !== "UPC") setSelectedEra(null);
  };

  const PORTFOLIO_CHART_HEIGHT = 300;

  /* 1 an = Fév 2025 → Fév 2026 (13 points). 2 ans = Fév 2024 → Fév 2026 (25 points). */
  const MOIS_KEYS_1AN = [
    "2025-02", "2025-03", "2025-04", "2025-05", "2025-06", "2025-07", "2025-08", "2025-09", "2025-10", "2025-11", "2025-12",
    "2026-01", "2026-02",
  ];
  const MOIS_LABELS_1AN = ["Fév 25", "Mar 25", "Avr 25", "Mai 25", "Juin 25", "Juil 25", "Août 25", "Sept 25", "Oct 25", "Nov 25", "Déc 25", "Jan 26", "Fév 26"];
  const MOIS_KEYS_2ANS = [
    "2024-02", "2024-03", "2024-04", "2024-05", "2024-06", "2024-07", "2024-08", "2024-09", "2024-10", "2024-11", "2024-12",
    "2025-01", "2025-02", "2025-03", "2025-04", "2025-05", "2025-06", "2025-07", "2025-08", "2025-09", "2025-10", "2025-11", "2025-12",
    "2026-01", "2026-02",
  ];
  const MOIS_LABELS_2ANS = [
    "Fév 24", "Mar 24", "Avr 24", "Mai 24", "Juin 24", "Juil 24", "Août 24", "Sept 24", "Oct 24", "Nov 24", "Déc 24",
    "Jan 25", "Fév 25", "Mar 25", "Avr 25", "Mai 25", "Juin 25", "Juil 25", "Août 25", "Sept 25", "Oct 25", "Nov 25", "Déc 25",
    "Jan 26", "Fév 26",
  ];

  const totalInvesti = collectionItems.reduce((sum, item) => {
    return sum + (Number(item.buyPrice ?? item.product.prixAchat ?? 0) * Number(item.quantity));
  }, 0);

  const totalMarche = collectionItems.reduce(
    (sum, item) =>
      sum + getPrixMarcheForProduct(item.product, etbData) * Number(item.quantity),
    0
  );

  const chartData = useMemo(() => {
    const keys = chartPeriod === "1an" ? MOIS_KEYS_1AN : MOIS_KEYS_2ANS;
    const labels = chartPeriod === "1an" ? [...MOIS_LABELS_1AN] : MOIS_LABELS_2ANS;
    return keys.map((moisKey, index) => {
      let sum = 0;
      collectionItems.forEach((item) => {
        const releaseMonth = getReleaseMonthKeyForItem(item);
        if (releaseMonth && moisKey < releaseMonth) {
          return;
        }
        sum += getPriceAtMonthForItem(item, moisKey) * Number(item.quantity);
      });
      const valeurMarche = Math.round(sum * 100) / 100;
      return {
        mois: labels[index],
        investissement: totalInvesti,
        valeurMarche,
      };
    });
  }, [chartPeriod, collectionItems, totalInvesti]);

  const portfolio = useMemo(() => {
    let totalInvestiP = 0;
    let totalMarcheP = 0;
    collectionItems.forEach((item) => {
      const qty = Number(item.quantity);
      const prixAchat = item.buyPrice ?? item.product.prixAchat ?? 0;
      totalInvestiP += prixAchat * qty;
      totalMarcheP += getPrixMarcheForProduct(item.product, etbData) * qty;
    });
    const plusValueLatente = totalMarcheP - totalInvestiP;
    const gainRealise = sales.reduce((sum, r) => sum + (r.profit ?? 0), 0);
    const plusValueTotale = plusValueLatente + gainRealise;
    const perfGlobale = totalInvestiP > 0 ? (plusValueTotale / totalInvestiP) * 100 : 0;
    return {
      totalInvesti: totalInvestiP,
      totalMarche: totalMarcheP,
      plusValueLatente,
      gainRealise,
      plusValueTotale,
      perfGlobale,
    };
  }, [collectionItems, sales]);

  const databaseProducts: HomeProduct[] = useMemo(() => {
    const etbProducts: HomeProduct[] = etbData.map((item, index) => {
      const pvcSortie = item.pvcSortie || 0;
      const prixActuel = item.prixActuel || pvcSortie;
      const perfPct = pvcSortie > 0 ? ((prixActuel - pvcSortie) / pvcSortie) * 100 : 0;
      const setLabel =
        item.bloc === "eb"
          ? "Épée & Bouclier"
          : item.bloc === "ev"
          ? "Écarlate & Violet"
          : "Méga Évolution";
      return {
        id: item.id,
        name: `ETB ${item.nom}`,
        emoji: "🎴",
        category: "ETB",
        set: setLabel,
        dateSortie: item.dateSortie,
        imageUrl: item.imageUrl,
        currentPrice: prixActuel,
        prixAchat: pvcSortie,
        change30dPercent: perfPct,
        badge: item.statut,
      };
    });

    const displayProducts: HomeProduct[] = displayData
      .filter((d) => d.category === "Displays")
      .map((d) => {
        let imageUrl = d.imageUrl;
        if (imageUrl && !imageUrl.startsWith("/images/displays/") && (imageUrl.includes("https://") || imageUrl.includes("http://"))) {
          imageUrl = imageUrl.replace(/^\/images\/pokedata\//, "");
        }
        return {
          id: `display-${d.id}`,
          name: d.name,
          emoji: "📦",
          category: "Displays",
          set: d.block,
          dateSortie: d.releaseDate,
          imageUrl,
          currentPrice: d.currentMarketPrice,
          prixAchat: d.msrp,
          change30dPercent: d.msrp > 0 ? ((d.currentMarketPrice - d.msrp) / d.msrp) * 100 : 0,
          badge: d.block,
        };
      });

    const upcProducts: HomeProduct[] = displayData
      .filter((d) => d.category === "UPC")
      .map((d) => ({
        id: `upc-${d.id}`,
        name: d.name,
        emoji: "🎁",
        category: "UPC",
        set: d.block,
        dateSortie: d.releaseDate,
        imageUrl: d.imageUrl,
        currentPrice: d.currentMarketPrice,
        prixAchat: d.msrp,
        change30dPercent: d.msrp > 0 ? ((d.currentMarketPrice - d.msrp) / d.msrp) * 100 : 0,
        badge: d.block,
      }));

    const combined = [...etbProducts, ...displayProducts, ...upcProducts];
    const seen = new Set<string>();
    const deduped = combined.filter((p) => {
      const key = `${p.id}|${p.name}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    /** Parse dateSortie (DD/MM/YYYY or YYYY-MM) to YYYY-MM for sorting. */
    const parseSortKey = (d: string | undefined): string => {
      if (!d || !d.trim()) return "0000-00";
      const s = d.trim();
      const parts = s.split("/");
      if (parts.length === 3) {
        const [, mm, yyyy] = parts;
        return `${yyyy ?? "0000"}-${String(mm ?? "01").padStart(2, "0")}`;
      }
      if (/^\d{4}-\d{2}/.test(s)) return s.slice(0, 7);
      return "0000-00";
    };

    return [...deduped].sort((a, b) => {
      const keyA = parseSortKey(a.dateSortie);
      const keyB = parseSortKey(b.dateSortie);
      return keyB.localeCompare(keyA);
    });
  }, []);

  useEffect(() => {
    const dbCategories = Array.from(
      new Set(databaseProducts.map((p) => String(p.category)))
    );
    const collectionCategories = Array.from(
      new Set(collectionItems.map((it) => String(it.product.category)))
    );
    // eslint-disable-next-line no-console
    console.log("[HomePage] database product categories:", dbCategories);
    // eslint-disable-next-line no-console
    console.log("[HomePage] collection product categories:", collectionCategories);
  }, [databaseProducts, collectionItems]);

  const normalizeCategory = (value: string): string =>
    value.trim().toLowerCase().replace(/s\b/, ""); // ex: Displays → display

  const categoryFiltered = useMemo(() => {
    if (selectedCategory === "Tous") return databaseProducts;
    const target = normalizeCategory(selectedCategory);
    return databaseProducts.filter(
      (p) => normalizeCategory(String(p.category)) === target
    );
  }, [databaseProducts, selectedCategory]);

  const hasEraSubFilter = selectedCategory === "ETB" || selectedCategory === "Displays" || selectedCategory === "UPC";

  const eras = useMemo(() => {
    if (!hasEraSubFilter) return [];
    const sets = new Set<string>();
    categoryFiltered.forEach((p) => {
      if ((p.category === "ETB" || p.category === "Displays" || p.category === "UPC") && p.set) sets.add(p.set);
    });
    return Array.from(sets).sort();
  }, [hasEraSubFilter, categoryFiltered]);

  const filtered = useMemo(() => {
    if (!hasEraSubFilter || !selectedEra) return categoryFiltered;
    return categoryFiltered.filter((p) => p.set === selectedEra);
  }, [categoryFiltered, hasEraSubFilter, selectedEra]);

  return (
    <div className="space-y-4">
      {/* Carte Portefeuille global */}
      <section
        className="rounded-2xl px-4 py-3"
        style={{
          background: "var(--card-color)",
          boxShadow: "0 2px 12px rgba(0,0,0,0.15)",
          ...(isLight && { border: "1px solid var(--border-color)", padding: 16, borderRadius: 12 }),
        }}
      >
        <div className="mb-2 flex items-center justify-between">
          <div>
            <p className="title-section" style={{ color: "var(--text-primary)" }}>
              Portefeuille global
            </p>
            <p className="text-[10px]" style={{ color: "var(--text-secondary)" }}>
              Valeur de votre collection
            </p>
          </div>
          <div
            className="rounded-full px-3 py-1 text-[11px]"
            style={{ background: "var(--bg-card-elevated)", color: "var(--text-secondary)" }}
          >
            {collectionItems.length} item{collectionItems.length !== 1 ? "s" : ""}
          </div>
        </div>

        <div className="mb-2 flex gap-2">
          <button
            type="button"
            onClick={() => setChartPeriod("1an")}
            style={chartPeriod === "1an" ? { backgroundColor: '#D4A757', color: 'black', borderRadius: '999px', padding: '4px 16px', fontWeight: 600, fontSize: 13 } : { backgroundColor: 'transparent', color: 'inherit', borderRadius: '999px', padding: '4px 16px', border: '1px solid gray', fontSize: 13 }}
          >
            1 an
          </button>
          <button
            type="button"
            onClick={() => setChartPeriod("2ans")}
            style={chartPeriod === "2ans" ? { backgroundColor: '#D4A757', color: 'black', borderRadius: '999px', padding: '4px 16px', fontWeight: 600, fontSize: 13 } : { backgroundColor: 'transparent', color: 'inherit', borderRadius: '999px', padding: '4px 16px', border: '1px solid gray', fontSize: 13 }}
          >
            2 ans
          </button>
        </div>

        <div className="w-full" style={{ minHeight: PORTFOLIO_CHART_HEIGHT, overflow: "hidden" }}>
          {collectionItems.length === 0 ? (
            <div
              className="relative flex flex-col items-center justify-center rounded-xl py-12 text-center"
              style={{
                height: PORTFOLIO_CHART_HEIGHT,
                background: "var(--bg-card-elevated)",
                overflow: "hidden",
              }}
            >
              {/* Mewtwo prominent in center when chart is empty (no items in collection) */}
              <div
                aria-hidden
                style={{
                  position: "absolute",
                  inset: 0,
                  zIndex: 0,
                  backgroundImage: `url(${isLight ? "/images/fond%20graphique/mewtwoo_gris.png" : "/images/fond%20graphique/mewtwoo.png"})`,
                  backgroundSize: "contain",
                  backgroundPosition: "center",
                  backgroundRepeat: "no-repeat",
                  opacity: 0.85,
                  pointerEvents: "none",
                }}
              />
              {/* Ghost watermarks: Charizard, Celebi, Arceus */}
              <div
                aria-hidden
                style={{
                  position: "absolute",
                  top: "8%",
                  left: "5%",
                  width: "28%",
                  height: "40%",
                  backgroundImage: "url(/images/hero/watermarks/charizard.png)",
                  backgroundSize: "contain",
                  backgroundPosition: "center",
                  backgroundRepeat: "no-repeat",
                  opacity: 0.1,
                  pointerEvents: "none",
                }}
              />
              <div
                aria-hidden
                style={{
                  position: "absolute",
                  top: "12%",
                  right: "8%",
                  width: "22%",
                  height: "35%",
                  backgroundImage: "url(/images/hero/watermarks/celebi.png)",
                  backgroundSize: "contain",
                  backgroundPosition: "center",
                  backgroundRepeat: "no-repeat",
                  opacity: 0.1,
                  pointerEvents: "none",
                }}
              />
              <div
                aria-hidden
                style={{
                  position: "absolute",
                  bottom: "15%",
                  left: "10%",
                  width: "25%",
                  height: "38%",
                  backgroundImage: "url(/images/hero/watermarks/arceus.png)",
                  backgroundSize: "contain",
                  backgroundPosition: "center",
                  backgroundRepeat: "no-repeat",
                  opacity: 0.1,
                  pointerEvents: "none",
                }}
              />
              <Link
                to="/ajouter"
                className="absolute right-3 bottom-3 flex h-8 w-8 items-center justify-center rounded-full text-lg font-medium transition hover:opacity-80"
                style={{
                  background: "var(--border-color)",
                  color: "var(--text-secondary)",
                }}
                aria-label="Ajouter un item"
              >
                +
              </Link>
              <p className="text-sm mt-2 relative z-10" style={{ color: "var(--text-secondary)" }}>
                Ajoutez des items pour voir l&apos;évolution
              </p>
            </div>
          ) : (
            <div style={{ position: "relative", background: "var(--card-color)" }}>
              {/* Mewtwo hidden when chart has data; only shown when empty (see empty state below) */}
              <div
                aria-hidden
                style={{
                  position: "absolute",
                  inset: 0,
                  zIndex: 0,
                  backgroundImage: `url(${isLight ? "/images/fond%20graphique/mewtwoo_gris.png" : "/images/fond%20graphique/mewtwoo.png"})`,
                  backgroundSize: "contain",
                  backgroundPosition: "center",
                  backgroundRepeat: "no-repeat",
                  opacity: 0,
                  pointerEvents: "none",
                  visibility: "hidden",
                }}
              />
              {/* Chart layer: all data and lines on top */}
              <div
                style={{
                  position: "relative",
                  zIndex: 1,
                  ...(userProfile?.is_premium ||
                  (typeof window !== "undefined" &&
                    window.localStorage.getItem("force_premium") === "true")
                    ? {}
                    : {
                        filter: "blur(12px) brightness(0.6)",
                        pointerEvents: "none",
                        userSelect: "none",
                      }),
                }}
              >
                <ResponsiveContainer width="100%" height={PORTFOLIO_CHART_HEIGHT}>
                  <LineChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <XAxis
                      dataKey="mois"
                      tick={{ fill: "var(--text-secondary)", fontSize: 10 }}
                      interval={chartPeriod === "1an" ? 1 : 2}
                    />
                    <YAxis tick={{ fill: "var(--text-secondary)", fontSize: 10 }} width={45} />
                    <Tooltip
                      contentStyle={{ background: "var(--card-color)", borderRadius: 8, color: "var(--text-primary)", boxShadow: "0 4px 24px rgba(0,0,0,0.25)" }}
                      content={({ active, payload, label }) => {
                        if (!active || !payload?.length) return null;
                        const sorted = [...payload].sort((a, b) => (a.dataKey === "valeurMarche" ? -1 : b.dataKey === "valeurMarche" ? 1 : 0));
                        return (
                          <div className="rounded-lg px-3 py-2" style={{ background: "var(--card-color)", color: "var(--text-primary)" }}>
                            <p className="text-[10px] mb-1.5" style={{ color: "var(--text-secondary)" }}>{label}</p>
                            {sorted.map((entry) => (
                              <p key={String(entry.dataKey)} className="text-xs" style={{ color: entry.color }}>
                                {entry.dataKey === "investissement" ? "Investi" : "Marché"}: {typeof entry.value === "number" ? `${entry.value} €` : entry.value}
                              </p>
                            ))}
                          </div>
                        );
                      }}
                    />
                    <Line type="monotone" dataKey="valeurMarche" name="Marché" stroke="#D4A757" strokeWidth={2} dot={false} connectNulls={true} />
                    <Line type="monotone" dataKey="investissement" name="Investi" stroke="var(--text-primary)" strokeWidth={2} strokeDasharray="5 5" dot={false} connectNulls={true} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              {!(
                userProfile?.is_premium ||
                (typeof window !== "undefined" &&
                  window.localStorage.getItem("force_premium") === "true")
              ) && (
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
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
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#D4A757" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" style={{ filter: "drop-shadow(0 2px 4px rgba(212,167,87,0.4))" }}>
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
                        background: "#D4A757",
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
          )}
        </div>

        {/* Quatre blocs synthèse — rectangles gris distincts */}
        <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
          <div
            className="rounded-2xl px-3 py-2"
            style={{
              background: isLight ? "var(--input-bg)" : "var(--bg-card-elevated)",
              ...(isLight && { border: "1px solid var(--border-color)" }),
            }}
          >
            <p className="text-[10px]" style={{ color: "var(--text-secondary)" }}>Total investi</p>
            <p className="mt-1 text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
              {portfolio.totalInvesti.toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 })}
            </p>
          </div>
          <div
            className="rounded-2xl px-3 py-2"
            style={{
              background: isLight ? "var(--input-bg)" : "var(--bg-card-elevated)",
              ...(isLight && { border: "1px solid var(--border-color)" }),
            }}
          >
            <p className="text-[10px]" style={{ color: "var(--text-secondary)" }}>Valeur marché</p>
            <p className="mt-1 text-sm font-semibold" style={{ color: "var(--accent-yellow)" }}>
              {portfolio.totalMarche.toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 })}
            </p>
          </div>
          <div
            className="rounded-2xl px-3 py-2"
            style={{
              background: isLight ? "var(--input-bg)" : "var(--bg-card-elevated)",
              ...(isLight && { border: "1px solid var(--border-color)" }),
            }}
          >
            <p className="text-[10px]" style={{ color: "var(--text-secondary)" }}>Plus-value totale</p>
            <p className="mt-1 text-sm font-semibold" style={{ color: portfolio.plusValueTotale >= 0 ? "var(--gain-green)" : "var(--loss-red)" }}>
              {portfolio.plusValueTotale >= 0 ? "+" : ""}
              {portfolio.plusValueTotale.toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 })}
            </p>
          </div>
          <div
            className="rounded-2xl px-3 py-2"
            style={{
              background: isLight ? "var(--input-bg)" : "var(--bg-card-elevated)",
              ...(isLight && { border: "1px solid var(--border-color)" }),
            }}
          >
            <p className="text-[10px]" style={{ color: "var(--text-secondary)" }}>Performance globale</p>
            <p className="mt-1 text-sm font-semibold" style={{ color: portfolio.perfGlobale >= 0 ? "var(--gain-green)" : "var(--loss-red)" }}>
              {portfolio.perfGlobale >= 0 ? "+" : ""}
              {portfolio.perfGlobale.toFixed(1)}%
            </p>
          </div>
          {portfolio.gainRealise !== 0 && (
            <div
              className="col-span-2 rounded-2xl px-3 py-2"
              style={{
                background: isLight ? "var(--input-bg)" : "var(--bg-card-elevated)",
                ...(isLight && { border: "1px solid var(--border-color)" }),
              }}
            >
              <p className="text-[10px]" style={{ color: "var(--text-secondary)" }}>Gain réalisé (ventes)</p>
              <p className="mt-1 text-sm font-semibold" style={{ color: portfolio.gainRealise >= 0 ? "var(--gain-green)" : "var(--loss-red)" }}>
                {portfolio.gainRealise >= 0 ? "+" : ""}
                {portfolio.gainRealise.toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 })}
              </p>
            </div>
          )}
        </div>
      </section>

      <div>
        <p className="app-heading mb-2 text-xs" style={{ color: "var(--text-secondary)" }}>
          Catégories
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => handleCategoryChange("Tous")}
            style={selectedCategory === "Tous" ? { backgroundColor: '#D4A757', color: 'black', borderRadius: '999px', padding: '2px 12px', fontWeight: 600, fontSize: 13 } : { backgroundColor: 'transparent', color: 'inherit', borderRadius: '999px', padding: '2px 12px', border: '1px solid gray', fontSize: 13 }}
          >
            Tous
          </button>
          {categories.map((cat) => (
            <button
              key={cat.key}
              onClick={() => handleCategoryChange(cat.key)}
              style={selectedCategory === cat.key ? { backgroundColor: '#D4A757', color: 'black', borderRadius: '999px', padding: '2px 12px', fontWeight: 600, fontSize: 13 } : { backgroundColor: 'transparent', color: 'inherit', borderRadius: '999px', padding: '2px 12px', border: '1px solid gray', fontSize: 13 }}
            >
              {cat.label}
            </button>
          ))}
        </div>
        {hasEraSubFilter && eras.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            <button
              onClick={() => setSelectedEra(null)}
              className="rounded-full font-bold transition shrink-0"
              style={{
                fontSize: "11px",
                padding: "4px 8px",
                whiteSpace: "nowrap",
                color: "var(--text-primary)",
                background: selectedEra === null ? "var(--bg-card-elevated)" : "var(--card-color)",
                border: selectedEra === null ? "2px solid var(--text-primary)" : "2px solid transparent",
              }}
            >
              Tous
            </button>
            {eras.map((era) => {
              const isSelected = selectedEra === era;
              const { bg, color } = getEraStyle(era);
              return (
                <button
                  key={era}
                  onClick={() => setSelectedEra(era)}
                  className="rounded-full font-medium transition shrink-0"
                  style={{
                    fontSize: "10px",
                    padding: "2px 6px",
                    whiteSpace: "nowrap",
                    color,
                    background: bg,
                    border: isSelected ? "2px solid var(--text-primary)" : "2px solid transparent",
                  }}
                >
                  {era}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <section className="space-y-2">
        <h2 className="title-section" style={{ color: "var(--text-primary)" }}>
          Produits ({filtered.length})
        </h2>
        <div className="grid grid-cols-2 gap-3">
          {categoryFiltered.map((product) => {
            const isVisible = !hasEraSubFilter || !selectedEra || product.set === selectedEra;
            const perfPct = product.change30dPercent;
            const isUp = perfPct >= 0;
            const eraBadge = (product.category === "ETB" || product.category === "Displays" || product.category === "UPC") ? (getEraBadge(product.id, product.set) ?? (product.set ? { label: product.set, ...getEraStyle(product.set) } : null)) : null;
            return (
              <div
                key={`${product.id}-${product.name}`}
                style={{ display: isVisible ? "block" : "none" }}
              >
                <Link
                  to={`/produit/${product.id}`}
                  onClick={() => {
                    sessionStorage.setItem("returnTo", "/");
                    sessionStorage.setItem(
                      "collectionFilters",
                      JSON.stringify({ typeFilter: selectedCategory, eraFilter: selectedEra })
                    );
                  }}
                  className="flex flex-col rounded-2xl overflow-hidden transition hover:opacity-95 h-[255px]"
                  style={{ background: "var(--card-color)", boxShadow: "0 2px 12px rgba(0,0,0,0.12)" }}
                >
                <div
                  className="relative flex items-center justify-center overflow-hidden shrink-0"
                  style={{
                    width: "100%",
                    height: "160px",
                    background: "var(--img-container-bg)",
                    borderRadius: "12px 12px 0 0",
                    willChange: "transform",
                  }}
                >
                  {product.imageUrl ? (
                    <img
                      src={product.imageUrl}
                      alt={product.name}
                      loading="eager"
                      width={144}
                      height={140}
                      onError={(e) => { e.currentTarget.style.display = "none"; }}
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "contain",
                        padding: "8px",
                        boxSizing: "border-box",
                      }}
                    />
                  ) : (
                    <ItemIcon
                      imageUrl={null}
                      emoji={product.emoji}
                      name={product.name}
                      size={64}
                      frame="none"
                      className="opacity-60"
                    />
                  )}
                  {eraBadge ? (
                    <span
                      className="absolute right-[6px] top-[6px] shrink-0 whitespace-nowrap text-[9px] font-medium"
                      style={{
                        background: eraBadge.bg,
                        color: eraBadge.color,
                        padding: "2px 5px",
                        borderRadius: "4px",
                      }}
                    >
                      {eraBadge.label}
                    </span>
                  ) : (
                    <span
                      className="absolute right-[6px] top-[6px] shrink-0 whitespace-nowrap text-[9px] font-medium uppercase"
                      style={{ background: "rgba(255,255,255,0.12)", color: "var(--text-primary)", padding: "2px 5px", borderRadius: "4px" }}
                    >
                      {product.badge}
                    </span>
                  )}
                </div>
                <div
                  className="flex flex-1 flex-col min-h-0 p-3"
                  style={{ display: "flex", flexDirection: "column", height: "95px" }}
                >
                <p className="app-heading text-xs shrink-0 line-clamp-2" style={{ color: "var(--text-primary)" }}>
                  {formatProductNameWithSetCode(
                    product.name,
                    getSetCodeFromProduct(product),
                    product.category as "ETB" | "Displays"
                  )}
                </p>
                <div className="mt-1 space-y-1 flex-1 min-h-0 overflow-hidden">
                  {(product.category === "ETB" || product.category === "UPC") && product.dateSortie && (
                    <p className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
                      {formatReleaseDate(product.dateSortie)}
                    </p>
                  )}
                  {product.category === "Displays" && product.dateSortie && (
                    <p className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
                      {formatReleaseDate(product.dateSortie)}
                    </p>
                  )}
                </div>
                <div
                  className="mt-auto flex justify-between items-center shrink-0"
                >
                  <p className="text-sm font-semibold" style={{ color: "var(--accent-yellow)" }}>
                    {product.currentPrice.toLocaleString("fr-FR", {
                      style: "currency",
                      currency: "EUR",
                      maximumFractionDigits: 0,
                    })}
                  </p>
                  <p
                    className="text-[11px] font-medium"
                    style={{ color: isUp ? "var(--gain-green)" : "var(--loss-red)" }}
                  >
                    {isUp ? "+" : ""}
                    {perfPct.toFixed(1)}%
                  </p>
                </div>
                </div>
              </Link>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <p
              className="col-span-2 rounded-2xl p-4 text-center text-xs"
              style={{
                background: "var(--card-color)",
                color: "var(--text-secondary)",
                boxShadow: "0 2px 12px rgba(0,0,0,0.12)",
              }}
            >
              Aucun produit dans cette catégorie.
            </p>
          )}
        </div>
      </section>
    </div>
  );
};

