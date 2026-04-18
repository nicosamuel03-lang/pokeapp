import { useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import { useSubscription } from "../state/SubscriptionContext";
import { useTheme } from "../state/ThemeContext";
import { NewsCarousel } from "../components/NewsCarousel";
import { getEraBadge, getEraNeonBadgeStyle } from "../utils/eraBadge";
import { getPerformanceForPeriod } from "../utils/marketPerformance";
import { formatProductNameWithSetCode } from "../utils/formatProduct";
import { displayData } from "../data/displayData";
import { etbData } from "../data/etbData";
import { getPrixMarcheForProduct } from "../utils/prixMarche";
import {
  isKnownProductCardEraLabel,
  productCardEraBadgeClassName,
} from "../utils/productCardEraBadge";
import { STAT_CARD_VALUE_CLASS } from "../constants/statCardValueClass";
import { RasterImage } from "../components/RasterImage";
type MainTab = "etb" | "displays" | "upc";

const TYPE_ROW_DARK_BG = "#111111";

const MARKET_TAB_SELECTED_GLOW: Record<
  MainTab,
  Pick<CSSProperties, "border" | "boxShadow">
> = {
  etb: {
    border: "1px solid #EF4444",
    boxShadow: "0 0 4px #EF444480",
  },
  displays: {
    border: "1px solid #3B82F6",
    boxShadow: "0 0 4px #3B82F680",
  },
  upc: {
    border: "1px solid #F59E0B",
    boxShadow: "0 0 4px #F59E0B80",
  },
};

const marketFilterRowBase: CSSProperties = {
  padding: "6px 16px",
  fontSize: "13px",
  fontWeight: 500,
  borderRadius: "999px",
  minHeight: "unset",
  height: "auto",
  touchAction: "manipulation",
  cursor: "pointer",
};

function marketTabStyle(tab: MainTab, selected: boolean, isLight: boolean): CSSProperties {
  if (isLight) {
    if (selected) {
      return {
        ...marketFilterRowBase,
        backgroundColor: "#D1D5DB",
        color: "#111827",
        border: "none",
        boxShadow: "none",
      };
    }
    return {
      ...marketFilterRowBase,
      backgroundColor: "#ffffff",
      color: "#4b5563",
      border: "none",
      boxShadow: "none",
    };
  }
  return selected
    ? {
        ...marketFilterRowBase,
        backgroundColor: TYPE_ROW_DARK_BG,
        color: "#ffffff",
        ...MARKET_TAB_SELECTED_GLOW[tab],
      }
    : {
        ...marketFilterRowBase,
        backgroundColor: TYPE_ROW_DARK_BG,
        color: "#ffffff",
        border: "none",
        boxShadow: "none",
      };
}

/** Price history shape for getPerformanceForPeriod. */
type HistPoint = { mois?: string; prix?: number | null };

/** Market product - category from display-data.json or etbData. */
interface MarketProduct {
  id: string;
  name: string;
  emoji: string;
  imageUrl?: string | null;
  currentPrice: number;
  dateSortie?: string;
  etbId?: string;
  category: "Displays" | "ETB" | "UPC" | string;
  type?: "Display" | "ETB" | "UPC";
  block?: string;
  prixAchat?: number;
  historique_prix?: HistPoint[];
}

const MEDAL_COLORS: Record<number, string> = {
  1: "#FFD700",
  2: "#C0C0C0",
  3: "#CD7F32",
};

/** Halo néon discret autour des cartes top 3 (or / argent / bronze). */
function top3MedalNeonBoxShadow(rank: number): string {
  if (rank < 1 || rank > 3) return "0 2px 12px rgba(0,0,0,0.12)";
  const c = MEDAL_COLORS[rank];
  return `0 0 6px ${c}99, 0 0 14px ${c}4D, 0 2px 12px rgba(0,0,0,0.15)`;
}

const DEFAULT_PERIOD = "tout" as const;

interface ProductCardProps {
  product: MarketProduct;
  rank: number;
  variant: "top3" | "rest";
}

function ProductCard({ product, rank, variant }: ProductCardProps) {
  const { theme } = useTheme();
  const isLight = theme === "light";
  const accentGold = theme === "dark" ? "#FBBF24" : "#D4A757";
  const rawId = product.etbId ?? product.id.replace(/^display-/, "").replace(/^upc-/, "");
  const eraBadge = getEraBadge(rawId, product.block);
  const displayName = product.name;
  const medalColor = rank <= 3 ? MEDAL_COLORS[rank] : undefined;
  const borderColor = rank <= 3 ? MEDAL_COLORS[rank] : undefined;
  const refPrice = product.prixAchat;
  const displayMarket = getPrixMarcheForProduct(
    {
      id: product.id,
      category: product.category,
      etbId: product.etbId,
      currentPrice: product.currentPrice,
      prixMarcheActuel: product.currentPrice,
      historique_prix: product.historique_prix as { mois?: string; prix: number | null }[],
    },
    etbData
  );
  const cardPerfPct =
    refPrice != null && refPrice > 0 && Number.isFinite(displayMarket)
      ? ((displayMarket - refPrice) / refPrice) * 100
      : null;

  const baseStyle: React.CSSProperties = {
    background: "var(--card-color)",
    boxShadow: "0 2px 12px rgba(0,0,0,0.12)",
    height: "fit-content",
  };

  const cardStyle: React.CSSProperties =
    variant === "top3" && borderColor
      ? {
          ...baseStyle,
          border: `2px solid ${borderColor}`,
          boxShadow: top3MedalNeonBoxShadow(rank),
        }
      : baseStyle;

  const rankColor = medalColor ?? "var(--text-primary)";

  if (variant === "top3") {
    return (
      <Link
        to={`/produit/${product.id}`}
        className="flex rounded-2xl transition hover:opacity-95"
        style={{ width: "100%", margin: 0, padding: "0 4px", ...cardStyle }}
      >
        <div className="flex flex-row items-stretch gap-4 w-full min-w-0">
          <div className="shrink-0 flex items-center justify-center min-w-[2rem]">
            <span
              className={STAT_CARD_VALUE_CLASS}
              style={{
                color: rankColor,
                WebkitFontSmoothing: "antialiased" as const,
              }}
            >
              #{rank}
            </span>
          </div>
          <div
            className="shrink-0 w-24 h-24 rounded-lg overflow-hidden flex items-center justify-center p-2"
            style={{ background: "var(--img-container-bg)" }}
          >
            {product.imageUrl ? (
              <RasterImage
                src={product.imageUrl}
                alt={displayName}
                loading="lazy"
                className="h-full w-full object-contain"
                style={{ objectFit: "contain" }}
              />
            ) : (
              <span className="text-2xl opacity-60">{product.emoji}</span>
            )}
          </div>
          <div className="flex-1 min-w-0 flex flex-col justify-between gap-1 min-h-[96px]">
            <div className="min-w-0" style={{ paddingTop: "12px" }}>
              {eraBadge ? (
                <span
                  className={`inline-block shrink-0 max-w-[120px] truncate rounded-full ${productCardEraBadgeClassName(eraBadge.label)}`}
                  style={{
                    ...(isLight && isKnownProductCardEraLabel(eraBadge.label)
                      ? {}
                      : getEraNeonBadgeStyle(eraBadge.label)),
                    fontSize: "0.65rem",
                  }}
                >
                  {eraBadge.label}
                </span>
              ) : null}
              <p className="text-sm font-medium leading-tight break-words" style={{ color: "var(--text-primary)" }}>
                {displayName}
              </p>
            </div>
            <div className="flex w-full flex-wrap items-baseline justify-end gap-1.5 mt-auto">
              <p
                className="tabular-nums shrink-0 min-w-0 truncate text-right"
                style={{
                  color: accentGold,
                  fontSize: "1.1rem",
                  fontWeight: 700,
                }}
              >
                {displayMarket.toLocaleString("fr-FR", {
                  style: "currency",
                  currency: "EUR",
                  maximumFractionDigits: 0,
                })}
              </p>
              {cardPerfPct != null && Number.isFinite(cardPerfPct) ? (
                <span
                  className="tabular-nums shrink-0"
                  style={{
                    fontSize: "0.8rem",
                    fontWeight: 500,
                    color: cardPerfPct >= 0 ? "var(--gain-green)" : "var(--loss-red)",
                  }}
                >
                  {cardPerfPct >= 0 ? "+" : ""}
                  {cardPerfPct.toFixed(1)}%
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </Link>
    );
  }

  return (
    <Link
      to={`/produit/${product.id}`}
      className="flex flex-row items-stretch gap-3 rounded-xl transition hover:opacity-95"
      style={{ width: "100%", margin: 0, padding: "0 4px", ...cardStyle }}
    >
      <div className="shrink-0 w-8 flex items-center justify-center">
        <span
          className={STAT_CARD_VALUE_CLASS}
          style={{
            color: "var(--text-primary)",
            WebkitFontSmoothing: "antialiased" as const,
          }}
        >
          #{rank}
        </span>
      </div>
      <div
        className="shrink-0 w-14 h-14 self-center rounded-lg overflow-hidden flex items-center justify-center"
        style={{ background: "var(--img-container-bg)" }}
      >
        {product.imageUrl ? (
          <RasterImage
            src={product.imageUrl}
            alt={displayName}
            loading="lazy"
            className="h-full w-full object-contain"
            style={{ objectFit: "contain" }}
          />
        ) : (
          <span className="text-lg opacity-60">{product.emoji}</span>
        )}
      </div>
      <div className="flex-1 min-w-0 flex flex-col justify-between gap-1 min-h-[56px]">
        <div className="min-w-0 flex flex-col gap-0.5">
          {eraBadge ? (
            <span
              className={`inline-block shrink-0 self-start max-w-[100px] truncate rounded-full whitespace-nowrap ${productCardEraBadgeClassName(eraBadge.label)}`}
              style={{
                ...(isLight && isKnownProductCardEraLabel(eraBadge.label)
                  ? {}
                  : getEraNeonBadgeStyle(eraBadge.label)),
                fontSize: "0.6rem",
                padding: "1px 5px",
                marginTop: "8px",
              }}
            >
              {eraBadge.label}
            </span>
          ) : null}
          <p className="text-sm font-medium break-words leading-snug" style={{ color: "var(--text-primary)" }}>
            {displayName}
          </p>
        </div>
        <div className="flex w-full flex-wrap items-baseline justify-end gap-1.5 mt-auto">
          <p
            className="tabular-nums"
            style={{
              color: accentGold,
              fontSize: "1.1rem",
              fontWeight: 700,
            }}
          >
            {displayMarket.toLocaleString("fr-FR", {
              style: "currency",
              currency: "EUR",
              maximumFractionDigits: 0,
            })}
          </p>
          {cardPerfPct != null && Number.isFinite(cardPerfPct) ? (
            <span
              className="tabular-nums shrink-0"
              style={{
                fontSize: "0.8rem",
                fontWeight: 500,
                color: cardPerfPct >= 0 ? "var(--gain-green)" : "var(--loss-red)",
              }}
            >
              {cardPerfPct >= 0 ? "+" : ""}
              {cardPerfPct.toFixed(1)}%
            </span>
          ) : null}
        </div>
      </div>
    </Link>
  );
}

function RankingSection({ products }: { products: MarketProduct[] }) {
  const safeProducts = products;
  const top3 = safeProducts.slice(0, 3);
  const rest = safeProducts.slice(3);

  return (
    <section style={{ width: "100%", padding: 0 }}>
      {top3.length > 0 && (
        <div style={{ width: "100%", padding: 0, display: "flex", flexDirection: "column", gap: 16 }}>
          {top3.map((product, i) => (
            <ProductCard
              key={`top3-${product.id}`}
              product={product}
              rank={i + 1}
              variant="top3"
            />
          ))}
        </div>
      )}

      {rest.length > 0 && (
        <div style={{ width: "100%", padding: 0, display: "flex", flexDirection: "column", gap: 8, marginTop: top3.length > 0 ? 16 : 0 }}>
          {rest.map((product, i) => (
            <ProductCard
              key={product.id}
              product={product}
              rank={top3.length + i + 1}
              variant="rest"
            />
          ))}
        </div>
      )}

      {top3.length === 0 && rest.length === 0 && (
        <p className="text-xs" style={{ color: "var(--text-secondary)", padding: "16px 0", margin: 0 }}>Aucun produit dans cette catégorie.</p>
      )}
    </section>
  );
}

function sortByGainers<T>(items: T[], getPerf: (item: T) => { percent: number }): T[] {
  const copy = [...items];
  return copy.sort((a, b) => getPerf(b).percent - getPerf(a).percent);
}

/** Map display-data.json items to product shape. Uses category from JSON. */
function mapDisplayToProduct(d: (typeof displayData)[number]): MarketProduct {
  const cat = (d.category ?? "Displays") as "Displays" | "ETB" | "UPC";
  const fullName = formatProductNameWithSetCode(d.name, d.id, cat);
  const isUPC = cat === "UPC";
  return {
    id: isUPC ? `upc-${d.id}` : `display-${d.id}`,
    name: fullName,
    emoji: isUPC ? "🎁" : "📦",
    category: cat,
    type: isUPC ? "UPC" : "Display",
    block: d.block,
    currentPrice: d.currentMarketPrice,
    prixAchat: d.msrp,
    imageUrl: d.imageUrl,
    dateSortie: d.releaseDate,
    etbId: d.id,
    historique_prix: d.historique_prix as HistPoint[],
  };
}

/** Map etbData items to product shape. Full name: "ETB [Nom] ([Code])". */
function mapEtbToProduct(item: (typeof etbData)[number]): MarketProduct {
  const block = item.bloc === "eb" ? "Épée & Bouclier" : item.bloc === "ev" ? "Écarlate & Violet" : "Méga Évolution";
  const fullName = formatProductNameWithSetCode(`ETB ${item.nom}`, item.id, "ETB");
  return {
    id: item.id,
    name: fullName,
    emoji: "🎴",
    category: "ETB",
    type: "ETB",
    block,
    currentPrice: item.prixActuel,
    prixAchat: item.pvcSortie,
    imageUrl: item.imageUrl,
    dateSortie: item.dateSortie,
    etbId: item.id,
    historique_prix: item.historique_prix as HistPoint[],
  };
}

export const MarketPage = () => {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const isLight = theme === "light";
  const accentGold = isDark ? "#FBBF24" : "#D4A757";
  const { isPremium, isLoading: premiumLoading } = useSubscription();
  console.log("[RENDER] MarketPage", "isPremium:", isPremium, "isLoading:", premiumLoading, new Date().toISOString());
  const [mainTab, setMainTab] = useState<MainTab>("etb");
  const [pressedFilterKey, setPressedFilterKey] = useState<string | null>(null);
  const triggerFilterPress = (key: string) => {
    setPressedFilterKey(key);
    setTimeout(() => setPressedFilterKey(null), 150);
  };

  const filteredProducts = useMemo(() => {
    if (mainTab === "displays") {
      return displayData
        .filter((d) => String(d.category ?? "").trim() === "Displays")
        .map(mapDisplayToProduct);
    }
    if (mainTab === "etb") {
      const fromDisplay = displayData
        .filter((d) => String(d.category ?? "").trim() === "ETB")
        .map(mapDisplayToProduct);
      return [...fromDisplay, ...etbData.map(mapEtbToProduct)];
    }
    if (mainTab === "upc") {
      return displayData
        .filter((d) => String(d.category ?? "").trim() === "UPC")
        .map(mapDisplayToProduct);
    }
    return [];
  }, [mainTab]);

  const productsToShow = useMemo(
    () =>
      sortByGainers(filteredProducts, (p) =>
        getPerformanceForPeriod(p, DEFAULT_PERIOD)
      ),
    [filteredProducts]
  );

  return (
    <div style={{ position: "relative", minHeight: "100%", ...(!premiumLoading && !isPremium ? { overflow: "hidden", maxHeight: "100vh" } : {}) }}>
      <div
        className="space-y-6"
        style={
          isPremium
            ? {}
            : {
                filter: "blur(20px) brightness(0.4)",
                pointerEvents: "none",
                userSelect: "none",
              }
        }
      >
        <p className="text-xs font-medium mb-1 pl-1" style={{ color: isDark ? "#888888" : "var(--text-secondary)" }}>
          Marché des cartes
        </p>

        <div className="-mx-4 w-[calc(100%+2rem)] max-w-none px-0">
          <NewsCarousel />
        </div>

        <div style={{ marginTop: 24, display: "flex", justifyContent: "center" }}>
          <h2
            style={{
              fontFamily: "'Inter', 'Arial Black', sans-serif",
              fontWeight: 900,
              fontSize: "clamp(22px, 6vw, 36px)",
              letterSpacing: "2px",
              WebkitTextStroke: "0.75px rgba(251, 191, 36, 0.9)",
              ...(isLight
                ? {
                    WebkitTextFillColor: "#ffffff",
                    color: "#ffffff",
                  }
                : {
                    WebkitTextFillColor: "#000",
                    color: "#000",
                  }),
              textShadow:
                "0 0 8px rgba(251, 191, 36, 0.55), 0 0 18px rgba(251, 191, 36, 0.4), 0 0 32px rgba(251, 191, 36, 0.28), 0 0 48px rgba(251, 191, 36, 0.15)",
              paintOrder: "stroke fill",
              margin: "16px 0",
              textAlign: "center",
            }}
          >
            TOP DE LA SEMAINE !
          </h2>
        </div>

        <div style={{ marginTop: 18, display: "flex", justifyContent: "center", flexWrap: "wrap", gap: 8 }}>
          <button
            type="button"
            className={`filter-btn ${pressedFilterKey === "tab-etb" ? "filter-btn-press" : ""}`}
            onClick={() => {
              triggerFilterPress("tab-etb");
              setMainTab("etb");
            }}
            style={marketTabStyle("etb", mainTab === "etb", isLight)}
          >
            ETB
          </button>
          <button
            type="button"
            className={`filter-btn ${pressedFilterKey === "tab-displays" ? "filter-btn-press" : ""}`}
            onClick={() => {
              triggerFilterPress("tab-displays");
              setMainTab("displays");
            }}
            style={marketTabStyle("displays", mainTab === "displays", isLight)}
          >
            Displays
          </button>
          <button
            type="button"
            className={`filter-btn ${pressedFilterKey === "tab-upc" ? "filter-btn-press" : ""}`}
            onClick={() => {
              triggerFilterPress("tab-upc");
              setMainTab("upc");
            }}
            style={marketTabStyle("upc", mainTab === "upc", isLight)}
          >
            UPC
          </button>
        </div>

        <div className="space-y-4 -mx-3" style={{ marginTop: 18 }}>
          <RankingSection key={mainTab} products={productsToShow} />
        </div>
      </div>

      {!premiumLoading && !isPremium && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "none",
            zIndex: 10,
          }}
        >
          <div
            style={{
              pointerEvents: "auto",
              textAlign: "center",
              padding: "20px 24px",
              borderRadius: 20,
              background: "rgba(0,0,0,0.75)",
              color: "var(--text-primary)",
              maxWidth: 280,
              boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
            }}
          >
            <div style={{ marginBottom: 10 }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={accentGold} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" style={{ filter: "drop-shadow(0 2px 4px rgba(212,167,87,0.4))" }}>
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>
            <p
              style={{
                fontSize: 13,
                marginBottom: 14,
                color: "#FFFFFF",
                lineHeight: 1.35,
              }}
            >
              Fonctionnalité réservée aux membres Boss Access
            </p>
            <Link
              to="/premium"
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
            </Link>
          </div>
        </div>
      )}
    </div>
  );
};
