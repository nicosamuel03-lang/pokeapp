import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { useSubscription } from "../state/SubscriptionContext";
import { PortfolioDashboardSection } from "../components/PortfolioDashboardSection";
import { CatalogueStyleSearchBar } from "../components/CatalogueStyleSearchBar";
import { CatalogueSearchResultRow } from "../components/CatalogueSearchResultRow";
import { filterHomeProductsBySearch, sortHomeProductsBySearch } from "../utils/homeProductSearch";
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
  etbId?: string;
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
      const setLabel =
        item.bloc === "eb"
          ? "Épée & Bouclier"
          : item.bloc === "ev"
          ? "Écarlate & Violet"
          : "Méga Évolution";
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

  /** Grille (pas de texte de recherche) : même jeu que filtre catégorie / ère uniquement. */
  const gridProducts = useMemo(() => {
    const base = filtered ?? [];
    return sortHomeProductsBySearch(filterHomeProductsBySearch(base, ""), "");
  }, [filtered]);

  const applyHomeSearchFromValue = useCallback(
    (val: string) => {
      const base = filtered ?? [];
      const matched = filterHomeProductsBySearch(base, val);
      setHomeSearchResults(sortHomeProductsBySearch(matched, val));
      setIsHomeSearchMode(val.trim() !== "");
    },
    [filtered]
  );

  const handleHomeSearchClear = useCallback(() => {
    const el = homeSearchInputRef.current;
    if (el) el.value = "";
    setHomeSearchResults([]);
    setIsHomeSearchMode(false);
    homeSearchInputRef.current?.focus();
  }, []);

  /** Si le filtre catégorie / ère change pendant que du texte est saisi, recalculer les résultats. */
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
  }, [filtered, applyHomeSearchFromValue]);

  const EMERALD = "#10b981";
  const LABEL_MUTED = "#888888";

  const filterChipActive = isDark
    ? { backgroundColor: "#ffffff", color: "#000000", borderRadius: "999px", padding: "2px 12px", fontWeight: 600, fontSize: 13, border: "none" as const }
    : { backgroundColor: accentGold, color: "black", borderRadius: "999px", padding: "2px 12px", fontWeight: 600, fontSize: 13 };
  const filterChipInactive = isDark
    ? { backgroundColor: "transparent", color: "#ffffff", borderRadius: "999px", padding: "2px 12px", border: "1px solid #444444", fontSize: 13 }
    : { backgroundColor: "transparent", color: "inherit", borderRadius: "999px", padding: "2px 12px", border: "1px solid gray", fontSize: 13 };

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
                    marketPrice={product.currentPrice}
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
        <div className="flex flex-wrap gap-2 pl-3">
          <button
            type="button"
            className={`filter-btn ${pressedFilterKey === "cat-Tous" ? "filter-btn-press" : ""}`}
            onPointerDown={() => triggerFilterPress("cat-Tous")}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleCategoryChange("Tous");
            }}
            style={selectedCategory === "Tous" ? filterChipActive : filterChipInactive}
          >
            Tous
          </button>
          {categories.map((cat) => (
            <button
              type="button"
              key={cat.key}
              className={`filter-btn ${pressedFilterKey === `cat-${cat.key}` ? "filter-btn-press" : ""}`}
              onPointerDown={() => triggerFilterPress(`cat-${cat.key}`)}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleCategoryChange(cat.key);
              }}
              style={selectedCategory === cat.key ? filterChipActive : filterChipInactive}
            >
              {cat.label}
            </button>
          ))}
        </div>
        {hasEraSubFilter && eras.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5 pl-3">
            <button
              type="button"
              className={`filter-btn rounded-full font-bold shrink-0 ${pressedFilterKey === "era-null" ? "filter-btn-press" : ""}`}
              onPointerDown={() => triggerFilterPress("era-null")}
              onClick={() => setSelectedEra(null)}
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
                  type="button"
                  key={era}
                  className={`filter-btn rounded-full font-medium shrink-0 ${pressedFilterKey === `era-${era}` ? "filter-btn-press" : ""}`}
                  onPointerDown={() => triggerFilterPress(`era-${era}`)}
                  onClick={() => setSelectedEra(era)}
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
        <div className="grid grid-cols-2 gap-2">
          {gridProducts.map((product) => {
            const perfPct = product.change30dPercent;
            const isUp = perfPct >= 0;
            const eraBadge = (product.category === "ETB" || product.category === "Displays" || product.category === "UPC") ? (getEraBadge(product.id, product.set) ?? (product.set ? { label: product.set, ...getEraStyle(product.set) } : null)) : null;
            const categoryPillLabel = eraBadge?.label ?? product.set ?? product.badge;
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
                  className="flex flex-col rounded-2xl overflow-hidden transition hover:opacity-95 h-[255px]"
                  style={{
                    background: isDark ? "#111111" : "var(--card-color)",
                    boxShadow: isDark ? "none" : "0 2px 12px rgba(0,0,0,0.12)",
                  }}
                >
                <div
                  className="relative flex items-center justify-center overflow-hidden shrink-0"
                  style={{
                    width: "100%",
                    height: "160px",
                    background: isDark ? "#141414" : "var(--img-container-bg)",
                    borderRadius: "16px 16px 0 0",
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
                  {isDark ? (
                    <span
                      className="absolute right-[6px] top-[6px] shrink-0 max-w-[calc(100%-12px)] truncate text-[9px] font-semibold"
                      style={{
                        background: EMERALD,
                        color: "#0a0a0a",
                        padding: "3px 8px",
                        borderRadius: 9999,
                      }}
                    >
                      {categoryPillLabel}
                    </span>
                  ) : eraBadge ? (
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
                  style={{ display: "flex", flexDirection: "column", height: "95px", background: isDark ? "#111111" : undefined }}
                >
                <p
                  className="text-xs font-semibold shrink-0 line-clamp-1 overflow-hidden text-ellipsis"
                  style={{ color: isDark ? "#ffffff" : "var(--text-primary)", fontFamily: '"Inter", system-ui, sans-serif' }}
                >
                  {formatProductNameWithSetCode(
                    product.name,
                    getSetCodeFromProduct(product),
                    product.category as "ETB" | "Displays"
                  )}
                </p>
                <div className="mt-1 flex-1 min-h-0 overflow-hidden">
                  {dateLine && (
                    <p className="text-[11px]" style={{ color: isDark ? LABEL_MUTED : "var(--text-secondary)" }}>
                      {dateLine}
                    </p>
                  )}
                </div>
                <div className="mt-auto flex justify-between items-baseline gap-2 shrink-0">
                  <p
                    className="text-sm font-semibold tabular-nums truncate min-w-0"
                    style={{ color: isDark ? EMERALD : accentGold }}
                  >
                    {product.currentPrice.toLocaleString("fr-FR", {
                      style: "currency",
                      currency: "EUR",
                      maximumFractionDigits: 0,
                    })}
                  </p>
                  <p
                    className="text-[11px] font-semibold tabular-nums shrink-0"
                    style={{ color: isDark ? EMERALD : isUp ? "var(--gain-green)" : "var(--loss-red)" }}
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
          {gridProducts.length === 0 && (
            <p
              className="col-span-2 rounded-2xl p-4 text-center text-xs"
              style={{
                background: "var(--card-color)",
                color: "var(--text-secondary)",
                boxShadow: "0 2px 12px rgba(0,0,0,0.12)",
              }}
            >
              {filtered.length === 0
                ? "Aucun produit dans cette catégorie."
                : "Aucun résultat pour cette recherche."}
            </p>
          )}
        </div>
      </section>
    </div>
  );
};

