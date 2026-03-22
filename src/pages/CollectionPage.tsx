import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useCollection } from "../state/CollectionContext";
import { useSubscription } from "../state/SubscriptionContext";
import { useSalesHistory } from "../hooks/useSalesHistory";
import { getPrixMarcheForProduct } from "../utils/prixMarche";
import { etbData } from "../data/etbData";
import { displayData } from "../data/displayData";
import { ItemIcon } from "../components/ItemIcon";
import { getEraBadge, getEraNeonBadgeStyle } from "../utils/eraBadge";
import { formatProductNameWithSetCode, getSetCodeFromProduct } from "../utils/formatProduct";
import { useTheme } from "../state/ThemeContext";
import { PortfolioDashboardSection } from "../components/PortfolioDashboardSection";

const COLLECTION_FILTERS_KEY = "collectionFilters";
const RETURN_TO_KEY = "returnTo";

type CategoryFilter = "Tous" | "Displays" | "ETB" | "UPC";

const HOME_ERA_OPTIONS = ["Méga Évolution", "Écarlate & Violet", "Épée & Bouclier"] as const;

const TYPE_SELECTED_GLOW: Record<
  CategoryFilter,
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
};

function formatPurchaseDate(iso?: string): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d ?? ""}/${m ?? ""}/${y ?? ""}`;
}

function getProductImageUrl(product: {
  id: string;
  etbId?: string;
  category?: string;
  imageUrl?: string | null;
}): string | null {
  // 1. Toujours privilégier l'image du produit lui-même (issue du catalogue ETB/Displays/UPC)
  if (product.imageUrl) {
    return product.imageUrl;
  }

  // UPC : priorité displayData (UPC items) — par id upc-* ou par etbId quand category UPC
  const upcId = product.id.startsWith("upc-") ? product.id.replace(/^upc-/, "") : (product.category === "UPC" && product.etbId ? product.etbId : null);
  if (upcId) {
    const upc = displayData.find((d) => d.category === "UPC" && d.id === upcId);
    return upc?.imageUrl ?? product.imageUrl ?? null;
  }

  // Priorité à l'ETB explicitement liée
  if (product.etbId) {
    const etb = etbData.find((e) => e.id === product.etbId);
    if (etb?.imageUrl) return etb.imageUrl;
  }

  // Sinon, on tente un match direct sur l'id exact
  const etb = etbData.find((e) => e.id === product.id);
  if (etb?.imageUrl) return etb.imageUrl;

  return product.imageUrl ?? null;
}

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const FREE_COLLECTION_LIMIT = 5;

export const CollectionPage = () => {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const isLight = theme === "light";
  const isDark = theme === "dark";
  const accentGold = isDark ? "#FBBF24" : "#D4A757";
  const { isPremium, isLoading: premiumLoading } = useSubscription();
  console.log("[RENDER] CollectionPage", "isPremium:", isPremium, "isLoading:", premiumLoading, new Date().toISOString());
  const { items, removeFromCollection, updateCollectionItem } = useCollection();
  const { pathname } = useLocation();
  const { sales, refreshSales } = useSalesHistory();
  const [selectedCategory, setSelectedCategory] = useState<CategoryFilter>("Tous");
  const [selectedEra, setSelectedEra] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [editPriceInput, setEditPriceInput] = useState<string>("");
  const [editDateInput, setEditDateInput] = useState<string>("");
  const [editQuantityInput, setEditQuantityInput] = useState<string>("");
  const [editQuantityWarning, setEditQuantityWarning] = useState<string | null>(null);
  const [chartPeriod, setChartPeriod] = useState<"1an" | "2ans">("1an");
  const [pressedFilterKey, setPressedFilterKey] = useState<string | null>(null);
  const triggerFilterPress = (key: string) => {
    setPressedFilterKey(key);
    setTimeout(() => setPressedFilterKey(null), 150);
  };

  useEffect(() => {
    if (pathname === "/collection") {
      refreshSales();
    }
  }, [pathname, refreshSales]);

  useEffect(() => {
    try {
      const returnTo = sessionStorage.getItem(RETURN_TO_KEY);
      if (returnTo !== "/collection") return;
      const filters = sessionStorage.getItem(COLLECTION_FILTERS_KEY);
      if (filters && typeof filters === "string") {
        const parsed = JSON.parse(filters) as {
          typeFilter?: CategoryFilter;
          eraFilter?: string | null;
          selectedCategory?: CategoryFilter;
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
      sessionStorage.removeItem(COLLECTION_FILTERS_KEY);
      sessionStorage.removeItem(RETURN_TO_KEY);
    }
  }, []);

  const handleCategoryChange = (cat: CategoryFilter) => {
    setSelectedCategory(cat);
    if (cat !== "ETB" && cat !== "Displays" && cat !== "UPC") setSelectedEra(null);
  };

  const hasEraSubFilter = selectedCategory === "ETB" || selectedCategory === "Displays" || selectedCategory === "UPC";
  const filteredItems = useMemo(() => {
    let list = items;
    if (selectedCategory !== "Tous") {
      list = list.filter((it) => it.product.category === selectedCategory);
    }
    if (hasEraSubFilter && selectedEra) {
      list = list.filter((it) => it.product.set === selectedEra);
    }
    return list;
  }, [items, selectedCategory, selectedEra, hasEraSubFilter]);

  const totalQuantity = useMemo(
    () => items.reduce((sum, it) => sum + it.quantity, 0),
    [items]
  );

  // Toujours afficher tous les items ; la limite gratuite bloque uniquement l'ajout, pas l'affichage.
  const displayedItems = filteredItems;

  const displayedQuantity = useMemo(
    () => filteredItems.reduce((s, it) => s + it.quantity, 0),
    [filteredItems]
  );

  const atFreeLimit = !premiumLoading && !isPremium && totalQuantity >= FREE_COLLECTION_LIMIT;

  const collectionLines = useMemo(
    () =>
      items.map((it) => ({
        quantity: it.quantity,
        buyPrice: it.buyPrice,
        product: it.product,
      })),
    [items]
  );

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
  const typeRowStyle = (key: CategoryFilter, selected: boolean): CSSProperties =>
    selected
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

  return (
    <div className="space-y-4 -mx-3">
      <PortfolioDashboardSection
        mode="chartOnly"
        collectionLines={collectionLines}
        sales={sales}
        isPremium={isPremium}
        isLoadingSubscription={premiumLoading}
        isLight={isLight}
        isDark={isDark}
        accentGold={accentGold}
        chartPeriod={chartPeriod}
        setChartPeriod={setChartPeriod}
      />

      {/* Filtres type + ère */}
      <div>
        <p className="app-heading mb-2 text-xs pl-3" style={{ color: "var(--text-secondary)" }}>
          Filtres
        </p>
        <div className="flex flex-wrap gap-2 pl-3">
          <button
            type="button"
            className={`filter-btn ${pressedFilterKey === "cat-Tous" ? "filter-btn-press" : ""}`}
            onPointerDown={() => triggerFilterPress("cat-Tous")}
            onClick={() => handleCategoryChange("Tous")}
            style={typeRowStyle("Tous", selectedCategory === "Tous")}
          >
            Tous
          </button>
          <button
            type="button"
            className={`filter-btn ${pressedFilterKey === "cat-Displays" ? "filter-btn-press" : ""}`}
            onPointerDown={() => triggerFilterPress("cat-Displays")}
            onClick={() => handleCategoryChange("Displays")}
            style={typeRowStyle("Displays", selectedCategory === "Displays")}
          >
            Displays
          </button>
          <button
            type="button"
            className={`filter-btn ${pressedFilterKey === "cat-ETB" ? "filter-btn-press" : ""}`}
            onPointerDown={() => triggerFilterPress("cat-ETB")}
            onClick={() => handleCategoryChange("ETB")}
            style={typeRowStyle("ETB", selectedCategory === "ETB")}
          >
            ETB
          </button>
          <button
            type="button"
            className={`filter-btn ${pressedFilterKey === "cat-UPC" ? "filter-btn-press" : ""}`}
            onPointerDown={() => triggerFilterPress("cat-UPC")}
            onClick={() => handleCategoryChange("UPC")}
            style={typeRowStyle("UPC", selectedCategory === "UPC")}
          >
            UPC
          </button>
        </div>
        {hasEraSubFilter && (
          <div className="mt-2 flex flex-wrap gap-1.5 pl-3">
            {HOME_ERA_OPTIONS.map((era) => {
              const isSelected = selectedEra === era;
              return (
                <button
                  type="button"
                  key={era}
                  className={`filter-btn rounded-full font-medium shrink-0 ${pressedFilterKey === `era-${era}` ? "filter-btn-press" : ""}`}
                  onPointerDown={() => triggerFilterPress(`era-${era}`)}
                  onClick={() => setSelectedEra((current) => (current === era ? null : era))}
                  style={{
                    ...filterRow2Base,
                    whiteSpace: "nowrap",
                    backgroundColor: TYPE_ROW_DARK_BG,
                    color: "#ffffff",
                    ...(isSelected
                      ? GENERATION_SELECTED_GLOW[era]
                      : { border: "none", boxShadow: "none" }),
                  }}
                >
                  {era}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Limite 5 items (gratuit) + CTA Premium */}
      {atFreeLimit && (
        <section
          className="rounded-2xl p-4 space-y-3"
          style={{
            background: "var(--card-color)",
            boxShadow: "0 2px 12px rgba(0,0,0,0.12)",
            border: `1px solid ${accentGold}`,
          }}
        >
          <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            Vous avez atteint la limite de 5 items. Passez Premium pour une collection illimitée !
          </p>
          <button
            type="button"
            onClick={() => navigate("/premium")}
            className="rounded-2xl py-2.5 px-4 text-sm font-bold w-full"
            style={{
              background: accentGold,
              color: "#000",
              border: "none",
              cursor: "pointer",
            }}
          >
            Voir l&apos;offre Premium
          </button>
        </section>
      )}

      {/* Détail des produits — grille 2 colonnes comme Accueil */}
      <section className="space-y-2">
        <h3 className="title-section pl-3" style={{ color: "var(--text-primary)" }}>
          Détail des produits ({displayedQuantity} items)
        </h3>
        <div className="grid grid-cols-2 gap-3">
          {displayedItems.map((item) => {
            const current = getPrixMarcheForProduct(item.product, etbData);
            const navProductId = encodeURIComponent(item.product.id);
            const detailUrl = `/produit/${navProductId}?collectionId=${encodeURIComponent(item.id)}`;
            const eraBadge = getEraBadge(item.product.etbId ?? item.product.id.replace(/^upc-/, ""), item.product.set);
            const imageUrl = getProductImageUrl(item.product);
            return (
              <Link
                key={item.id}
                to={detailUrl}
                onClick={() => {
                  sessionStorage.setItem(RETURN_TO_KEY, "/collection");
                  sessionStorage.setItem(
                    COLLECTION_FILTERS_KEY,
                    JSON.stringify({ typeFilter: selectedCategory, eraFilter: selectedEra })
                  );
                }}
                className="relative flex flex-col rounded-2xl cursor-pointer block overflow-hidden h-[255px]"
                style={{
                  background: isDark ? "#111111" : "var(--card-color)",
                  boxShadow: isDark ? "none" : "0 2px 12px rgba(0,0,0,0.12)",
                }}
              >
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setConfirmId(item.id);
                  }}
                  aria-label="Retirer de la collection"
                  style={{
                    position: "absolute",
                    top: "8px",
                    right: "8px",
                    width: "24px",
                    height: "24px",
                    borderRadius: "50%",
                    background: "rgba(0,0,0,0.75)",
                    color: "#fff",
                    border: "none",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    padding: "0",
                    margin: "0",
                    fontSize: "12px",
                    lineHeight: "1",
                    zIndex: 10,
                  }}
                >
                  ✕
                </button>
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
                  {imageUrl ? (
                    <img
                      src={imageUrl}
                      alt={item.product.name}
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
                      emoji={item.product.emoji ?? "🎴"}
                      name={item.product.name}
                      size={64}
                      frame="none"
                      className="opacity-60"
                    />
                  )}
                  <span
                    className="absolute left-2 bottom-2 rounded-full px-1.5 py-0.5 text-[9px] font-medium z-[5]"
                    style={{ background: "rgba(0,0,0,0.75)", color: "#fff" }}
                  >
                    x{item.quantity}
                  </span>
                </div>
                <div
                  className="flex flex-1 flex-col min-h-0 p-3 pt-2"
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    height: "95px",
                    background: isDark ? "#111111" : "var(--card-color)",
                  }}
                >
                  <p
                    className="text-xs font-semibold shrink-0 line-clamp-1 overflow-hidden text-ellipsis"
                    style={{
                      marginTop: 0,
                      color: isDark ? "#ffffff" : "var(--text-primary)",
                      fontFamily: '"Inter", system-ui, sans-serif',
                    }}
                  >
                    {formatProductNameWithSetCode(
                      item.product.name,
                      getSetCodeFromProduct(item.product),
                      item.product.category as "ETB" | "Displays"
                    )}
                  </p>
                  <p className="text-[11px] mt-1 shrink-0" style={{ color: isDark ? LABEL_MUTED : "var(--text-secondary)" }}>
                    {formatPurchaseDate(item.purchaseDate)}
                  </p>
                  <div className="mt-auto flex justify-between items-baseline gap-2 shrink-0 pt-1">
                    <p
                      className="text-sm font-semibold tabular-nums truncate min-w-0"
                      style={{ color: isDark ? EMERALD : accentGold }}
                    >
                      {current.toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 })}
                    </p>
                    {eraBadge ? (
                      <span className="shrink-0 max-w-[min(100%,140px)] truncate font-semibold" style={getEraNeonBadgeStyle(eraBadge.label)}>
                        {eraBadge.label}
                      </span>
                    ) : (
                      <span
                        className="shrink-0 whitespace-nowrap text-[9px] font-medium uppercase"
                        style={{ background: "rgba(255,255,255,0.12)", color: "var(--text-primary)", padding: "2px 5px", borderRadius: "4px" }}
                      >
                        {item.product.badge}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  aria-label="Modifier le prix et la date d'achat"
                  className="rounded-lg px-2.5 py-1 text-xs font-semibold border hover:opacity-90"
                  style={{
                    position: "absolute",
                    bottom: "12px",
                    right: "12px",
                    background: isDark ? "rgba(16,185,129,0.15)" : "rgba(250,204,21,0.12)",
                    color: isDark ? EMERALD : accentGold,
                    borderColor: isDark ? "rgba(16,185,129,0.45)" : "rgba(250,204,21,0.5)",
                    zIndex: 10,
                  }}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setEditId(item.id);
                    setEditPriceInput(String(item.buyPrice));
                    setEditDateInput(item.purchaseDate || todayISO());
                    setEditQuantityInput(String(item.quantity));
                  }}
                >
                  Modifier
                </button>
              </Link>
            );
          })}
          {displayedItems.length === 0 && (
            <p className="col-span-2 rounded-2xl p-4 text-center text-xs" style={{ background: "var(--card-color)", color: "var(--text-secondary)", boxShadow: "0 2px 12px rgba(0,0,0,0.12)" }}>
              Aucun produit dans votre collection pour le moment.
            </p>
          )}
        </div>
      </section>

      {confirmId && (() => {
        const item = items.find((it) => it.id === confirmId);
        if (!item) return null;
        const hasMultiple = item.quantity > 1;
        return (
          <div
            className="fixed inset-0 z-40 flex items-center justify-center px-6"
            style={{
              background: "var(--overlay-bg)",
              backdropFilter: "blur(4px)",
            }}
          >
            <div
              className="w-full max-w-xs rounded-2xl p-4 space-y-3"
              style={{ background: "var(--card-color)", boxShadow: "0 8px 32px rgba(0,0,0,0.4)" }}
            >
              <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                Voulez-vous vraiment retirer cet élément de votre collection ?
              </p>
              <p className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
                {hasMultiple
                  ? `Vous avez x${item.quantity} exemplaires de "${item.product.name}".`
                  : `Vous avez 1 exemplaire de "${item.product.name}".`}
              </p>
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setConfirmId(null)}
                  className="flex-1 rounded-2xl py-1.5 text-xs font-medium"
                  style={{ background: "var(--input-bg)", color: "var(--text-secondary)" }}
                >
                  Annuler
                </button>
                {hasMultiple && (
                  <button
                    type="button"
                    onClick={() => {
                      removeFromCollection(item.id, "one");
                      setConfirmId(null);
                    }}
                    className="flex-1 rounded-2xl py-1.5 text-xs font-semibold"
                    style={{ background: "var(--input-bg)", color: accentGold, border: `1px solid ${accentGold}` }}
                  >
                    Retirer 1
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    removeFromCollection(item.id, "all");
                    setConfirmId(null);
                  }}
                  className="flex-1 rounded-2xl py-1.5 text-xs font-semibold"
                  style={{ background: "var(--loss-red)", color: "var(--text-primary)" }}
                >
                  Tout retirer
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {editId && (() => {
        const item = items.find((it) => it.id === editId);
        if (!item) return null;
        return (
          <div
            className="fixed inset-0 z-40 flex items-center justify-center px-6"
            style={{
              background: "var(--overlay-bg)",
              backdropFilter: "blur(4px)",
            }}
          >
            <div
              className="w-full max-w-xs rounded-2xl p-4 space-y-4 overflow-hidden"
              style={{
                background: "var(--card-color)",
                boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
                boxSizing: "border-box",
              }}
            >
              <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                Modifier {item.product.name}
              </p>
              <div className="space-y-3" style={{ boxSizing: "border-box" }}>
                <div>
                  <label className="block text-[11px] mb-1" style={{ color: "var(--text-secondary)" }}>
                    Prix d&apos;achat (€)
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    className={`w-full focus:outline-none focus:ring-1 ${isDark ? "focus:ring-[#FBBF24]" : "focus:ring-[#D4A757]"}`}
                    style={{
                      boxSizing: "border-box",
                      background: "var(--input-bg)",
                      color: "var(--text-primary)",
                      borderRadius: "8px",
                      padding: "10px 12px",
                      fontSize: "14px",
                      height: "36px",
                      border: "none",
                    }}
                    value={editPriceInput}
                    onChange={(e) => setEditPriceInput(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-[11px] mb-1" style={{ color: "var(--text-secondary)" }}>
                    Date d&apos;achat
                  </label>
                  <input
                    type="date"
                    className={`w-full focus:outline-none focus:ring-1 ${isDark ? "focus:ring-[#FBBF24]" : "focus:ring-[#D4A757]"}`}
                    style={{
                      boxSizing: "border-box",
                      background: "var(--input-bg)",
                      color: "var(--text-primary)",
                      borderRadius: "8px",
                      padding: "10px 12px",
                      fontSize: "14px",
                      height: "36px",
                      border: "none",
                    }}
                    value={editDateInput}
                    onChange={(e) => setEditDateInput(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-[11px] mb-1" style={{ color: "var(--text-secondary)" }}>
                    Quantité
                  </label>
                  <input
                    type="number"
                    min={1}
                    inputMode="numeric"
                    className={`w-full focus:outline-none focus:ring-1 ${isDark ? "focus:ring-[#FBBF24]" : "focus:ring-[#D4A757]"}`}
                    style={{
                      boxSizing: "border-box",
                      background: "var(--input-bg)",
                      color: "var(--text-primary)",
                      borderRadius: "8px",
                      padding: "10px 12px",
                      fontSize: "14px",
                      height: "36px",
                      border: "none",
                    }}
                    value={editQuantityInput}
                    onChange={(e) => {
                      const raw = e.target.value;
                      setEditQuantityInput(raw);
                      setEditQuantityWarning(null);

                      if (!raw) return;
                      const next = parseInt(raw, 10);
                      if (!Number.isFinite(next) || next < 1) return;

                      if (!isPremium) {
                        const currentTotal = totalQuantity;
                        const currentItemQty = item.quantity;
                        const maxAllowed =
                          FREE_COLLECTION_LIMIT - (currentTotal - currentItemQty);
                        if (maxAllowed < 1) {
                          setEditQuantityInput(String(currentItemQty));
                          setEditQuantityWarning(
                            "Limite de 5 items — passez Premium pour plus"
                          );
                          return;
                        }
                        if (next > maxAllowed) {
                          setEditQuantityInput(String(maxAllowed));
                          setEditQuantityWarning(
                            "Limite de 5 items — passez Premium pour plus"
                          );
                        }
                      }
                    }}
                  />
                  {editQuantityWarning && (
                    <p
                      className="mt-1 text-[10px]"
                      style={{ color: "var(--loss-red)" }}
                    >
                      {editQuantityWarning}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setEditId(null);
                    setEditPriceInput("");
                    setEditDateInput("");
                    setEditQuantityInput("");
                    setEditQuantityWarning(null);
                  }}
                  className="flex-1 rounded-2xl py-2 text-xs font-medium"
                  style={{ background: "var(--input-bg)", color: "var(--text-secondary)" }}
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const parsed = parseFloat(
                      editPriceInput.replace(",", ".")
                    );
                    if (!Number.isFinite(parsed) || parsed <= 0) {
                      return;
                    }
                    const qty = parseInt(editQuantityInput, 10);
                    if (!Number.isFinite(qty) || qty < 1) {
                      return;
                    }

                    if (!isPremium) {
                      const currentTotal = totalQuantity;
                      const currentItemQty = item.quantity;
                      const maxAllowed =
                        FREE_COLLECTION_LIMIT - (currentTotal - currentItemQty);
                      if (maxAllowed < 1) {
                        setEditQuantityInput(String(currentItemQty));
                        setEditQuantityWarning(
                          "Limite de 5 items — passez Premium pour plus"
                        );
                        return;
                      }
                      if (qty > maxAllowed) {
                        setEditQuantityInput(String(maxAllowed));
                        setEditQuantityWarning(
                          "Limite de 5 items — passez Premium pour plus"
                        );
                        return;
                      }
                    }

                    updateCollectionItem(item.id, {
                      buyPrice: parsed,
                      purchaseDate: editDateInput.trim() || undefined,
                      quantity: qty,
                    });
                    setEditId(null);
                    setEditPriceInput("");
                    setEditDateInput("");
                    setEditQuantityInput("");
                    setEditQuantityWarning(null);
                  }}
                  className="flex-1 rounded-2xl py-2 text-xs font-semibold"
                  style={{ background: "var(--gain-green)", color: "var(--text-primary)" }}
                >
                  Confirmer
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

