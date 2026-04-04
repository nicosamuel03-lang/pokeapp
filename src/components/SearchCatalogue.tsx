import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Haptics, ImpactStyle } from "@capacitor/haptics";
import { useAuth, useUser } from "@clerk/react";
import { supabase } from "../lib/supabase";
import { incrementSalesCounterByOne } from "../lib/salesSupabase";
import { useProducts } from "../state/ProductsContext";
import { useCollection } from "../state/CollectionContext";
import { useSubscription } from "../state/SubscriptionContext";
import { removeAccents, searchPokemonCatalogue, type PokemonCatalogueItem } from "../data/pokemonCatalogue";
import { etbData } from "../data/etbData";
import { getLastPrixFromHistorique, getPrixMarcheForProduct } from "../utils/prixMarche";
import { getDisplayImageUrlForCatalogueItem } from "../utils/displayImage";
import { getEraBadgeForCatalogueItem } from "../utils/eraBadge";
import { formatDisplayProductName, formatProductNameWithSetCode, getSetCodeFromProduct } from "../utils/formatProduct";
import { useTheme } from "../state/ThemeContext";
import { CatalogueSearchResultRow } from "./CatalogueSearchResultRow";
import { RasterImage } from "./RasterImage";
import { STAT_CARD_VALUE_CLASS } from "../constants/statCardValueClass";
import { useEbayLiveMarketPrice } from "../hooks/useEbayLiveMarketPrice";
import { isEbayMockMode } from "../services/ebayMarketPrice";

/** Prix catalogue brut (JSON / etbData), sans couche eBay mock. */
function getMarchéActuelBrut(item: PokemonCatalogueItem): number {
  const scanOv = (item as PokemonCatalogueItem & { scanMarketOverride?: number }).scanMarketOverride;
  if (typeof scanOv === "number" && scanOv > 0) return scanOv;
  if (item.etbId) {
    const etb =
      etbData.find((e) => e.id === item.etbId && item.name === `ETB ${e.nom}`) ??
      etbData.find((e) => e.id === item.etbId);
    if (etb?.prixActuel != null && etb.prixActuel > 0) return etb.prixActuel;
    if (etb?.historique_prix?.length) {
      const p = getLastPrixFromHistorique(etb.historique_prix);
      if (p > 0) return p;
    }
  }
  const v = (item as unknown as { currentMarketPrice?: unknown }).currentMarketPrice;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** Prix affiché (inclut VITE_EBAY_STATUS=MOCK via getPrixMarcheForProduct). */
function getMarchéActuelAffiché(item: PokemonCatalogueItem): number {
  const brut = getMarchéActuelBrut(item);
  const category =
    item.type === "Display" ? "Displays" : item.type === "UPC" ? "UPC" : "ETB";
  const id = item.type === "ETB" ? (item.etbId ?? item.id) : item.id;
  return getPrixMarcheForProduct(
    {
      id,
      category,
      etbId: item.etbId,
      currentPrice: brut,
      prixMarcheActuel: brut,
    },
    etbData
  );
}

/** Image produit :
 * - Displays : même source que page d'accueil (displayData via displayImage.ts)
 * - UPC : displayData (item.imageUrl ou lookup par id)
 * - ETB : priorité etbData, puis item.imageUrl (hors logos)
 */
function getProductImageUrlForCatalogueItem(item: PokemonCatalogueItem | null | undefined): string | null {
  if (!item) return null;
  /** Après scan : image locale public/images/etb, fichier = nom de série + .webp */
  if (item.imageUrl?.startsWith("/images/etb/")) {
    return item.imageUrl;
  }
  if (item.type === "Display" || item.type === "UPC") {
    return getDisplayImageUrlForCatalogueItem(item) ?? item.imageUrl ?? null;
  }

  // ETB : 1) Lien explicite par etbId + nom (plusieurs ETB partagent le même id, ex. ME01, EB01)
  if (item.etbId) {
    const etb = etbData.find(
      (e) => e.id === item.etbId && item.name === `ETB ${e.nom}`
    );
    if (etb?.imageUrl) return etb.imageUrl;
  }

  // 2) item.imageUrl si chemin local (catalogue auto a déjà la bonne image)
  if (item.imageUrl && (item.imageUrl.startsWith("/images/") || item.imageUrl.startsWith("http"))) {
    if (!item.imageUrl.toLowerCase().includes("/logos/") && !item.imageUrl.toLowerCase().includes("/series/")) {
      return item.imageUrl;
    }
  }

  // 3) Correspondance par id dans le nom (ex. "ETB EB06 ..." → EB06)
  const byName = etbData
    .slice()
    .sort((a, b) => (b?.id?.length ?? 0) - (a?.id?.length ?? 0))
    .find((e) => item.name?.includes(e.id));
  if (byName?.imageUrl) return byName.imageUrl;

  return null;
}

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

interface AddModalProps {
  item: PokemonCatalogueItem;
  onClose: () => void;
  onAdd: (
    item: PokemonCatalogueItem,
    buyPrice: number,
    qty: number,
    purchaseDate?: string,
    prixMarcheActuel?: number
  ) => void | Promise<void>;
}

const AddModal = ({ item, onClose, onAdd }: AddModalProps) => {
  const { theme } = useTheme();
  const accentGold = theme === "dark" ? "#FBBF24" : "#D4A757";
  const [buyPrice, setBuyPrice] = useState("");
  const [purchaseDate, setPurchaseDate] = useState(todayISO);
  const [qty, setQty] = useState("1");
  const [justAdded, setJustAdded] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pressedBtn, setPressedBtn] = useState<"annuler" | "ajouter" | null>(null);
  const triggerPress = (key: "annuler" | "ajouter") => {
    setPressedBtn(key);
    setTimeout(() => setPressedBtn(null), 150);
  };

  useEffect(() => {
    setSubmitError(null);
  }, [item.id]);

  const modalImgUrl = getProductImageUrlForCatalogueItem(item);
  const modalEraBadge = getEraBadgeForCatalogueItem(item);
  const modalPlaceholderBg =
    (item.type === "Display" || item.type === "UPC") && modalEraBadge ? modalEraBadge.bg : "var(--placeholder-bg)";

  const titleFormatted = formatProductNameWithSetCode(
    item.name,
    getSetCodeFromProduct({ id: item.id, etbId: item.etbId }),
    item.type === "Display" ? "Displays" : item.type === "UPC" ? "UPC" : "ETB"
  );
  const catalogMarché = getMarchéActuelAffiché(item);
  const ebayLive = useEbayLiveMarketPrice(titleFormatted, catalogMarché);

  const handleConfirm = async () => {
    setSubmitError(null);
    const price = parseFloat(buyPrice.replace(",", "."));
    const quantity = parseInt(qty, 10);
    if (Number.isNaN(price) || price <= 0 || Number.isNaN(quantity) || quantity < 1) return;
    setIsSubmitting(true);
    try {
      if (navigator.vibrate) navigator.vibrate(50);
      await Promise.resolve(
        onAdd(item, price, quantity, purchaseDate || undefined, ebayLive.displayPrice)
      );
      setJustAdded(true);
      try {
        await Haptics.impact({ style: ImpactStyle.Medium });
      } catch {
        /* Web ou plugin indisponible */
      }
      setTimeout(() => {
        setJustAdded(false);
        onClose();
      }, ADD_TO_COLLECTION_SUCCESS_MS);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setSubmitError(msg);
      try {
        window.alert(msg);
      } catch {
        /* ignore */
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{
        background: "var(--overlay-bg)",
        backdropFilter: "blur(4px)",
        WebkitBackdropFilter: "blur(4px)",
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-md h-full rounded-t-3xl flex flex-col"
        style={{
          background: "var(--card-color)",
          boxShadow: "0 -8px 32px rgba(0,0,0,0.35)",
          maxHeight: "90vh",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col px-4 pt-4 pb-4">
            {/* Image ETB + infos + champs */}
            <div className="space-y-4">
              <div className="flex flex-col items-start gap-3">
                <div className="relative w-full flex items-center justify-center rounded-2xl overflow-hidden" style={{ height: "192px", minHeight: "192px", background: "var(--img-container-bg)", boxShadow: "0 1px 4px rgba(0,0,0,0.12)" }}>
                  {modalImgUrl ? (
                    <RasterImage
                      src={modalImgUrl || ""}
                      alt={formatDisplayProductName(item.name, item.type === "Display" || item.type === "UPC")}
                      loading="eager"
                      width={288}
                      height={192}
                      className="h-full w-full object-contain"
                      style={{ objectFit: "contain" }}
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                        const placeholder = e.currentTarget.nextElementSibling as HTMLElement | null;
                        if (placeholder) {
                          (placeholder as HTMLElement).style.display = "block";
                          (placeholder as HTMLElement).style.background = modalPlaceholderBg;
                        }
                      }}
                    />
                  ) : null}
                  <div
                    className="absolute inset-0"
                    style={{
                      display: modalImgUrl ? "none" : "block",
                      background: modalPlaceholderBg,
                    }}
                    aria-hidden
                  />
                </div>
                <div className="min-w-0 w-full text-left">
                  <p className="app-heading text-sm" style={{ color: "var(--text-primary)" }}>
                    {titleFormatted}
                  </p>
                  <p
                    className="mt-0.5 text-[11px] font-normal"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {item.block} · Sortie{" "}
                    <span className="tabular-nums">
                      {(item.releaseDate ?? "").slice(0, 7).replace("-", "/")}
                    </span>
                  </p>
                  <p className="mt-0.5 text-xs font-medium">
                    <span style={{ color: accentGold }}>Marché actuel :</span>{" "}
                    <span className={STAT_CARD_VALUE_CLASS} style={{ color: accentGold }}>
                      {ebayLive.displayPrice.toLocaleString("fr-FR", {
                        style: "currency",
                        currency: "EUR",
                        maximumFractionDigits: 0,
                      })}
                    </span>
                    {ebayLive.phase === "loading" ? (
                      <span style={{ color: "var(--text-secondary)", fontWeight: 400 }}> · eBay…</span>
                    ) : null}
                  </p>
                  {!isEbayMockMode() && ebayLive.phase === "ok" ? (
                    <p className="mt-0 text-[10px]" style={{ color: "var(--text-secondary)" }}>
                      Moyenne eBay FR ({ebayLive.itemsUsed} annonce{ebayLive.itemsUsed > 1 ? "s" : ""} en €).
                    </p>
                  ) : null}
                  {!isEbayMockMode() && ebayLive.phase === "error" ? (
                    <p className="mt-0 text-[10px]" style={{ color: "var(--text-secondary)" }}>
                      Prix catalogue (eBay indisponible).
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                    Prix d&apos;achat (€)
                  </label>
                  <input
                    type="number"
                    inputMode="decimal"
                    className={`${STAT_CARD_VALUE_CLASS} w-full rounded-2xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2D2D2D]`}
                    style={{
                      background: "var(--input-bg)",
                      color: "var(--text-primary)",
                    }}
                    placeholder={`Retail ${item.msrp}€`}
                    value={buyPrice}
                    onChange={(e) => setBuyPrice(e.target.value)}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                    Date d&apos;achat
                  </label>
                  <input
                    type="date"
                    className={`${STAT_CARD_VALUE_CLASS} w-full rounded-2xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2D2D2D]`}
                    style={{
                      background: "var(--input-bg)",
                      color: "var(--text-primary)",
                    }}
                    value={purchaseDate}
                    onChange={(e) => setPurchaseDate(e.target.value)}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                    Quantité
                  </label>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    className={`${STAT_CARD_VALUE_CLASS} w-full rounded-2xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2D2D2D]`}
                    style={{
                      background: "var(--input-bg)",
                      color: "var(--text-primary)",
                    }}
                    value={qty}
                    onChange={(e) => setQty(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {submitError ? (
              <div
                role="alert"
                className="mt-3 rounded-2xl px-3 py-2 text-xs font-medium leading-snug"
                style={{
                  background: "rgba(220, 38, 38, 0.18)",
                  border: "1px solid rgba(248, 113, 113, 0.5)",
                  color: "#fecaca",
                }}
              >
                {submitError}
              </div>
            ) : null}

            {/* Boutons directement sous Quantité */}
            <div className="flex flex-row gap-2 mt-4 shrink-0">
              <button
                type="button"
                className={`btn-press flex-1 rounded-2xl py-2.5 text-sm font-medium transition ${pressedBtn === "annuler" ? "btn-press-pressed" : ""}`}
                onPointerDown={() => triggerPress("annuler")}
                onClick={onClose}
                disabled={isSubmitting}
                style={{
                  background: "var(--input-bg)",
                  color: "var(--text-secondary)",
                  opacity: isSubmitting ? 0.6 : 1,
                }}
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => void handleConfirm()}
                disabled={justAdded || isSubmitting}
                className={`btn-press flex-1 rounded-2xl py-2.5 text-sm font-semibold transition disabled:cursor-default disabled:opacity-100 ${pressedBtn === "ajouter" ? "btn-press-pressed" : ""}`}
                onPointerDown={() => !justAdded && !isSubmitting && triggerPress("ajouter")}
                style={{
                  background: justAdded ? "#166534" : "#15803D",
                  color: "#FFFFFF",
                }}
              >
                {justAdded ? "Ajouté ✓" : "Ajouter à ma collection"}
              </button>
            </div>
          </div>
      </div>
    </div>
  );
};

const FREE_COLLECTION_LIMIT = 5;
/** Durée d’affichage « Ajouté ✓ » + alignement avec la navigation (même délai que l’animation bouton). */
const ADD_TO_COLLECTION_SUCCESS_MS = 400;

export const SearchCatalogue = ({
  historyBackOnAddModalClose,
}: {
  /** Page /ajouter : fermeture du modal (Annuler / overlay) → `navigate(-1)` vers la page précédente. */
  historyBackOnAddModalClose?: boolean;
} = {}) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { isSignedIn } = useAuth();
  const { user } = useUser();
  const { theme } = useTheme();
  const accentGold = theme === "dark" ? "#FBBF24" : "#D4A757";
  const { addProduct } = useProducts();
  const { items, addToCollection } = useCollection();
  const { isPremium, isLoading: premiumLoading } = useSubscription();
  console.log("[RENDER] SearchCatalogue", "isPremium:", isPremium, "isLoading:", premiumLoading, new Date().toISOString());

  const totalQuantity = useMemo(
    () => items.reduce((sum, it) => sum + it.quantity, 0),
    [items]
  );

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PokemonCatalogueItem[]>([]);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<PokemonCatalogueItem | null>(null);
  const [authMessage, setAuthMessage] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const itemParam = searchParams.get("item");
  const fromScan = searchParams.get("fromScan");

  useEffect(() => {
    if (!itemParam) return;
    const fullCatalogue = searchPokemonCatalogue("") ?? [];
    const paramLower = itemParam.toLowerCase();
    const match = fullCatalogue.find(
      (i) =>
        (i.etbId && i.etbId.toLowerCase() === paramLower) ||
        i.id.toLowerCase() === paramLower ||
        i.id.toLowerCase() === `etb-${paramLower}` ||
        i.id.toLowerCase() === `display-${paramLower}` ||
        i.id.toLowerCase() === `upc-${paramLower}`
    );
    if (match) {
      setSelected(match);
      setSearchParams({}, { replace: true });
    }
  }, [itemParam, setSearchParams]);

  useEffect(() => {
    if (fromScan !== "1") return;
    try {
      const raw = sessionStorage.getItem("pokevault_scan_catalogue_item");
      if (raw) {
        const item = JSON.parse(raw) as PokemonCatalogueItem;
        if (item?.id && typeof item.name === "string") {
          setSelected(item);
        }
      }
    } catch {
      /* ignore */
    } finally {
      try {
        sessionStorage.removeItem("pokevault_scan_catalogue_item");
      } catch {
        /* ignore */
      }
      setSearchParams({}, { replace: true });
    }
  }, [fromScan, setSearchParams]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 1) {
      setResults([]);
      setOpen(false);
      return;
    }
    const matches = searchPokemonCatalogue(q) ?? [];
    const normalizedQuerySort = removeAccents(q.toLowerCase());
    const sorted = [...matches].sort((a, b) => {
      const nameA = (a.name || "").toLowerCase();
      const nameB = (b.name || "").toLowerCase();
      const aStarts = removeAccents(nameA).startsWith(normalizedQuerySort);
      const bStarts = removeAccents(nameB).startsWith(normalizedQuerySort);
      if (aStarts && !bStarts) return -1;
      if (!aStarts && bStarts) return 1;
      /* Si les deux commencent par la requête (ex. « e ») : ETB avant Display/UPC — sinon « EB01… » gagne sur « ETB… » via localeCompare. */
      if (aStarts && bStarts) {
        const typeRank = (t: PokemonCatalogueItem["type"]) => (t === "ETB" ? 0 : t === "Display" ? 1 : 2);
        const tr = typeRank(a.type) - typeRank(b.type);
        if (tr !== 0) return tr;
      }
      return nameA.localeCompare(nameB);
    });
    setResults(sorted);
    setOpen(true);
  }, [query]);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (query.trim().length > 0 && containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [query]);

  const handleAdd = async (
    item: PokemonCatalogueItem,
    buyPrice: number,
    qty: number,
    purchaseDate?: string,
    prixMarcheActuel?: number
  ) => {
    if (!isSignedIn) {
      setAuthMessage(true);
      setTimeout(() => setAuthMessage(false), 4000);
      throw new Error(
        "Vous devez vous connecter pour ajouter un item à votre collection."
      );
    }
    if (!premiumLoading && !isPremium && totalQuantity + qty > FREE_COLLECTION_LIMIT) {
      navigate("/premium");
      throw new Error(
        "Limite de 5 produits en collection (version gratuite). Passez à Premium pour continuer."
      );
    }
    const marchéActuel =
      typeof prixMarcheActuel === "number" &&
      Number.isFinite(prixMarcheActuel) &&
      prixMarcheActuel > 0
        ? prixMarcheActuel
        : getMarchéActuelBrut(item);

    const product = addProduct({
      emoji: item.emoji,
      name: item.name,
      category:
        item.type === "Display"
          ? "Displays"
          : item.type === "UPC"
            ? "UPC"
            : item.type === "ETB"
              ? "ETB"
              : "Coffrets",
      set: item.block,
      condition: "Neuf scellé",
      currentPrice: marchéActuel,
      change30dPercent: 0,
      badge: item.block,
      imageUrl: item.imageUrl,
      dateSortie: item.releaseDate,
      quantite: qty,
      prixAchat: buyPrice,
      prixMarcheActuel: marchéActuel,
      prixVente: null,
      etbId: item.etbId ?? item.id?.replace(/^(?:display-|upc-|etb-)/, "") ?? undefined,
    });

    const userId = user?.id ?? null;
    if (userId) {
      let imageToSave: string | null = product.imageUrl ?? null;
      if (!imageToSave && (product.etbId || product.id)) {
        const etb =
          etbData.find((e) => e.id === (product.etbId ?? product.id)) ||
          etbData.find((e) => product.id.startsWith(e.id));
        imageToSave = etb?.imageUrl ?? null;
      }

      const displayProductName = formatProductNameWithSetCode(
        item.name,
        getSetCodeFromProduct({ id: item.id, etbId: item.etbId }),
        item.type === "Display" ? "Displays" : item.type === "UPC" ? "UPC" : "ETB"
      );

      const saleDateRaw = purchaseDate?.trim() ?? "";
      const saleDate =
        /^\d{4}-\d{2}-\d{2}$/.test(saleDateRaw) ? saleDateRaw : todayISO();

      const salePriceNumber = Number(buyPrice);
      const totalBuyCost = buyPrice * qty;
      const profit = salePriceNumber * qty - totalBuyCost;

      const row = {
        user_id: userId,
        product_id: String(product.id),
        product_name: String(displayProductName || product.name || ""),
        image: imageToSave != null ? String(imageToSave) : null,
        buy_price: Number(buyPrice),
        sale_price: Number(salePriceNumber),
        quantity: Math.floor(Number(qty)) || 1,
        sale_date: saleDate,
        profit: Number(profit),
      };

      const { error: insertError } = await supabase.from("sales").insert([row]).select("id").single();
      if (insertError) {
        throw new Error(insertError.message || String(insertError));
      }
      const countOk = await incrementSalesCounterByOne(userId);
      if (!countOk) {
        try {
          window.alert(
            "Ajout enregistré, mais le compteur « Ventes utilisées » n’a pas pu être mis à jour (table sales_counter / RLS)."
          );
        } catch {
          /* ignore */
        }
      }
    }

    addToCollection(product, buyPrice, qty, purchaseDate);

    window.setTimeout(() => {
      navigate("/");
    }, ADD_TO_COLLECTION_SUCCESS_MS);
  };

  const hasSearchQuery = query.trim().length >= 1;

  return (
    <div ref={containerRef} className="relative">
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
      {/* Barre de recherche */}
      <div
        className="flex items-center gap-2 rounded-2xl px-3 py-2.5 transition-all"
        style={{ background: "var(--card-color)", boxShadow: "0 1px 4px rgba(0,0,0,0.12)" }}
      >
        <svg
          className="h-4 w-4 shrink-0"
          style={{ color: "var(--text-secondary)" }}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"
          />
        </svg>
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => {
            if (query.trim().length >= 1) setOpen(true);
          }}
          placeholder="Rechercher un item (ex: ETB 151, Display EV, Coffret 151…)"
          className="flex-1 bg-transparent text-sm focus:outline-none"
          style={{ color: "var(--text-primary)" }}
        />
        {query && (
          <button
            onClick={() => {
              setQuery("");
              setResults([]);
              setOpen(false);
              inputRef.current?.focus();
            }}
            className="shrink-0 hover:opacity-80"
            style={{ color: "var(--text-secondary)" }}
          >
            ✕
          </button>
        )}
      </div>

      {/* État vide : aucune saisie */}
      {!hasSearchQuery && (
        <div className="mt-10 px-2 text-center text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
          Commencez à taper pour rechercher un produit…
        </div>
      )}

      {/* Dropdown résultats (au moins 1 caractère) */}
      {hasSearchQuery && open && Array.isArray(results) && results.length > 0 && (
        <div
          className="absolute left-0 right-0 z-40 mt-1.5 overflow-hidden rounded-2xl"
          style={{ background: "var(--card-color)", boxShadow: "0 4px 24px rgba(0,0,0,0.25)" }}
        >
          {results.map((item, i) => {
            const imgUrl = getProductImageUrlForCatalogueItem(item);
            const eraBadge = getEraBadgeForCatalogueItem(item);
            const placeholderBg =
              (item.type === "Display" || item.type === "UPC") && eraBadge ? eraBadge.bg : "var(--placeholder-bg)";
            return (
              <CatalogueSearchResultRow
                key={item?.id ?? `result-${i}`}
                mode="button"
                onPress={() => setSelected(item)}
                accentGold={accentGold}
                imageUrl={imgUrl}
                nameForAlt={item.name}
                isDisplayOrUpc={item.type === "Display" || item.type === "UPC"}
                placeholderBg={placeholderBg}
                eraBadge={eraBadge}
                title={formatProductNameWithSetCode(
                  item.name,
                  getSetCodeFromProduct({ id: item.id, etbId: item.etbId }),
                  item.type === "Display" ? "Displays" : item.type === "UPC" ? "UPC" : "ETB"
                )}
                showNewBadge={item.block === "Méga Évolution"}
                marketPrice={getMarchéActuelAffiché(item)}
                retailPrice={item.msrp}
                showBottomBorder={i < results.length - 1}
              />
            );
          })}
        </div>
      )}

      {hasSearchQuery && open && results.length === 0 && (
        <div
          className="absolute left-0 right-0 z-40 mt-1.5 rounded-2xl px-3 py-3 text-sm"
          style={{ background: "var(--card-color)", color: "var(--text-secondary)", boxShadow: "0 4px 24px rgba(0,0,0,0.25)" }}
        >
          Aucun produit trouvé
        </div>
      )}

      {/* Modal ajout */}
      {selected && (
        <AddModal
          item={selected}
          onClose={() => {
            setSelected(null);
            setOpen(query.trim().length >= 1);
            if (historyBackOnAddModalClose) {
              navigate(-1);
            }
          }}
          onAdd={handleAdd}
        />
      )}

    </div>
  );
};
