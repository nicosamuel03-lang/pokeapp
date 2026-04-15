import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { useUser } from "@clerk/react";
import type { SaleRecord } from "../utils/salesHistoryStorage";
import { getGuestSalesTransactionCount } from "../utils/salesHistoryStorage";
import { useSalesHistory } from "../hooks/useSalesHistory";
import { countSalesRowsByUserId, fetchSalesCounterCount } from "../lib/salesSupabase";
import { useSubscription } from "../state/SubscriptionContext";
import { useTheme } from "../state/ThemeContext";
import { STAT_CARD_VALUE_CLASS } from "../constants/statCardValueClass";
import { RasterImage } from "../components/RasterImage";

function formatSaleDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d ?? ""}/${m ?? ""}/${y ?? ""}`;
}

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export const HistoriquePage = () => {
  const { pathname } = useLocation();
  const { user } = useUser();
  const { theme } = useTheme();
  const isLight = theme === "light";
  const isDark = theme === "dark";
  const accentGold = isDark ? "#FBBF24" : "#D4A757";
  const { isPremium, isLoading: premiumLoading } = useSubscription();
  console.log("[RENDER] HistoriquePage", "isPremium:", isPremium, "isLoading:", premiumLoading, new Date().toISOString());
  const {
    sales,
    updateSaleRecord,
    deleteSaleRecord,
    refreshSales,
  } = useSalesHistory();
  /** Barre « Ventes utilisées » : `sales_counter.count` (connecté) ou compteur monotone invité — inchangé si on supprime une vente. */
  const [ventesUtiliseesCount, setVentesUtiliseesCount] = useState(0);
  /** Ventes actuellement en base / affichées (COUNT lignes `sales`). */
  const [visibleSalesRowCount, setVisibleSalesRowCount] = useState(0);
  const [editId, setEditId] = useState<string | null>(null);

  useEffect(() => {
    if (pathname === "/historique") {
      refreshSales();
    }
  }, [pathname, refreshSales]);

  useEffect(() => {
    let cancelled = false;
    const uid = user?.id ?? null;
    if (!uid) {
      setVentesUtiliseesCount(getGuestSalesTransactionCount());
      setVisibleSalesRowCount(sales.length);
      return;
    }
    void (async () => {
      const [quota, visible] = await Promise.all([
        fetchSalesCounterCount(uid),
        countSalesRowsByUserId(uid),
      ]);
      if (cancelled) return;
      setVentesUtiliseesCount(quota);
      setVisibleSalesRowCount(visible);
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, sales.length]);

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editBuyPrice, setEditBuyPrice] = useState("");
  const [editSalePrice, setEditSalePrice] = useState("");
  const [editDate, setEditDate] = useState("");

  const openEdit = (sale: SaleRecord) => {
    setEditId(sale.id);
    setEditBuyPrice(String(sale.buyPrice));
    setEditSalePrice(String(sale.salePrice));
    setEditDate(sale.saleDate || todayISO());
  };

  const saveEdit = async () => {
    if (!editId) return;
    const buyPrice = parseFloat(editBuyPrice.replace(",", "."));
    const salePrice = parseFloat(editSalePrice.replace(",", "."));
    if (!Number.isNaN(buyPrice) && !Number.isNaN(salePrice) && editDate) {
      await updateSaleRecord(editId, {
        buyPrice,
        salePrice,
        saleDate: editDate,
      });
      setEditId(null);
    }
  };

  const confirmDelete = async () => {
    if (deleteId) {
      await deleteSaleRecord(deleteId);
      setDeleteId(null);
    }
  };

  const summary = useMemo(() => {
    let totalVentes = 0;
    let totalInvesti = 0;
    let gainTotal = 0;
    sales.forEach((r) => {
      const ventes = r.salePrice * r.quantity;
      const investi = r.buyPrice * r.quantity;
      totalVentes += ventes;
      totalInvesti += investi;
      gainTotal += r.profit ?? 0;
    });
    const perfMoyenne = totalInvesti > 0 ? (gainTotal / totalInvesti) * 100 : 0;
    return { totalVentes, totalInvesti, gainTotal, perfMoyenne };
  }, [sales]);

  const clampedSalesCount = Math.max(0, Math.min(10, ventesUtiliseesCount));
  const salesProgress = (Math.min(clampedSalesCount, 10) / 10) * 100;
  const salesLimitReached = clampedSalesCount >= 10;

  const sortedSales = useMemo(
    () => [...sales].sort((a, b) => (b.saleDate > a.saleDate ? 1 : -1)),
    [sales]
  );

  return (
    <div
      className="space-y-4"
      style={{ minHeight: "100vh", width: "100%", touchAction: "pan-y" }}
    >
      <p className="text-xs font-medium mb-1" style={{ color: isDark ? "#888888" : "var(--text-secondary)" }}>
        Historique des ventes
      </p>

      {sales.length === 0 ? (
        <section
          className="rounded-2xl px-2 py-3 text-center"
          style={{
            background: "var(--card-color)",
            boxShadow: "0 2px 12px rgba(0,0,0,0.15)",
            ...(isLight && { border: "1px solid var(--border-color)", padding: "16px 8px", borderRadius: 12 }),
          }}
        >
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            Aucune vente enregistrée pour le moment.
          </p>
          <p className="mt-2 text-xs" style={{ color: "var(--text-secondary)" }}>
            Les ventes seront affichées ici une fois que vous aurez vendu des articles depuis la fiche produit.
          </p>
        </section>
      ) : (
        <>
          {!premiumLoading && !isPremium && (
            <section
              className="rounded-2xl p-3 space-y-2"
              style={{
                background: "var(--card-color)",
                boxShadow: "0 2px 12px rgba(0,0,0,0.12)",
              }}
            >
              <div className="flex justify-between items-center text-[11px]">
                <span style={{ color: "var(--text-secondary)" }}>
                  {salesLimitReached
                    ? "Limite atteinte"
                    : "Ventes utilisées"}
                </span>
                <span
                  style={{
                    color: salesLimitReached
                      ? "var(--loss-red)"
                      : accentGold,
                    fontWeight: 600,
                  }}
                >
                  <span className={STAT_CARD_VALUE_CLASS}>
                    {clampedSalesCount} / 10
                  </span>
                </span>
              </div>
              <div
                style={{
                  position: "relative",
                  width: "100%",
                  height: 6,
                  borderRadius: 9999,
                  background: "var(--input-bg)",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    width: `${salesProgress}%`,
                    background: salesLimitReached ? "#EF4444" : accentGold,
                    transition: "width 150ms ease-out",
                  }}
                />
              </div>
              <p className="text-[10px] mt-1.5" style={{ color: "var(--text-secondary)" }}>
                Le quota ne baisse pas si vous supprimez une vente ·{" "}
                <span className={STAT_CARD_VALUE_CLASS}>{visibleSalesRowCount}</span> ligne
                {visibleSalesRowCount !== 1 ? "s" : ""} actuellement dans l&apos;historique
              </p>
            </section>
          )}

          {/* Synthèse */}
          <section
            className="rounded-2xl p-4"
            style={{ background: "var(--card-color)", boxShadow: "0 2px 12px rgba(0,0,0,0.12)" }}
          >
            <p className="text-xs font-medium mb-1" style={{ color: isDark ? "#888888" : "var(--text-secondary)" }}>
              Synthèse des ventes
            </p>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div
                className={!isLight ? "rounded-2xl p-3" : ""}
                style={
                  isLight
                    ? { background: "var(--input-bg)", borderRadius: 8, padding: 12 }
                    : { background: "var(--bg-card-elevated)" }
                }
              >
                <p className="text-[11px]" style={{ color: "var(--text-secondary)" }}>Total des ventes</p>
                <p className={`${STAT_CARD_VALUE_CLASS} mt-1`} style={{ color: accentGold }}>
                  {summary.totalVentes.toLocaleString("fr-FR", {
                    style: "currency",
                    currency: "EUR",
                    maximumFractionDigits: 0,
                  })}
                </p>
              </div>
              <div
                className={!isLight ? "rounded-2xl p-3" : ""}
                style={
                  isLight
                    ? { background: "var(--input-bg)", borderRadius: 8, padding: 12 }
                    : { background: "var(--bg-card-elevated)" }
                }
              >
                <p className="text-[11px]" style={{ color: "var(--text-secondary)" }}>Total investi</p>
                <p className={`${STAT_CARD_VALUE_CLASS} mt-1`} style={{ color: "var(--text-primary)" }}>
                  {summary.totalInvesti.toLocaleString("fr-FR", {
                    style: "currency",
                    currency: "EUR",
                    maximumFractionDigits: 0,
                  })}
                </p>
              </div>
              <div
                className={!isLight ? "rounded-2xl p-3" : ""}
                style={
                  isLight
                    ? { background: "var(--input-bg)", borderRadius: 8, padding: 12 }
                    : { background: "var(--bg-card-elevated)" }
                }
              >
                <p className="text-[11px]" style={{ color: "var(--text-secondary)" }}>Gain total réalisé</p>
                <p
                  className={`${STAT_CARD_VALUE_CLASS} mt-1`}
                  style={{
                    color: summary.gainTotal >= 0 ? "var(--gain-green)" : "var(--loss-red)",
                  }}
                >
                  {summary.gainTotal >= 0 ? "+" : ""}
                  {summary.gainTotal.toLocaleString("fr-FR", {
                    style: "currency",
                    currency: "EUR",
                    maximumFractionDigits: 0,
                  })}
                </p>
              </div>
              <div
                className={!isLight ? "rounded-2xl p-3" : ""}
                style={
                  isLight
                    ? { background: "var(--input-bg)", borderRadius: 8, padding: 12 }
                    : { background: "var(--bg-card-elevated)" }
                }
              >
                <p className="text-[11px]" style={{ color: "var(--text-secondary)" }}>Performance moyenne</p>
                <p
                  className={`${STAT_CARD_VALUE_CLASS} mt-1`}
                  style={{
                    color: summary.perfMoyenne >= 0 ? "var(--gain-green)" : "var(--loss-red)",
                  }}
                >
                  {summary.perfMoyenne >= 0 ? "+" : ""}
                  {summary.perfMoyenne.toFixed(1)}%
                </p>
              </div>
            </div>
          </section>

          {/* Liste des ventes */}
          <section className="space-y-2">
            <p className="text-xs font-medium mb-1" style={{ color: isDark ? "#888888" : "var(--text-secondary)" }}>
              Détail des ventes (
              <span className={STAT_CARD_VALUE_CLASS}>
                {sortedSales.length}
              </span>
              )
            </p>
            <div className="space-y-3">
              {(isPremium ? sortedSales : sortedSales.slice(0, 5)).map((sale) => {
                const investi = sale.buyPrice * sale.quantity;
                const perfPct = investi > 0 ? (sale.profit / investi) * 100 : 0;
                const imageUrl = sale.image ?? sale.imageUrl ?? null;
                const displayName = (sale.productName ?? "").replace(/ FR$/, "");

                return (
                  <div
                    key={sale.id}
                    className={isLight ? "relative" : "relative rounded-2xl p-3"}
                    style={{
                      background: "var(--card-color)",
                      boxShadow: "0 2px 12px rgba(0,0,0,0.12)",
                      ...(isLight && {
                        border: "1px solid var(--border-color)",
                        borderRadius: 12,
                        padding: 12,
                      }),
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => setDeleteId(sale.id)}
                      aria-label="Supprimer la vente"
                      className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full transition-colors"
                      style={{
                        background: "var(--input-bg)",
                        color: "var(--text-secondary)",
                        border: "none",
                        fontSize: "12px",
                        zIndex: 10,
                      }}
                    >
                      ✕
                    </button>
                    <div className="flex gap-3">
                      <div
                        className="flex shrink-0 items-center justify-center overflow-hidden rounded-xl"
                        style={{ width: "56px", height: "56px", minHeight: "56px", background: "var(--img-container-bg)" }}
                      >
                        {imageUrl ? (
                          <RasterImage
                            src={imageUrl}
                            alt={displayName}
                            loading="lazy"
                            width={56}
                            height={56}
                            className="h-full w-full object-contain"
                            style={{ objectFit: "contain" }}
                          />
                        ) : (
                          <span className="text-lg opacity-60">🎴</span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="app-heading line-clamp-2 text-xs" style={{ color: "var(--text-primary)" }}>
                          {displayName}
                        </p>
                        <p className="mt-0.5 text-[10px]" style={{ color: "var(--text-secondary)" }}>
                          Vendu le{" "}
                          <span className={STAT_CARD_VALUE_CLASS}>{formatSaleDate(sale.saleDate)}</span>
                          {sale.quantity > 1 && (
                            <>
                              {" "}
                              · x<span className={STAT_CARD_VALUE_CLASS}>{sale.quantity}</span>
                            </>
                          )}
                        </p>
                        <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-[10px]">
                          <span style={{ color: "var(--text-secondary)" }}>
                            Achat:{" "}
                            <span className={STAT_CARD_VALUE_CLASS} style={{ color: accentGold }}>
                              {sale.buyPrice.toLocaleString("fr-FR", {
                                style: "currency",
                                currency: "EUR",
                                maximumFractionDigits: 0,
                              })}
                            </span>
                          </span>
                          <span style={{ color: "var(--text-secondary)" }}>
                            Vente:{" "}
                            <span className={STAT_CARD_VALUE_CLASS} style={{ color: accentGold }}>
                              {sale.salePrice.toLocaleString("fr-FR", {
                                style: "currency",
                                currency: "EUR",
                                maximumFractionDigits: 0,
                              })}
                            </span>
                          </span>
                          <span style={{ color: "var(--text-secondary)" }}>
                            Bénéfice:{" "}
                            <span
                              className={STAT_CARD_VALUE_CLASS}
                              style={{
                                color: sale.profit >= 0 ? "var(--gain-green)" : "var(--loss-red)",
                              }}
                            >
                              {sale.profit >= 0 ? "+" : ""}
                              {sale.profit.toLocaleString("fr-FR", {
                                style: "currency",
                                currency: "EUR",
                                maximumFractionDigits: 0,
                              })}
                            </span>
                          </span>
                          <span style={{ color: "var(--text-secondary)" }}>
                            Perf:{" "}
                            <span
                              className={STAT_CARD_VALUE_CLASS}
                              style={{
                                color: perfPct >= 0 ? "var(--gain-green)" : "var(--loss-red)",
                              }}
                            >
                              {perfPct >= 0 ? "+" : ""}
                              {perfPct.toFixed(1)}%
                            </span>
                          </span>
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-col justify-end">
                        <button
                          type="button"
                          onClick={() => openEdit(sale)}
                          className="rounded-lg px-2.5 py-1 text-xs font-semibold transition hover:opacity-90"
                          style={{
                            background: "rgba(250,204,21,0.25)",
                            color: accentGold,
                            border: "1px solid rgba(250,204,21,0.5)",
                          }}
                        >
                          Modifier
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
              {!premiumLoading && !isPremium && sortedSales.length > 5 && (
                <div style={{ position: "relative", marginTop: 8 }}>
                  <div
                    style={{
                      filter: "blur(12px) brightness(0.6)",
                      pointerEvents: "none",
                      userSelect: "none",
                    }}
                  >
                    {sortedSales.slice(5).map((sale) => {
                      const investi = sale.buyPrice * sale.quantity;
                      const perfPct = investi > 0 ? (sale.profit / investi) * 100 : 0;
                      const imageUrl = sale.image ?? sale.imageUrl ?? null;
                      const displayName = (sale.productName ?? "").replace(/ FR$/, "");

                      return (
                        <div
                          key={sale.id}
                          className={isLight ? "relative" : "relative rounded-2xl p-3"}
                          style={{
                            background: "var(--card-color)",
                            boxShadow: "0 2px 12px rgba(0,0,0,0.12)",
                            marginBottom: 12,
                            ...(isLight && {
                              border: "1px solid var(--border-color)",
                              borderRadius: 12,
                              padding: 12,
                            }),
                          }}
                        >
                          <div className="flex gap-3">
                            <div
                              className="flex shrink-0 items-center justify-center overflow-hidden rounded-xl"
                              style={{ width: "56px", height: "56px", minHeight: "56px", background: "var(--img-container-bg)" }}
                            >
                              {imageUrl ? (
                                <RasterImage
                                  src={imageUrl}
                                  alt={displayName}
                                  loading="lazy"
                                  width={56}
                                  height={56}
                                  className="h-full w-full object-contain"
                                />
                              ) : (
                                <span className="text-lg opacity-60">🎴</span>
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="app-heading line-clamp-2 text-xs" style={{ color: "var(--text-primary)" }}>{displayName}</p>
                              <p className="mt-0.5 text-[10px]" style={{ color: "var(--text-secondary)" }}>
                                Vendu le{" "}
                                <span className={STAT_CARD_VALUE_CLASS}>{formatSaleDate(sale.saleDate)}</span>
                                {sale.quantity > 1 && (
                                  <>
                                    {" "}
                                    · x<span className={STAT_CARD_VALUE_CLASS}>{sale.quantity}</span>
                                  </>
                                )}
                              </p>
                              <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-[10px]">
                                <span style={{ color: "var(--text-secondary)" }}>
                                  Achat:{" "}
                                  <span className={STAT_CARD_VALUE_CLASS} style={{ color: accentGold }}>
                                    {sale.buyPrice.toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 })}
                                  </span>
                                </span>
                                <span style={{ color: "var(--text-secondary)" }}>
                                  Vente:{" "}
                                  <span className={STAT_CARD_VALUE_CLASS} style={{ color: accentGold }}>
                                    {sale.salePrice.toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 })}
                                  </span>
                                </span>
                                <span style={{ color: "var(--text-secondary)" }}>
                                  Bénéfice:{" "}
                                  <span
                                    className={STAT_CARD_VALUE_CLASS}
                                    style={{
                                      color: sale.profit >= 0 ? "var(--gain-green)" : "var(--loss-red)",
                                    }}
                                  >
                                    {sale.profit >= 0 ? "+" : ""}
                                    {sale.profit.toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 })}
                                  </span>
                                </span>
                                <span style={{ color: "var(--text-secondary)" }}>
                                  Perf:{" "}
                                  <span
                                    className={STAT_CARD_VALUE_CLASS}
                                    style={{
                                      color: perfPct >= 0 ? "var(--gain-green)" : "var(--loss-red)",
                                    }}
                                  >
                                    {perfPct >= 0 ? "+" : ""}
                                    {perfPct.toFixed(1)}%
                                  </span>
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
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
                        padding: "16px 20px",
                        borderRadius: 16,
                        background: "rgba(0,0,0,0.65)",
                        color: "var(--text-primary)",
                        maxWidth: 280,
                      }}
                    >
                      <p className="text-xs mb-3" style={{ color: "var(--text-secondary)" }}>
                        Débloquez l&apos;historique complet avec Boss Access
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
                </div>
              )}
            </div>
          </section>
        </>
      )}

      {/* Modal Modifier */}
      {editId && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center px-4"
          style={{
            background: "var(--overlay-bg)",
            backdropFilter: "blur(4px)",
          }}
          onClick={() => setEditId(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl p-4 space-y-4"
            style={{
              background: "var(--card-color)",
              boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Modifier la vente</h3>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs" style={{ color: "var(--text-secondary)" }}>Prix d&apos;achat (€)</label>
                <input
                  type="number"
                  inputMode="decimal"
                  value={editBuyPrice}
                  onChange={(e) => setEditBuyPrice(e.target.value)}
                  className={`${STAT_CARD_VALUE_CLASS} w-full rounded-xl px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[var(--text-secondary)]/50`}
                  style={{ background: "var(--input-bg)", color: "var(--text-primary)" }}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs" style={{ color: "var(--text-secondary)" }}>Prix de vente (€)</label>
                <input
                  type="number"
                  inputMode="decimal"
                  value={editSalePrice}
                  onChange={(e) => setEditSalePrice(e.target.value)}
                  className={`${STAT_CARD_VALUE_CLASS} w-full rounded-xl px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[var(--text-secondary)]/50`}
                  style={{ background: "var(--input-bg)", color: "var(--text-primary)" }}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs" style={{ color: "var(--text-secondary)" }}>Date de vente</label>
                <input
                  type="date"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  className={`${STAT_CARD_VALUE_CLASS} w-full rounded-xl px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[var(--text-secondary)]/50`}
                  style={{ background: "var(--input-bg)", color: "var(--text-primary)" }}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setEditId(null)}
                className="flex-1 rounded-xl py-2 text-sm font-medium"
                style={{ background: "var(--input-bg)", color: "var(--text-secondary)" }}
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={saveEdit}
                className="flex-1 rounded-xl py-2 text-sm font-semibold"
                style={{
                  background: "rgba(250,204,21,0.25)",
                  color: accentGold,
                  border: "1px solid rgba(250,204,21,0.5)",
                }}
              >
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Confirmation suppression */}
      {deleteId && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center px-4"
          style={{
            background: "var(--overlay-bg)",
            backdropFilter: "blur(4px)",
          }}
          onClick={() => setDeleteId(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl p-4 space-y-4"
            style={{
              background: "var(--card-color)",
              boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Supprimer cette vente ?</h3>
            <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
              Cette action est irréversible. La vente sera retirée de l&apos;historique.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setDeleteId(null)}
                className="flex-1 rounded-xl py-2 text-sm font-medium"
                style={{ background: "var(--input-bg)", color: "var(--text-secondary)" }}
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                className="flex-1 rounded-xl py-2 text-sm font-semibold"
                style={{
                  background: "rgba(239,68,68,0.3)",
                  color: "var(--loss-red)",
                  border: "1px solid rgba(239,68,68,0.5)",
                }}
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
