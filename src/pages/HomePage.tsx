import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { Category } from "../state/ProductsContext";
import { useCollection } from "../state/CollectionContext";
import { Link, useLocation } from "react-router-dom";
import { ItemIcon } from "../components/ItemIcon";
import { RasterImage } from "../components/RasterImage";
import { etbData } from "../data/etbData";
import { displayData } from "../data/displayData";
import { getPrixMarcheForProduct } from "../utils/prixMarche";
import { useSalesHistory } from "../hooks/useSalesHistory";
import { getEraBadge, getEraNeonBadgeStyle, getEraStyle } from "../utils/eraBadge";
import { formatProductNameWithSetCode, formatReleaseDate, getSetCodeFromProduct } from "../utils/formatProduct";
import { useTheme } from "../state/ThemeContext";
import { useSubscription } from "../state/SubscriptionContext";
import { PortfolioDashboardSection } from "../components/PortfolioDashboardSection";
import { ERA_DONUT_COLORS } from "../components/PortfolioEraDonut";
import { CatalogueStyleSearchBar } from "../components/CatalogueStyleSearchBar";
import { CatalogueSearchResultRow } from "../components/CatalogueSearchResultRow";
import { filterHomeProductsBySearch, sortHomeProductsBySearch } from "../utils/homeProductSearch";
import {
  isKnownProductCardEraLabel,
  productCardEraBadgeClassName,
} from "../utils/productCardEraBadge";
import { STAT_CARD_VALUE_CLASS } from "../constants/statCardValueClass";
const categories: { key: Category; label: string }[] = [
  { key: "Displays", label: "Displays" },
  { key: "ETB", label: "ETB" },
  { key: "UPC", label: "UPC" },
];

/** Filtres d’ère fixes (alignés sur `product.set` / blocs données). */
const HOME_ERA_OPTIONS = ["Méga Évolution", "Écarlate & Violet", "Épée & Bouclier", "Soleil et Lune"] as const;

const TYPE_SELECTED_GLOW: Record<
  "Tous" | Category,
  Pick<CSSProperties, "border" | "boxShadow">
> = {
  Tous: {
    border: "1px solid #ffffff",
    boxShadow: "0 0 4px #ffffff80",
  },
  Displays: {
    border: "1px solid #3B82F6",
    boxShadow: "0 0 4px #3B82F680",
  },
  ETB: {
    border: "1px solid #EF4444",
    boxShadow: "0 0 4px #EF444480",
  },
  UPC: {
    border: "1px solid #F59E0B",
    boxShadow: "0 0 4px #F59E0B80",
  },
};

const TYPE_ROW_DARK_BG = "#111111";

const GENERATION_SELECTED_GLOW: Record<
  (typeof HOME_ERA_OPTIONS)[number],
  Pick<CSSProperties, "border" | "boxShadow">
> = {
  "Méga Évolution": {
    border: "1px solid #F97316",
    boxShadow: "0 0 4px #F9731680",
  },
  "Écarlate & Violet": {
    border: "1px solid #A855F7",
    boxShadow: "0 0 4px #A855F780",
  },
  "Épée & Bouclier": {
    border: "1px solid #22C55E",
    boxShadow: "0 0 4px #22C55E80",
  },
  "Soleil et Lune": {
    border: "1px solid #EAB308",
    boxShadow: "0 0 4px #EAB30880",
  },
};

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
  etbId?: string;
}

/** Prix marché affiché (MOCK eBay si VITE_EBAY_STATUS=MOCK). */
function homeProductMarcheAffiché(p: HomeProduct): number {
  return getPrixMarcheForProduct(
    {
      id: p.id,
      category: p.category,
      etbId: p.etbId,
      currentPrice: p.currentPrice,
      prixMarcheActuel: p.currentPrice,
    },
    etbData
  );
}

export const HomePage = () => {
  const { items: collectionItems } = useCollection();
  const { theme } = useTheme();
  const isLight = theme === "light";
  const isDark = theme === "dark";
  const accentGold = isDark ? "#FBBF24" : "#D4A757";
  const { isPremium, isLoading: isLoadingSubscription } = useSubscription();
  console.log("[RENDER] HomePage", "isPremium:", isPremium, "isLoading:", isLoadingSubscription, new Date().toISOString());
  const { pathname } = useLocation();
  const { sales, refreshSales } = useSalesHistory();
  const [selectedCategory, setSelectedCategory] = useState<Category | "Tous">(
    "Tous"
  );
  /** `null` = « Tous » sur la ligne génération. */
  const [selectedEra, setSelectedEra] = useState<string | null>(null);
  const [pressedFilterKey, setPressedFilterKey] = useState<string | null>(null);
  /** Recherche accueil : input non contrôlé (ref) pour stabilité clavier iOS / PWA ; seul le tableau de résultats est en state. */
  const homeSearchInputRef = useRef<HTMLInputElement>(null);
  const [homeSearchResults, setHomeSearchResults] = useState<HomeProduct[]>([]);
  const [isHomeSearchMode, setIsHomeSearchMode] = useState(false);
  const triggerFilterPress = (key: string) => {
    setPressedFilterKey(key);
    setTimeout(() => setPressedFilterKey(null), 150);
  };

  useEffect(() => {
    if (pathname === "/") {
      refreshSales();
    }
  }, [pathname, refreshSales]);

  useEffect(() => {
    try {
      const returnTo = sessionStorage.getItem("returnTo");
      if (returnTo !== "/") return;
      const filters = sessionStorage.getItem("collectionFilters");
      if (filters && typeof filters === "string") {
        const parsed = JSON.parse(filters) as {
          typeFilter?: Category | "Tous";
          selectedCategory?: Category | "Tous";
          eraFilter?: string | null;
          selectedEra?: string | null;
        };
        const cat = parsed.typeFilter ?? parsed.selectedCategory;
        if (cat) setSelectedCategory(cat);
        const era = parsed.eraFilter ?? parsed.selectedEra;
        if (era !== undefined) {
          const e = era ?? null;
          if (e === null || (HOME_ERA_OPTIONS as readonly string[]).includes(e)) {
            setSelectedEra(e);
          }
        }
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
    if (cat === "Tous") setSelectedEra(null);
  };

  const collectionLines = useMemo(
    () =>
      collectionItems.map((it) => ({
        quantity: it.quantity,
        buyPrice: it.buyPrice,
        product: it.product,
      })),
    [collectionItems]
  );

  const databaseProducts: HomeProduct[] = useMemo(() => {
    const etbProducts: HomeProduct[] = etbData.map((item, index) => {
      const pvcSortie = item.pvcSortie || 0;
      const prixActuel = item.prixActuel || pvcSortie;
      const perfPct = pvcSortie > 0 ? ((prixActuel - pvcSortie) / pvcSortie) * 100 : 0;
      const setLabel = item.series;
      return {
        id: item.id,
        etbId: item.id,
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
          etbId: d.id,
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
        etbId: d.id,
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

  /** Comparaison stricte sur le type Category (évite les bugs de normalisation / regexp). */
  const categoryFiltered = useMemo(() => {
    if (selectedCategory === "Tous") return databaseProducts;
    return databaseProducts.filter((p) => p.category === selectedCategory);
  }, [databaseProducts, selectedCategory]);

  /** Type (ligne 1) + génération (ligne 2, masquée si « Tous ») : ET logique. */
  const filtered = useMemo(() => {
    if (selectedCategory === "Tous" || !selectedEra) return categoryFiltered;
    return categoryFiltered.filter((p) => p.set === selectedEra);
  }, [categoryFiltered, selectedCategory, selectedEra]);

  /** Grille (pas de texte de recherche) : résultat des filtres combinés. */
  const gridProducts = useMemo(() => {
    const base = filtered;
    return sortHomeProductsBySearch(filterHomeProductsBySearch(base, ""), "");
  }, [filtered]);

  const applyHomeSearchFromValue = useCallback(
    (val: string) => {
      const base = databaseProducts;
      const matched = filterHomeProductsBySearch(base, val);
      setHomeSearchResults(sortHomeProductsBySearch(matched, val));
      setIsHomeSearchMode(val.trim() !== "");
    },
    [databaseProducts]
  );

  const handleHomeSearchClear = useCallback(() => {
    const el = homeSearchInputRef.current;
    if (el) el.value = "";
    setHomeSearchResults([]);
    setIsHomeSearchMode(false);
    homeSearchInputRef.current?.focus();
  }, []);

  /** Recalcul si le catalogue change pendant une recherche (filtres ignorés pendant la saisie). */
  useEffect(() => {
    const el = homeSearchInputRef.current;
    if (!el) return;
    const val = el.value;
    if (val.trim() === "") {
      setHomeSearchResults([]);
      setIsHomeSearchMode(false);
      return;
    }
    applyHomeSearchFromValue(val);
  }, [applyHomeSearchFromValue]);

  const EMERALD = "#10b981";
  const LABEL_MUTED = "#888888";

  const filterRow1Base: CSSProperties = {
    padding: "6px 16px",
    fontSize: "13px",
    fontWeight: 500,
    borderRadius: "999px",
    minHeight: "unset",
    height: "auto",
    touchAction: "manipulation",
    cursor: "pointer",
  };
  const filterRow2Base: CSSProperties = {
    padding: "3px 10px",
    fontSize: "11px",
    fontWeight: 500,
    borderRadius: "999px",
    minHeight: "unset",
    height: "auto",
    touchAction: "manipulation",
    cursor: "pointer",
  };
  const typeRowStyle = (key: "Tous" | Category, selected: boolean): CSSProperties => {
    if (isLight) {
      if (selected) {
        return {
          ...filterRow1Base,
          backgroundColor: "#D1D5DB",
          color: "#111827",
          border: "none",
          boxShadow: "none",
        };
      }
      return {
        ...filterRow1Base,
        backgroundColor: "#ffffff",
        color: "#4b5563",
        border: "none",
        boxShadow: "none",
      };
    }
    return selected
      ? {
          ...filterRow1Base,
          backgroundColor: TYPE_ROW_DARK_BG,
          color: "#ffffff",
          ...TYPE_SELECTED_GLOW[key],
        }
      : {
          ...filterRow1Base,
          backgroundColor: TYPE_ROW_DARK_BG,
          color: "#ffffff",
          border: "none",
          boxShadow: "none",
        };
  };

  return (
    <div className="space-y-4 -mx-3">
      <PortfolioDashboardSection
        mode="summary"
        collectionLines={collectionLines}
        sales={sales}
        isPremium={isPremium}
        isLoadingSubscription={isLoadingSubscription}
        isLight={isLight}
        isDark={isDark}
        accentGold={accentGold}
        produitsCount={collectionItems.length}
        summaryMainCardTo="/collection"
      />

      <div className="px-3" style={{ position: "relative", zIndex: 50 }}>
        <CatalogueStyleSearchBar
          uncontrolled
          id="home-collection-search"
          inputKey="home-search-input"
          inputRef={homeSearchInputRef}
          onInputChange={applyHomeSearchFromValue}
          showClearButton={isHomeSearchMode}
          onClear={handleHomeSearchClear}
          placeholder="Rechercher un produit sur l'accueil…"
        />
        {isHomeSearchMode ? (
          <div
            style={{
              position: "absolute",
              top: "100%",
              left: 0,
              right: 0,
              zIndex: 50,
              backgroundColor: "#111",
              borderRadius: "12px",
              maxHeight: "300px",
              overflowY: "auto",
            }}
          >
            {homeSearchResults.length > 0 ? (
              homeSearchResults.map((product, i) => {
                const eraBadge =
                  product.category === "ETB" || product.category === "Displays" || product.category === "UPC"
                    ? getEraBadge(product.id, product.set) ??
                      (product.set ? { label: product.set, ...getEraStyle(product.set) } : null)
                    : null;
                const placeholderBg =
                  (product.category === "Displays" || product.category === "UPC") && eraBadge
                    ? eraBadge.bg
                    : "var(--placeholder-bg)";
                const catForTitle =
                  product.category === "Displays" ? "Displays" : product.category === "UPC" ? "UPC" : "ETB";
                return (
                  <CatalogueSearchResultRow
                    key={`${product.id}-${product.name}`}
                    mode="link"
                    to={`/produit/${product.id}`}
                    onNavigate={() => {
                      sessionStorage.setItem("returnTo", "/");
                      sessionStorage.setItem(
                        "collectionFilters",
                        JSON.stringify({ typeFilter: selectedCategory, eraFilter: selectedEra })
                      );
                    }}
                    accentGold={accentGold}
                    imageUrl={product.imageUrl ?? null}
                    nameForAlt={product.name}
                    isDisplayOrUpc={product.category === "Displays" || product.category === "UPC"}
                    placeholderBg={placeholderBg}
                    eraBadge={eraBadge}
                    title={formatProductNameWithSetCode(product.name, getSetCodeFromProduct(product), catForTitle)}
                    showNewBadge={product.set === "Méga Évolution"}
                    marketPrice={homeProductMarcheAffiché(product)}
                    retailPrice={product.prixAchat}
                    showBottomBorder={i < homeSearchResults.length - 1}
                  />
                );
              })
            ) : homeSearchInputRef.current?.value ? (
              <p style={{ padding: "16px", color: "#888" }}>Aucun résultat pour cette recherche.</p>
            ) : null}
          </div>
        ) : null}
      </div>

      <div>
        <p className="app-heading mb-2 text-xs pl-3" style={{ color: "var(--text-secondary)" }}>
          Catégories
        </p>
        <div className="flex flex-wrap gap-2 pl-3" style={{ overflow: "visible" }}>
          <button
            type="button"
            className={`filter-btn ${pressedFilterKey === "cat-Tous" ? "filter-btn-press" : ""}`}
            onClick={() => {
              triggerFilterPress("cat-Tous");
              handleCategoryChange("Tous");
            }}
            style={typeRowStyle("Tous", selectedCategory === "Tous")}
          >
            Tous
          </button>
          {categories.map((cat) => (
            <button
              type="button"
              key={cat.key}
              className={`filter-btn ${pressedFilterKey === `cat-${cat.key}` ? "filter-btn-press" : ""}`}
              onClick={() => {
                triggerFilterPress(`cat-${cat.key}`);
                handleCategoryChange(cat.key);
              }}
              style={typeRowStyle(cat.key, selectedCategory === cat.key)}
            >
              {cat.label}
            </button>
          ))}
        </div>
        {selectedCategory !== "Tous" && (
          <div
            className="generation-filters mt-1 flex flex-wrap gap-2 pl-3"
            style={{ overflow: "visible" }}
          >
              {HOME_ERA_OPTIONS.map((era) => {
                const isSelected = selectedEra === era;
                return (
                  <button
                    type="button"
                    key={era}
                    className="filter-btn shrink-0"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setSelectedEra((current) => (current === era ? null : era));
                    }}
                    style={
                      isLight
                        ? {
                            ...filterRow2Base,
                            whiteSpace: "nowrap",
                            backgroundColor: ERA_DONUT_COLORS[era],
                            color: "#ffffff",
                            border: isSelected ? "2px solid #111827" : "1px solid transparent",
                            boxShadow: "none",
                          }
                        : {
                            ...filterRow2Base,
                            whiteSpace: "nowrap",
                            backgroundColor: TYPE_ROW_DARK_BG,
                            color: "#ffffff",
                            ...(isSelected
                              ? GENERATION_SELECTED_GLOW[era]
                              : { border: "1px solid transparent", boxShadow: "none" }),
                          }
                    }
                  >
                    {era}
                  </button>
                );
              })}
          </div>
        )}
      </div>

      <section className="space-y-2">
        <div className="grid grid-cols-2 gap-2" style={{ minHeight: "600px" }}>
          {gridProducts.map((product) => {
            const eraBadge = (product.category === "ETB" || product.category === "Displays" || product.category === "UPC") ? (getEraBadge(product.id, product.set) ?? (product.set ? { label: product.set, ...getEraStyle(product.set) } : null)) : null;
            const dateLine =
              (product.category === "ETB" || product.category === "UPC" || product.category === "Displays") && product.dateSortie
                ? formatReleaseDate(product.dateSortie)
                : null;
            return (
              <div
                key={`${product.id}-${product.name}`}
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
                  className="flex flex-col rounded-2xl overflow-hidden transition hover:opacity-95 h-[264px]"
                  style={{
                    background: isDark ? "#111111" : "var(--card-color)",
                    boxShadow: isDark ? "none" : "0 2px 12px rgba(0,0,0,0.12)",
                  }}
                >
                <div
                  className="flex items-center justify-center overflow-hidden shrink-0"
                  style={{
                    width: "100%",
                    height: "160px",
                    background: isDark ? "#141414" : "var(--img-container-bg)",
                    borderRadius: "16px 16px 0 0",
                    willChange: "transform",
                  }}
                >
                  {product.imageUrl ? (
                    <RasterImage
                      src={product.imageUrl}
                      alt={product.name}
                      loading="lazy"
                      width={144}
                      height={140}
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                      }}
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
                </div>
                <div
                  className="flex flex-1 flex-col min-h-0"
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    height: "104px",
                    paddingTop: "6px",
                    paddingLeft: "8px",
                    paddingRight: "8px",
                    paddingBottom: "8px",
                    background: isDark ? "#111111" : undefined,
                  }}
                >
                <div className="shrink-0 flex justify-start items-start self-start w-full min-h-0">
                  {eraBadge ? (
                    <span
                      className={productCardEraBadgeClassName(eraBadge.label)}
                      style={
                        isLight && isKnownProductCardEraLabel(eraBadge.label)
                          ? undefined
                          : getEraNeonBadgeStyle(eraBadge.label)
                      }
                    >
                      {eraBadge.label}
                    </span>
                  ) : (
                    <span
                      className="shrink-0 whitespace-nowrap text-[9px] font-medium uppercase"
                      style={{ background: "rgba(255,255,255,0.12)", color: "var(--text-primary)", padding: "2px 5px", borderRadius: "4px" }}
                    >
                      {product.badge}
                    </span>
                  )}
                </div>
                <p
                  className="text-xs font-semibold shrink-0 line-clamp-1 overflow-hidden text-ellipsis"
                  style={{ marginTop: "6px", color: isDark ? "#ffffff" : "var(--text-primary)" }}
                >
                  {formatProductNameWithSetCode(
                    product.name,
                    getSetCodeFromProduct(product),
                    product.category as "ETB" | "Displays"
                  )}
                </p>
                <div className="mt-1 shrink-0 flex flex-col justify-start">
                  {dateLine && (
                    <p
                      className="shrink-0 tabular-nums"
                      style={{
                        fontSize: "0.75rem",
                        fontWeight: 400,
                        color: isDark ? LABEL_MUTED : "var(--text-secondary)",
                      }}
                    >
                      {dateLine}
                    </p>
                  )}
                </div>
                <div
                  className="flex w-full shrink-0 flex-wrap justify-end items-baseline gap-1.5"
                  style={{ marginTop: "4px" }}
                >
                  <p
                    className={`${STAT_CARD_VALUE_CLASS} truncate max-w-full text-right`}
                    style={{
                      color: isDark ? EMERALD : accentGold,
                      fontSize: "1.1rem",
                      fontWeight: 700,
                    }}
                  >
                    {homeProductMarcheAffiché(product).toLocaleString("fr-FR", {
                      style: "currency",
                      currency: "EUR",
                      maximumFractionDigits: 0,
                    })}
                  </p>
                </div>
                </div>
              </Link>
              </div>
            );
          })}
          {gridProducts.length === 0 && (
            <p
              className="col-span-2 rounded-2xl p-4 text-center text-xs"
              style={{
                background: "var(--card-color)",
                color: "var(--text-secondary)",
                boxShadow: "0 2px 12px rgba(0,0,0,0.12)",
              }}
            >
              {categoryFiltered.length === 0
                ? "Aucun produit dans cette catégorie."
                : "Aucun produit pour cette génération."}
            </p>
          )}
        </div>
      </section>
    </div>
  );
};

