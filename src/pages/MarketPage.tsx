import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { TrendingUp } from "lucide-react";
import { getEraBadge } from "../utils/eraBadge";
import { getPerformanceForPeriod } from "../utils/marketPerformance";
import { formatProductNameWithSetCode } from "../utils/formatProduct";
import { displayData } from "../data/displayData";
import { etbData } from "../data/etbData";


type MainTab = "etb" | "displays" | "upc";

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

const DEFAULT_PERIOD = "tout" as const;

interface ProductCardProps {
  product: MarketProduct;
  rank: number;
  perf: { percent: number };
  variant: "top3" | "rest";
}

function ProductCard({ product, rank, perf, variant }: ProductCardProps) {
  const isUp = perf.percent >= 0;
  const rawId = product.etbId ?? product.id.replace(/^display-/, "").replace(/^upc-/, "");
  const eraBadge = getEraBadge(rawId, product.block);
  const displayName = product.name;
  const medalColor = rank <= 3 ? MEDAL_COLORS[rank] : undefined;
  const borderColor = rank <= 3 ? MEDAL_COLORS[rank] : undefined;

  const baseStyle: React.CSSProperties = {
    background: "var(--card-color)",
    boxShadow: "0 2px 12px rgba(0,0,0,0.12)",
    height: "fit-content",
  };

  const cardStyle: React.CSSProperties =
    variant === "top3" && borderColor
    ? { ...baseStyle, border: `2px solid ${borderColor}`, boxShadow: "0 2px 12px rgba(0,0,0,0.12)" }
      : baseStyle;

  const rankStyle: React.CSSProperties = medalColor
    ? { color: medalColor, fontWeight: 800 }
    : { color: "var(--text-primary)", fontWeight: 800 };

  if (variant === "top3") {
    return (
      <Link
        to={`/produit/${product.id}`}
        className="flex rounded-2xl p-5 transition hover:opacity-95 w-full"
        style={cardStyle}
      >
        <div className="flex flex-row items-center gap-4 w-full min-w-0">
          <span
            className="shrink-0 text-base font-extrabold flex items-center justify-center min-w-[2rem]"
            style={{ ...rankStyle, WebkitFontSmoothing: "antialiased" as const }}
          >
            #{rank}
          </span>
          <div
            className="shrink-0 w-24 h-24 rounded-lg overflow-hidden flex items-center justify-center p-2"
            style={{ background: "var(--img-container-bg)" }}
          >
            {product.imageUrl ? (
              <img
                src={product.imageUrl}
                alt={displayName}
                className="w-full h-full object-contain"
                style={{ objectFit: "contain" }}
              />
            ) : (
              <span className="text-2xl opacity-60">{product.emoji}</span>
            )}
          </div>
          <div className="flex-1 min-w-0 flex flex-col justify-between gap-1">
            <div>
              <p className="text-sm font-medium leading-tight break-words" style={{ color: "var(--text-primary)" }}>
                {displayName}
              </p>
              {eraBadge && (
                <span
                  className="inline-block mt-1 shrink-0 whitespace-nowrap font-medium rounded"
                  style={{
                    fontSize: "9px",
                    padding: "2px 4px",
                    background: eraBadge.bg,
                    color: eraBadge.color,
                  }}
                >
                  {eraBadge.label}
                </span>
              )}
            </div>
            <div className="flex items-center justify-between gap-2 mt-1">
              <p className="text-sm font-semibold shrink-0" style={{ color: "var(--accent-yellow)" }}>
                {product.currentPrice.toLocaleString("fr-FR", {
                  style: "currency",
                  currency: "EUR",
                  maximumFractionDigits: 0,
                })}
              </p>
              <span className="text-xs font-semibold shrink-0" style={{ color: isUp ? "var(--gain-green)" : "var(--loss-red)" }}>
                {isUp ? "▲" : "▼"} {perf.percent.toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
      </Link>
    );
  }

  return (
    <Link
      to={`/produit/${product.id}`}
      className="flex flex-row items-center gap-3 w-full rounded-xl py-3 px-4 transition hover:opacity-95"
      style={cardStyle}
    >
      <span
        className="shrink-0 text-sm font-extrabold w-8 flex items-center justify-center"
        style={{ color: "var(--text-primary)", WebkitFontSmoothing: "antialiased" as const }}
      >
        #{rank}
      </span>
      <div
        className="shrink-0 w-14 h-14 rounded-lg overflow-hidden flex items-center justify-center"
        style={{ background: "var(--img-container-bg)" }}
      >
        {product.imageUrl ? (
          <img src={product.imageUrl} alt={displayName} className="w-full h-full object-contain" style={{ objectFit: "contain" }} />
        ) : (
          <span className="text-lg opacity-60">{product.emoji}</span>
        )}
      </div>
      <div className="flex-1 min-w-0 flex flex-col gap-0.5 justify-center">
        <p className="text-sm font-medium break-words leading-snug" style={{ color: "var(--text-primary)" }}>{displayName}</p>
        {eraBadge && (
          <span
            className="inline-block shrink-0 whitespace-nowrap font-medium rounded w-fit"
            style={{
              fontSize: "9px",
              padding: "2px 4px",
              background: eraBadge.bg,
              color: eraBadge.color,
            }}
          >
            {eraBadge.label}
          </span>
        )}
      </div>
      <div className="shrink-0 flex flex-col items-end gap-0.5">
        <p className="text-sm font-semibold" style={{ color: "var(--accent-yellow)" }}>
          {product.currentPrice.toLocaleString("fr-FR", {
            style: "currency",
            currency: "EUR",
            maximumFractionDigits: 0,
          })}
        </p>
        <span className="text-[10px] font-semibold" style={{ color: isUp ? "var(--gain-green)" : "var(--loss-red)" }}>
          {isUp ? "▲" : "▼"} {perf.percent.toFixed(1)}%
        </span>
      </div>
    </Link>
  );
}

function RankingSection({
  title,
  products,
}: {
  title: string;
  products: MarketProduct[];
}) {
  const safeProducts = products;
  const top3 = safeProducts.slice(0, 3);
  const rest = safeProducts.slice(3);

  return (
    <section className="space-y-4">
      <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{title}</h3>

      {top3.length > 0 && (
        <div className="flex flex-col gap-4">
          {top3.map((product, i) => (
  <ProductCard
    product={product}
    rank={i + 1}
    perf={getPerformanceForPeriod(product, DEFAULT_PERIOD)}
    variant="top3"
  />
))}
        </div>
      )}

      {rest.length > 0 && (
        <div className="flex flex-col gap-2">
          {rest.map((product, i) => (
            <ProductCard
              key={product.id}
              product={product}
              rank={top3.length + i + 1}
              perf={getPerformanceForPeriod(product, DEFAULT_PERIOD)}
              variant="rest"
            />
          ))}
        </div>
      )}

      {top3.length === 0 && rest.length === 0 && (
        <p className="text-xs py-4" style={{ color: "var(--text-secondary)" }}>Aucun produit dans cette catégorie.</p>
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
  const [mainTab, setMainTab] = useState<MainTab>("etb");

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

  const sectionTitle = mainTab === "etb" ? "ETB" : mainTab === "upc" ? "UPC" : "Displays";

  return (
    <div className="space-y-6">
      <h2 className="app-heading text-sm" style={{ color: "var(--text-primary)" }}>Marché des cartes</h2>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setMainTab("etb")}
          style={mainTab === "etb" ? { backgroundColor: '#D4A757', color: 'black', borderRadius: '999px', padding: '2px 12px', fontWeight: 600, fontSize: 13 } : { backgroundColor: 'transparent', color: 'inherit', borderRadius: '999px', padding: '2px 12px', border: '1px solid gray', fontSize: 13 }}
        >
          ETB
        </button>
        <button
          type="button"
          onClick={() => setMainTab("displays")}
          style={mainTab === "displays" ? { backgroundColor: '#D4A757', color: 'black', borderRadius: '999px', padding: '2px 12px', fontWeight: 600, fontSize: 13 } : { backgroundColor: 'transparent', color: 'inherit', borderRadius: '999px', padding: '2px 12px', border: '1px solid gray', fontSize: 13 }}
        >
          Displays
        </button>
        <button
          type="button"
          onClick={() => setMainTab("upc")}
          style={mainTab === "upc" ? { backgroundColor: '#D4A757', color: 'black', borderRadius: '999px', padding: '2px 12px', fontWeight: 600, fontSize: 13 } : { backgroundColor: 'transparent', color: 'inherit', borderRadius: '999px', padding: '2px 12px', border: '1px solid gray', fontSize: 13 }}
        >
          UPC
        </button>
      </div>

      <div className="pt-4 space-y-6">
        <div className="flex justify-center">
          <div
            className="flex items-center justify-center gap-2 rounded-full px-6 py-3 w-fit"
            style={{
              background: "linear-gradient(135deg, #D4A757 0%, #B18A4A 100%)",
              color: "#FFFFFF",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              boxShadow: "0 2px 4px rgba(212, 167, 87, 0.2)",
              overflow: "hidden",
              isolation: "isolate",
              contain: "paint",
              transform: "translateZ(0)",
            }}
          >
            <TrendingUp size={18} strokeWidth={2.5} className="shrink-0" style={{ color: "#FFFFFF" }} />
            <span>Top du mois de Mars 2026 !</span>
          </div>
        </div>
        <RankingSection key={mainTab} title={sectionTitle} products={productsToShow} />
      </div>
    </div>
  );
};
