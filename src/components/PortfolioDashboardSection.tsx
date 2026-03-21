import { type CSSProperties, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Wallet, BarChart2, Package, TrendingUp, ChevronRight } from "lucide-react";
import { PortfolioCategoryDonut, CATEGORY_DONUT_COLORS } from "./PortfolioCategoryDonut";
import { PortfolioEraDonut, ERA_DONUT_COLORS } from "./PortfolioEraDonut";
import {
  PORTFOLIO_CHART_HEIGHT,
  buildPortfolioChartData,
  computePortfolioStats,
  totalInvestedFromCollection,
  type CollectionLineForChart,
  type SaleLike,
} from "../utils/portfolioChartData";

export type PortfolioSectionMode = "summary" | "chartOnly";

interface PortfolioDashboardSectionProps {
  mode: PortfolioSectionMode;
  collectionLines: CollectionLineForChart[];
  sales: SaleLike[];
  isPremium: boolean | undefined;
  isLoadingSubscription: boolean;
  isLight: boolean;
  isDark: boolean;
  accentGold: string;
  /** Requis si mode === "chartOnly" */
  chartPeriod?: "1an" | "2ans";
  setChartPeriod?: (p: "1an" | "2ans") => void;
  /** Requis si mode === "summary" */
  produitsCount?: number;
  /** Si défini, la carte « Valeur du portefeuille » mène à cette route (ex. /collection). */
  summaryMainCardTo?: string;
}

const DARK_MAIN = "#111111";
const DARK_GRID = "#1a1a1a";
const EMERALD = "#10b981";
const LABEL_GRAY = "#888888";

export function PortfolioDashboardSection({
  mode,
  collectionLines,
  sales,
  isPremium,
  isLoadingSubscription,
  isLight,
  isDark,
  accentGold,
  chartPeriod = "1an",
  setChartPeriod,
  produitsCount = 0,
  summaryMainCardTo,
}: PortfolioDashboardSectionProps) {
  const totalInvesti = totalInvestedFromCollection(collectionLines);
  const chartData = buildPortfolioChartData(collectionLines, chartPeriod, totalInvesti);
  const portfolio = computePortfolioStats(collectionLines, sales);

  const lineMarketColor = isDark ? EMERALD : accentGold;
  const plusPositive = portfolio.plusValueTotale >= 0;

  /** Donuts plus petits sur mobile pour éviter le chevauchement avec le montant. */
  const [donutSize, setDonutSize] = useState(55);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 640px)");
    const sync = () => setDonutSize(mq.matches ? 75 : 55);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const mainCardStyle: CSSProperties = isDark
    ? { background: DARK_MAIN, boxShadow: "none" }
    : {
        background: "var(--card-color)",
        boxShadow: "0 2px 12px rgba(0,0,0,0.15)",
        ...(isLight && { border: "1px solid var(--border-color)" }),
      };

  const statCardStyle: CSSProperties = isDark
    ? { background: DARK_GRID, boxShadow: "none" }
    : {
        background: isLight ? "var(--input-bg)" : "var(--bg-card-elevated)",
        ...(isLight && { border: "1px solid var(--border-color)" }),
      };

  if (mode === "chartOnly") {
    return (
      <section className="rounded-2xl px-2 py-3 overflow-hidden -mx-0" style={isDark ? { background: DARK_MAIN } : mainCardStyle}>
        <div className="mb-2 flex gap-2 px-2">
          <button
            type="button"
            onClick={() => setChartPeriod?.("1an")}
            className="text-xs font-medium transition"
            style={
              chartPeriod === "1an"
                ? {
                    backgroundColor: isDark ? "#ffffff" : accentGold,
                    color: isDark ? "#000000" : "#000",
                    borderRadius: 9999,
                    padding: "4px 16px",
                    fontWeight: 600,
                    border: "none",
                  }
                : {
                    backgroundColor: "transparent",
                    color: isDark ? "#ffffff" : "inherit",
                    borderRadius: 9999,
                    padding: "4px 16px",
                    border: isDark ? "1px solid #333" : "1px solid gray",
                    fontSize: 13,
                  }
            }
          >
            1 an
          </button>
          <button
            type="button"
            onClick={() => setChartPeriod?.("2ans")}
            className="text-xs font-medium transition"
            style={
              chartPeriod === "2ans"
                ? {
                    backgroundColor: isDark ? "#ffffff" : accentGold,
                    color: isDark ? "#000000" : "#000",
                    borderRadius: 9999,
                    padding: "4px 16px",
                    fontWeight: 600,
                    border: "none",
                  }
                : {
                    backgroundColor: "transparent",
                    color: isDark ? "#ffffff" : "inherit",
                    borderRadius: 9999,
                    padding: "4px 16px",
                    border: isDark ? "1px solid #333" : "1px solid gray",
                    fontSize: 13,
                  }
            }
          >
            2 ans
          </button>
        </div>

        <div className="w-full" style={{ minHeight: PORTFOLIO_CHART_HEIGHT, overflow: "hidden" }}>
          {collectionLines.length === 0 && isPremium === true ? (
            <div
              className="relative flex flex-col items-center justify-center rounded-xl py-12 text-center"
              style={{
                height: PORTFOLIO_CHART_HEIGHT,
                background: isDark ? DARK_GRID : "var(--bg-card-elevated)",
                overflow: "hidden",
              }}
            >
              <div
                aria-hidden
                style={{
                  position: "absolute",
                  inset: 0,
                  zIndex: 0,
                  backgroundImage: `url(${isLight ? "/images/fond%20graphique/mewtwoo_gris.png" : "/images/fond%20graphique/mewtwoo.png?v=2"})`,
                  backgroundSize: "contain",
                  backgroundPosition: "center",
                  backgroundRepeat: "no-repeat",
                  opacity: 0.85,
                  pointerEvents: "none",
                }}
              />
              <Link
                to="/ajouter"
                className="absolute right-3 bottom-3 flex h-8 w-8 items-center justify-center rounded-full text-lg font-medium transition hover:opacity-80"
                style={{
                  background: isDark ? "#333" : "var(--border-color)",
                  color: isDark ? "#fff" : "var(--text-secondary)",
                }}
                aria-label="Ajouter un item"
              >
                +
              </Link>
              <p className="text-sm mt-2 relative z-10" style={{ color: isDark ? LABEL_GRAY : "var(--text-secondary)" }}>
                Ajoutez des items pour voir l&apos;évolution
              </p>
            </div>
          ) : (
            <div style={{ position: "relative", background: isDark ? DARK_MAIN : "var(--card-color)" }}>
              <div
                style={{
                  position: "relative",
                  zIndex: 1,
                  ...(isPremium === true
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
                      tick={{ fill: isDark ? LABEL_GRAY : "var(--text-secondary)", fontSize: 10 }}
                      interval={chartPeriod === "1an" ? 1 : 2}
                    />
                    <YAxis tick={{ fill: isDark ? LABEL_GRAY : "var(--text-secondary)", fontSize: 10 }} width={45} />
                    <Tooltip
                      contentStyle={{
                        background: isDark ? DARK_GRID : "var(--card-color)",
                        borderRadius: 8,
                        color: isDark ? "#fff" : "var(--text-primary)",
                        boxShadow: "0 4px 24px rgba(0,0,0,0.25)",
                        border: isDark ? "1px solid #333" : undefined,
                      }}
                      content={({ active, payload, label }) => {
                        if (!active || !payload?.length) return null;
                        const sorted = [...payload].sort((a, b) =>
                          a.dataKey === "valeurMarche" ? -1 : b.dataKey === "valeurMarche" ? 1 : 0
                        );
                        return (
                          <div
                            className="rounded-lg px-3 py-2"
                            style={{
                              background: isDark ? DARK_GRID : "var(--card-color)",
                              color: isDark ? "#fff" : "var(--text-primary)",
                            }}
                          >
                            <p className="text-[10px] mb-1.5" style={{ color: isDark ? LABEL_GRAY : "var(--text-secondary)" }}>
                              {label}
                            </p>
                            {sorted.map((entry) => (
                              <p key={String(entry.dataKey)} className="text-xs" style={{ color: entry.color }}>
                                {entry.dataKey === "investissement" ? "Investi" : "Marché"}:{" "}
                                {typeof entry.value === "number" ? `${entry.value} €` : entry.value}
                              </p>
                            ))}
                          </div>
                        );
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="valeurMarche"
                      name="Marché"
                      stroke={lineMarketColor}
                      strokeWidth={2}
                      dot={false}
                      connectNulls={true}
                    />
                    <Line
                      type="monotone"
                      dataKey="investissement"
                      name="Investi"
                      stroke={isDark ? "#ffffff" : "var(--text-primary)"}
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      dot={false}
                      connectNulls={true}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              {isPremium !== true && !isLoadingSubscription && (
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
                      <svg
                        width="28"
                        height="28"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke={accentGold}
                        strokeWidth="1.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        style={{ filter: "drop-shadow(0 2px 4px rgba(212,167,87,0.4))" }}
                      >
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                      </svg>
                    </div>
                    <p style={{ fontSize: 12, marginBottom: 10, color: "#FFFFFF" }}>
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
          )}
        </div>
      </section>
    );
  }

  /* mode === "summary" — pas de graphique sur l’accueil */
  const leftColumnContent = (
    <>
      <p className="text-xs font-medium mb-1" style={{ color: isDark ? LABEL_GRAY : "var(--text-secondary)" }}>
        Valeur du portefeuille
      </p>
      <p
        className="text-white tabular-nums tracking-tight"
        style={{
          color: isDark ? "#ffffff" : "var(--text-primary)",
          fontFamily: '"Inter", system-ui, sans-serif',
          fontWeight: 800,
          fontSize: "2.5rem",
          lineHeight: 1.1,
        }}
      >
        {portfolio.totalMarche.toLocaleString("fr-FR", {
          style: "currency",
          currency: "EUR",
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}
      </p>
      <div
        className="mt-2 flex flex-wrap items-center gap-1.5 text-sm font-medium"
        style={{ color: isDark ? EMERALD : plusPositive ? "var(--gain-green)" : "var(--loss-red)" }}
      >
        {plusPositive ? (
          <TrendingUp className="shrink-0" size={18} strokeWidth={2.5} aria-hidden />
        ) : (
          <TrendingUp className="shrink-0 rotate-180" size={18} strokeWidth={2.5} aria-hidden />
        )}
        <span>
          {plusPositive ? "+" : ""}
          {portfolio.plusValueTotale.toLocaleString("fr-FR", {
            style: "currency",
            currency: "EUR",
            maximumFractionDigits: 0,
          })}{" "}
          ({plusPositive ? "+" : ""}
          {portfolio.perfGlobale.toFixed(1)}%)
        </span>
      </div>
    </>
  );

  const mainCardShellClassNoLink =
    "flex w-full min-w-0 flex-row flex-nowrap items-center justify-between gap-3 rounded-2xl px-4 py-4 text-left";

  return (
    <section className="space-y-3">
      {summaryMainCardTo ? (
        <div
          className={mainCardShellClassNoLink}
          style={{
            ...mainCardStyle,
            border: isDark ? "none" : undefined,
            color: "inherit",
          }}
        >
          <Link
            to={summaryMainCardTo}
            className="portfolio-summary-card-link min-w-0 flex-1 basis-0 shrink text-left no-underline cursor-pointer pr-1"
            style={{ color: "inherit" }}
            aria-label="Voir le graphique du portefeuille et la collection"
          >
            {leftColumnContent}
          </Link>
          <div className="flex min-w-0 shrink-0 items-center gap-1 sm:gap-2">
            <div
              className="flex shrink-0 flex-col items-end justify-center gap-0.5"
              role="group"
              aria-label="Répartition de la collection par catégorie et par ère"
            >
              <div className="flex flex-row items-center justify-end gap-1 sm:gap-1.5">
                <div className="shrink-0" title="Catégories (ETB, UPC, Displays)">
                  <PortfolioCategoryDonut collectionLines={collectionLines} isDark={isDark} size={donutSize} />
                </div>
                <div className="shrink-0" title="Ères (Méga Évolution, Épée & Bouclier, Écarlate & Violet)">
                  <PortfolioEraDonut collectionLines={collectionLines} isDark={isDark} size={donutSize} />
                </div>
              </div>
              <div
                className="mt-0.5 flex max-w-[min(100vw-8rem,11rem)] flex-col items-end gap-0.5 text-right leading-tight sm:max-w-[200px]"
                style={{
                  fontSize: 10,
                  color: isDark ? LABEL_GRAY : "#6b7280",
                }}
              >
                <div className="flex flex-wrap justify-end gap-x-2 gap-y-0">
                  <span className="inline-flex items-center gap-0.5 whitespace-nowrap">
                    <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: CATEGORY_DONUT_COLORS.ETB }} aria-hidden />
                    ETB
                  </span>
                  <span className="inline-flex items-center gap-0.5 whitespace-nowrap">
                    <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: CATEGORY_DONUT_COLORS.UPC }} aria-hidden />
                    UPC
                  </span>
                  <span className="inline-flex items-center gap-0.5 whitespace-nowrap">
                    <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: CATEGORY_DONUT_COLORS.Displays }} aria-hidden />
                    Displays
                  </span>
                </div>
                <div className="flex flex-wrap justify-end gap-x-2 gap-y-0">
                  <span className="inline-flex items-center gap-0.5 whitespace-nowrap">
                    <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: ERA_DONUT_COLORS["Méga Évolution"] }} aria-hidden />
                    Méga Évo
                  </span>
                  <span className="inline-flex items-center gap-0.5 whitespace-nowrap">
                    <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: ERA_DONUT_COLORS["Épée & Bouclier"] }} aria-hidden />
                    Épée&amp;B
                  </span>
                  <span className="inline-flex items-center gap-0.5 whitespace-nowrap">
                    <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: ERA_DONUT_COLORS["Écarlate & Violet"] }} aria-hidden />
                    Écar&amp;V
                  </span>
                </div>
              </div>
            </div>
            <Link
              to={summaryMainCardTo}
              className="portfolio-summary-card-link flex shrink-0 self-center rounded-lg p-1.5 no-underline cursor-pointer"
              style={{ color: isDark ? LABEL_GRAY : "var(--text-secondary)" }}
              aria-label="Aller à la collection"
            >
              <ChevronRight className="portfolio-summary-card-chevron" size={24} strokeWidth={2} aria-hidden />
            </Link>
          </div>
        </div>
      ) : null}
      {!summaryMainCardTo ? (
        <div
          className={`${mainCardShellClassNoLink} items-stretch`}
          style={{
            ...mainCardStyle,
            border: isDark ? "none" : undefined,
          }}
        >
          <div className="min-w-0 flex-1 text-left">{leftColumnContent}</div>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl px-3 py-3 text-left" style={statCardStyle}>
          <div className="flex items-center gap-2 mb-2" style={{ color: isDark ? LABEL_GRAY : "var(--text-secondary)" }}>
            <Wallet size={16} strokeWidth={2} aria-hidden />
            <span className="text-[11px] font-medium">Investi</span>
          </div>
          <p className="text-sm font-semibold tabular-nums" style={{ color: isDark ? "#ffffff" : "var(--text-primary)" }}>
            {portfolio.totalInvesti.toLocaleString("fr-FR", {
              style: "currency",
              currency: "EUR",
              maximumFractionDigits: 0,
            })}
          </p>
        </div>
        <div className="rounded-2xl px-3 py-3 text-left" style={statCardStyle}>
          <div className="flex items-center gap-2 mb-2" style={{ color: isDark ? LABEL_GRAY : "var(--text-secondary)" }}>
            <BarChart2 size={16} strokeWidth={2} aria-hidden />
            <span className="text-[11px] font-medium">Performance</span>
          </div>
          <p className="text-sm font-semibold tabular-nums" style={{ color: isDark ? EMERALD : portfolio.perfGlobale >= 0 ? "var(--gain-green)" : "var(--loss-red)" }}>
            {portfolio.perfGlobale >= 0 ? "+" : ""}
            {portfolio.perfGlobale.toFixed(1)}%
          </p>
        </div>
        <div className="rounded-2xl px-3 py-3 text-left" style={statCardStyle}>
          <div className="flex items-center gap-2 mb-2" style={{ color: isDark ? LABEL_GRAY : "var(--text-secondary)" }}>
            <Package size={16} strokeWidth={2} aria-hidden />
            <span className="text-[11px] font-medium">Produits</span>
          </div>
          <p className="text-sm font-semibold tabular-nums" style={{ color: isDark ? "#ffffff" : "var(--text-primary)" }}>
            {produitsCount}
          </p>
        </div>
        <div className="rounded-2xl px-3 py-3 text-left" style={statCardStyle}>
          <div className="flex items-center gap-2 mb-2" style={{ color: isDark ? LABEL_GRAY : "var(--text-secondary)" }}>
            <TrendingUp size={16} strokeWidth={2} aria-hidden />
            <span className="text-[11px] font-medium">Plus-value</span>
          </div>
          <p className="text-sm font-semibold tabular-nums" style={{ color: isDark ? EMERALD : portfolio.plusValueTotale >= 0 ? "var(--gain-green)" : "var(--loss-red)" }}>
            {portfolio.plusValueTotale >= 0 ? "+" : ""}
            {portfolio.plusValueTotale.toLocaleString("fr-FR", {
              style: "currency",
              currency: "EUR",
              maximumFractionDigits: 0,
            })}
          </p>
        </div>
        {portfolio.gainRealise !== 0 && (
          <div className="col-span-2 rounded-2xl px-3 py-2" style={statCardStyle}>
            <p className="text-[10px]" style={{ color: isDark ? LABEL_GRAY : "var(--text-secondary)" }}>
              Gain réalisé (ventes)
            </p>
            <p
              className="mt-1 text-sm font-semibold"
              style={{ color: isDark ? EMERALD : portfolio.gainRealise >= 0 ? "var(--gain-green)" : "var(--loss-red)" }}
            >
              {portfolio.gainRealise >= 0 ? "+" : ""}
              {portfolio.gainRealise.toLocaleString("fr-FR", {
                style: "currency",
                currency: "EUR",
                maximumFractionDigits: 0,
              })}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
