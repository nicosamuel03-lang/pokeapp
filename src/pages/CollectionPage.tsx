import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useCollection } from "../state/CollectionContext";
import { usePremium } from "../hooks/usePremium";
import { getPrixMarcheForProduct } from "../utils/prixMarche";
import { getTotalRealizedGain } from "../utils/salesHistoryStorage";
import { etbData } from "../data/etbData";
import { displayData } from "../data/displayData";
import { ItemIcon } from "../components/ItemIcon";
import { getEraBadge, getEraStyle } from "../utils/eraBadge";
import { formatProductNameWithSetCode, getSetCodeFromProduct } from "../utils/formatProduct";
import { useTheme } from "../state/ThemeContext";

const COLLECTION_FILTERS_KEY = "collectionFilters";
const RETURN_TO_KEY = "returnTo";

type CategoryFilter = "Tous" | "Displays" | "ETB" | "UPC";

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

  // Sinon, on tente un match direct/id préfixé
  const etb =
    etbData.find((e) => e.id === product.id) ||
    etbData.find((e) => product.id.startsWith(e.id));

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
  const { isPremium, loading: premiumLoading } = usePremium();
  const { items, removeFromCollection, updateCollectionItem } = useCollection();
  const [selectedCategory, setSelectedCategory] = useState<CategoryFilter>("Tous");
  const [selectedEra, setSelectedEra] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [editPriceInput, setEditPriceInput] = useState<string>("");
  const [editDateInput, setEditDateInput] = useState<string>("");
  const [editQuantityInput, setEditQuantityInput] = useState<string>("");

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

  const eras = useMemo(() => {
    const sets = new Set<string>();
    items.forEach((it) => {
      if ((it.product.category === "ETB" || it.product.category === "Displays" || it.product.category === "UPC") && it.product.set) {
        sets.add(it.product.set);
      }
    });
    return Array.from(sets).sort();
  }, [items]);

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

  const displayedItems = useMemo(() => {
    if (premiumLoading || isPremium) return filteredItems;
    let sum = 0;
    const result: typeof filteredItems = [];
    for (const item of filteredItems) {
      if (sum + item.quantity <= FREE_COLLECTION_LIMIT) {
        result.push(item);
        sum += item.quantity;
      } else break;
    }
    return result;
  }, [filteredItems, isPremium, premiumLoading]);

  const displayedQuantity = useMemo(
    () => displayedItems.reduce((s, it) => s + it.quantity, 0),
    [displayedItems]
  );
  const filteredQuantity = useMemo(
    () => filteredItems.reduce((s, it) => s + it.quantity, 0),
    [filteredItems]
  );

  const atFreeLimit = !premiumLoading && !isPremium && totalQuantity >= FREE_COLLECTION_LIMIT;

  const { totalValue, totalInvested, unrealizedGain } = items.reduce(
    (acc, item) => {
      const value = getPrixMarcheForProduct(item.product, etbData) * item.quantity;
      const invested = item.buyPrice * item.quantity;
      acc.totalValue += value;
      acc.totalInvested += invested;
      acc.unrealizedGain += value - invested;
      return acc;
    },
    { totalValue: 0, totalInvested: 0, unrealizedGain: 0 }
  );

  const realizedGain = getTotalRealizedGain();
  const totalGain = unrealizedGain + realizedGain;
  const computedPerf = totalInvested > 0 ? (totalGain / totalInvested) * 100 : 0;

  return (
    <div className="space-y-4">
      {/* Carte Synthèse de portefeuille */}
      <section
        className="rounded-2xl p-4"
        style={{
          background: "var(--card-color)",
          boxShadow: "0 2px 12px rgba(0,0,0,0.15)",
          ...(isLight && { border: "1px solid var(--border-color)", padding: 16, borderRadius: 12 }),
        }}
      >
        <h2 className="title-section mb-3" style={{ color: "var(--text-primary)" }}>
          Synthèse de portefeuille
        </h2>
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div
            className="rounded-2xl p-3"
            style={{
              background: isLight ? "var(--input-bg)" : "var(--bg-card-elevated)",
              ...(isLight && { border: "1px solid var(--border-color)" }),
            }}
          >
            <p className="text-[11px]" style={{ color: "var(--text-secondary)" }}>Valeur actuelle</p>
            <p className="mt-1 text-sm font-semibold" style={{ color: "var(--accent-yellow)" }}>
              {totalValue.toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 })}
            </p>
          </div>
          <div
            className="rounded-2xl p-3"
            style={{
              background: isLight ? "var(--input-bg)" : "var(--bg-card-elevated)",
              ...(isLight && { border: "1px solid var(--border-color)" }),
            }}
          >
            <p className="text-[11px]" style={{ color: "var(--text-secondary)" }}>Total investi</p>
            <p className="mt-1 text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
              {totalInvested.toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 })}
            </p>
          </div>
          <div
            className="rounded-2xl p-3"
            style={{
              background: isLight ? "var(--input-bg)" : "var(--bg-card-elevated)",
              ...(isLight && { border: "1px solid var(--border-color)" }),
            }}
          >
            <p className="text-[11px]" style={{ color: "var(--text-secondary)" }}>Gain / Perte</p>
            <p className="mt-1 text-sm font-semibold" style={{ color: totalGain >= 0 ? "var(--gain-green)" : "var(--loss-red)" }}>
              {totalGain >= 0 ? "+" : ""}
              {totalGain.toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 })}
            </p>
          </div>
          <div
            className="rounded-2xl p-3"
            style={{
              background: isLight ? "var(--input-bg)" : "var(--bg-card-elevated)",
              ...(isLight && { border: "1px solid var(--border-color)" }),
            }}
          >
            <p className="text-[11px]" style={{ color: "var(--text-secondary)" }}>Performance</p>
            <p className="mt-1 text-sm font-semibold" style={{ color: computedPerf >= 0 ? "var(--gain-green)" : "var(--loss-red)" }}>
              {computedPerf >= 0 ? "+" : ""}
              {computedPerf.toFixed(1)}%
            </p>
          </div>
          {realizedGain !== 0 && (
            <div
              className="col-span-2 rounded-2xl p-3"
              style={{
                background: isLight ? "var(--input-bg)" : "var(--bg-card-elevated)",
                ...(isLight && { border: "1px solid var(--border-color)" }),
              }}
            >
              <p className="text-[11px]" style={{ color: "var(--text-secondary)" }}>Gain réalisé (ventes)</p>
              <p className="mt-1 text-sm font-semibold" style={{ color: realizedGain >= 0 ? "var(--gain-green)" : "var(--loss-red)" }}>
                {realizedGain >= 0 ? "+" : ""}
                {realizedGain.toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 })}
              </p>
            </div>
          )}
        </div>
        <p className="mt-3 text-[11px]" style={{ color: "var(--text-secondary)" }}>
          {items.length === 0
            ? "Ajoutez un produit depuis sa fiche pour commencer votre collection."
            : `${items.length} ligne(s) dans votre collection.`}
        </p>
      </section>

      {/* Filtres type + ère */}
      <div>
        <p className="app-heading mb-2 text-xs" style={{ color: "var(--text-secondary)" }}>
          Filtres
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => handleCategoryChange("Tous")}
            style={selectedCategory === "Tous" ? { backgroundColor: '#D4A757', color: 'black', borderRadius: '999px', padding: '2px 12px', fontWeight: 600, fontSize: 13 } : { backgroundColor: 'transparent', color: 'inherit', borderRadius: '999px', padding: '2px 12px', border: '1px solid gray', fontSize: 13 }}
          >
            Tous
          </button>
          <button
            onClick={() => handleCategoryChange("Displays")}
            style={selectedCategory === "Displays" ? { backgroundColor: '#D4A757', color: 'black', borderRadius: '999px', padding: '2px 12px', fontWeight: 600, fontSize: 13 } : { backgroundColor: 'transparent', color: 'inherit', borderRadius: '999px', padding: '2px 12px', border: '1px solid gray', fontSize: 13 }}
          >
            Displays
          </button>
          <button
            onClick={() => handleCategoryChange("ETB")}
            style={selectedCategory === "ETB" ? { backgroundColor: '#D4A757', color: 'black', borderRadius: '999px', padding: '2px 12px', fontWeight: 600, fontSize: 13 } : { backgroundColor: 'transparent', color: 'inherit', borderRadius: '999px', padding: '2px 12px', border: '1px solid gray', fontSize: 13 }}
          >
            ETB
          </button>
          <button
            onClick={() => handleCategoryChange("UPC")}
            style={selectedCategory === "UPC" ? { backgroundColor: '#D4A757', color: 'black', borderRadius: '999px', padding: '2px 12px', fontWeight: 600, fontSize: 13 } : { backgroundColor: 'transparent', color: 'inherit', borderRadius: '999px', padding: '2px 12px', border: '1px solid gray', fontSize: 13 }}
          >
            UPC
          </button>
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

      {/* Limite 5 items (gratuit) + CTA Premium */}
      {atFreeLimit && (
        <section
          className="rounded-2xl p-4 space-y-3"
          style={{
            background: "var(--card-color)",
            boxShadow: "0 2px 12px rgba(0,0,0,0.12)",
            border: "1px solid var(--accent-yellow)",
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
              background: "#D4A757",
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
        <h3 className="title-section" style={{ color: "var(--text-primary)" }}>
          Détail des produits ({displayedQuantity}
          {!isPremium && totalQuantity > FREE_COLLECTION_LIMIT ? ` / ${filteredQuantity} items` : " items"})
        </h3>
        <div className="grid grid-cols-2 gap-3">
          {displayedItems.map((item) => {
            const current = getPrixMarcheForProduct(item.product, etbData);
            const gainPerItem = current - item.buyPrice;
            const totalGainItem = gainPerItem * item.quantity;
            const isUp = gainPerItem >= 0;
            const detailUrl = `/produit/${item.product.etbId ?? item.product.id}`;
            const eraBadge = getEraBadge(item.product.etbId ?? item.product.id.replace(/^upc-/, ""), item.product.set);
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
                style={{ background: "var(--card-color)", boxShadow: "0 2px 12px rgba(0,0,0,0.12)" }}
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
                    background: "var(--img-container-bg)",
                    borderRadius: "12px 12px 0 0",
                    willChange: "transform",
                  }}
                >
                  {getProductImageUrl(item.product) ? (
                    <img
                      src={getProductImageUrl(item.product)!}
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
                  {eraBadge && (
                    <span
                      className="absolute right-[40px] top-[6px] shrink-0 whitespace-nowrap text-[9px] font-medium"
                      style={{
                        background: eraBadge.bg,
                        color: eraBadge.color,
                        padding: "2px 5px",
                        borderRadius: "4px",
                      }}
                    >
                      {eraBadge.label}
                    </span>
                  )}
                  <span
                    className="absolute left-2 bottom-2 rounded-full px-1.5 py-0.5 text-[9px] font-medium"
                    style={{ background: "rgba(0,0,0,0.75)", color: "#fff" }}
                  >
                    x{item.quantity}
                  </span>
                </div>
                <div
                  className="flex flex-1 flex-col min-h-0 p-3 pt-0"
                  style={{ display: "flex", flexDirection: "column", height: "95px", background: "var(--card-color)" }}
                >
                <p className="app-heading text-xs shrink-0 line-clamp-2" style={{ marginTop: "12px", color: "var(--text-primary)" }}>
                  {formatProductNameWithSetCode(
                    item.product.name,
                    getSetCodeFromProduct(item.product),
                    item.product.category as "ETB" | "Displays"
                  )}
                </p>
                <div className="flex-1 min-h-0 overflow-hidden space-y-0.5 mt-1">
                  <p className="flex items-center gap-1 text-[10px]" style={{ color: "var(--text-secondary)" }}>
                    <span>
                      Achat{" "}
                      <span className="font-medium" style={{ color: "var(--accent-yellow)" }}>
                        {item.buyPrice.toLocaleString("fr-FR", {
                          style: "currency",
                          currency: "EUR",
                          maximumFractionDigits: 0,
                        })}
                      </span>
                    </span>
                  </p>
                  <p className="text-[10px]" style={{ color: "var(--text-secondary)" }}>
                    Date {formatPurchaseDate(item.purchaseDate)}
                  </p>
                  <p className="text-[10px]" style={{ color: "var(--text-secondary)" }}>
                    Actuel{" "}
                    <span className="font-medium" style={{ color: "var(--accent-yellow)" }}>
                      {current.toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 })}
                    </span>
                  </p>
                </div>
                <div className="mt-auto flex justify-between items-center shrink-0">
                  <p className="text-[11px] font-semibold" style={{ color: isUp ? "var(--gain-green)" : "var(--loss-red)" }}>
                    {isUp ? "+" : ""}
                    {totalGainItem.toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 })}
                  </p>
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
                    background: "rgba(250,204,21,0.12)",
                    color: "var(--accent-yellow)",
                    borderColor: "rgba(250,204,21,0.5)",
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
                    style={{ background: "var(--input-bg)", color: "var(--accent-yellow)", border: "1px solid var(--accent-yellow)" }}
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
                    className="w-full focus:outline-none focus:ring-1 focus:ring-[var(--accent-yellow)]"
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
                    className="w-full focus:outline-none focus:ring-1 focus:ring-[var(--accent-yellow)]"
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
                    className="w-full focus:outline-none focus:ring-1 focus:ring-[var(--accent-yellow)]"
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
                    onChange={(e) => setEditQuantityInput(e.target.value)}
                  />
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
                    updateCollectionItem(item.id, {
                      buyPrice: parsed,
                      purchaseDate: editDateInput.trim() || undefined,
                      quantity: qty,
                    });
                    setEditId(null);
                    setEditPriceInput("");
                    setEditDateInput("");
                    setEditQuantityInput("");
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

