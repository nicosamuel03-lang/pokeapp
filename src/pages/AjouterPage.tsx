import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import Quagga from "@ericblade/quagga2";
import type { QuaggaJSResultObject } from "@ericblade/quagga2";
import { supabase } from "../lib/supabase";
import {
  removeAccents,
  searchPokemonCatalogue,
  type PokemonCatalogueItem,
} from "../data/pokemonCatalogue";

function resolveEtbIdFromProductsRow(row: Record<string, unknown>): string | undefined {
  for (const key of [
    "etb_id",
    "etbId",
    "code",
    "set_code",
    "product_code",
    "set_id",
  ] as const) {
    const v = row[key];
    if (typeof v === "string" && /^(?:EB|EV|ME|SL)\d{2}(?:\.\d)?$/i.test(v.trim())) {
      return v.trim().toUpperCase();
    }
  }
  const name = typeof row.name === "string" ? row.name : "";
  const m = name.match(/\b((?:EB|EV|ME|SL)\d{2}(?:\.\d)?)\b/i);
  if (m) return m[1]!.toUpperCase();
  return undefined;
}

function findCatalogueEtbItem(etbId: string, seriesHint: string): PokemonCatalogueItem | undefined {
  const full = searchPokemonCatalogue("") ?? [];
  const candidates = full.filter((i) => i.type === "ETB" && i.etbId === etbId);
  if (candidates.length <= 1) return candidates[0];
  const hint = removeAccents(seriesHint.trim().toLowerCase());
  if (!hint) return candidates[0];
  return (
    candidates.find((i) => removeAccents(i.name.toLowerCase()).includes(hint)) ?? candidates[0]
  );
}

/**
 * Même liste que la page d’ajout manuel : retrouver l’entrée catalogue (ETB / Display / UPC)
 * à partir de la ligne Supabase `products` (série, nom, code set).
 */
function findLocalCatalogueMatchFromProductsRow(row: Record<string, unknown>): PokemonCatalogueItem | undefined {
  const series = typeof row.series === "string" ? row.series.trim() : "";
  const name = typeof row.name === "string" ? row.name.trim() : "";
  const full = searchPokemonCatalogue("") ?? [];
  const etbId = resolveEtbIdFromProductsRow(row);

  if (etbId) {
    const byEtb = findCatalogueEtbItem(etbId, series);
    if (byEtb) return byEtb;
    const anyWithCode = full.find((i) => i.etbId === etbId);
    if (anyWithCode) return anyWithCode;
  }

  if (series) {
    const sNorm = removeAccents(series.toLowerCase());
    const words = sNorm.split(/\s+/).filter((w) => w.length > 2);
    const bySeries = full.filter((i) => {
      const n = removeAccents(i.name.toLowerCase());
      if (n.includes(sNorm)) return true;
      return words.length > 0 && words.every((w) => n.includes(w));
    });
    if (bySeries.length === 1) return bySeries[0];
    if (bySeries.length > 1) {
      if (etbId) {
        const narrowed = bySeries.filter((i) => i.etbId === etbId);
        if (narrowed.length >= 1) return narrowed[0];
      }
      const etbOnly = bySeries.filter((i) => i.type === "ETB");
      if (etbOnly.length >= 1) return etbOnly[0];
      return bySeries[0];
    }
  }

  if (name) {
    const tokens = removeAccents(name.toLowerCase())
      .replace(/^etb\s+/i, "")
      .replace(/^display\s+/i, "")
      .replace(/^upc\s+/i, "")
      .split(/\s+/)
      .filter((t) => t.length > 3);
    if (tokens.length > 0) {
      const scored = full
        .map((i) => {
          const n = removeAccents(i.name.toLowerCase());
          const hits = tokens.filter((t) => n.includes(t)).length;
          return { i, hits };
        })
        .filter((x) => x.hits > 0)
        .sort((a, b) => b.hits - a.hits);
      if (scored.length === 1) return scored[0].i;
      if (scored.length > 1 && scored[0].hits > scored[1].hits) return scored[0].i;
    }
  }

  return undefined;
}

/** Paramètre `item` attendu par SearchCatalogue (identique à la navigation depuis la fiche produit). */
function catalogueItemToItemQueryParam(item: PokemonCatalogueItem): string {
  return item.etbId ?? item.id;
}

async function fetchProductsRowByBarcode(code: string): Promise<Record<string, unknown> | null> {
  const { data, error } = await supabase.from("products").select("*").eq("barcode", code);
  if (error || data == null) return null;
  const row = Array.isArray(data) ? data[0] : data;
  return row != null ? (row as Record<string, unknown>) : null;
}

function formatUnknownError(err: unknown): string {
  if (err instanceof Error) return err.message || String(err);
  if (typeof err === "string") return err;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

function showDebugError(message: string, setScanError: (s: string | null) => void) {
  setScanError(message);
  try {
    window.alert(message);
  } catch {
    /* ignore */
  }
}

/** Quagga : lecture fiable uniquement si erreur de décodage faible. */
function isHighConfidenceScan(data: QuaggaJSResultObject): boolean {
  const code = data.codeResult?.code;
  if (code == null || String(code).trim() === "") return false;
  const err = data.codeResult?.startInfo?.error;
  return typeof err === "number" && err < 0.1;
}

type AjouterPageProps = {
  /** Appelé quand l’utilisateur ferme le scanner (Fermer) — ex. retour au catalogue inline. */
  onScannerClosedByUser?: () => void;
};

export const AjouterPage = ({ onScannerClosedByUser }: AjouterPageProps) => {
  const navigate = useNavigate();
  const quaggaTargetRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const onDetectedRef = useRef<((r: QuaggaJSResultObject) => void) | null>(null);
  const scanBusy = useRef(false);

  const [scannerOpen, setScannerOpen] = useState(true);
  const [isStarting, setIsStarting] = useState(true);
  const [scanError, setScanError] = useState<string | null>(null);
  const [notFoundModalOpen, setNotFoundModalOpen] = useState(false);
  const [scanHintVisible, setScanHintVisible] = useState(true);

  const processDetectedCode = useCallback(
    async (code: string) => {
      const trimmed = code.trim().replace(/\s/g, "");
      if (!trimmed) {
        setNotFoundModalOpen(true);
        return;
      }

      const productsRow = await fetchProductsRowByBarcode(trimmed);
      if (!productsRow) {
        setNotFoundModalOpen(true);
        return;
      }

      const catalogueMatch = findLocalCatalogueMatchFromProductsRow(productsRow);
      if (!catalogueMatch) {
        setNotFoundModalOpen(true);
        return;
      }

      const itemParam = catalogueItemToItemQueryParam(catalogueMatch);
      navigate(`/ajouter?item=${encodeURIComponent(itemParam)}`);
    },
    [navigate]
  );

  const stopMediaStream = useCallback(() => {
    try {
      mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
    } catch {
      /* flux / élément vidéo déjà démonté */
    }
    mediaStreamRef.current = null;
    try {
      const v = videoRef.current;
      if (v) {
        v.srcObject = null;
      }
    } catch {
      /* vidéo absente ou plus dans le DOM */
    }
  }, []);

  const stopQuagga = useCallback(async () => {
    const handler = onDetectedRef.current;
    if (handler) {
      try {
        Quagga.offDetected(handler);
      } catch {
        /* ignore */
      }
      onDetectedRef.current = null;
    }
    try {
      await Quagga.stop();
    } catch {
      /* Quagga / vidéo déjà détruits (navigation, démontage) */
    }
    stopMediaStream();
  }, [stopMediaStream]);

  const closeScanner = useCallback(async () => {
    await stopQuagga();
    setScannerOpen(false);
    setIsStarting(false);
    scanBusy.current = false;
    onScannerClosedByUser?.();
  }, [stopQuagga, onScannerClosedByUser]);

  const runBarcodeScan = useCallback(async () => {
    if (scanBusy.current) {
      showDebugError("Un scan est déjà en cours.", setScanError);
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      showDebugError("getUserMedia n’est pas disponible sur cet appareil.", setScanError);
      return;
    }

    scanBusy.current = true;
    setIsStarting(true);
    setScanHintVisible(true);
    setScanError(null);
    setNotFoundModalOpen(false);
    setScannerOpen(true);

    try {
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      });

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      mediaStreamRef.current = stream;

      const video = videoRef.current;
      if (!video) {
        stopMediaStream();
        try {
          await stopQuagga();
        } catch {
          /* ignore */
        }
        setScannerOpen(false);
        setIsStarting(false);
        scanBusy.current = false;
        return;
      }

      video.srcObject = stream;
      video.muted = true;
      video.playsInline = true;
      await video.play();

      const target = quaggaTargetRef.current;
      if (!target) {
        stopMediaStream();
        try {
          await stopQuagga();
        } catch {
          /* ignore */
        }
        setScannerOpen(false);
        setIsStarting(false);
        scanBusy.current = false;
        return;
      }

      stream.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
      video.srcObject = null;

      let handled = false;
      const onDetected = (data: QuaggaJSResultObject) => {
        if (handled) return;
        const raw = data.codeResult?.code;
        if (raw != null && String(raw).trim() !== "") {
          setScanHintVisible(false);
        }
        if (!isHighConfidenceScan(data)) return;
        if (raw == null || String(raw).trim() === "") return;
        handled = true;

        void (async () => {
          await stopQuagga();
          setScannerOpen(false);
          setIsStarting(false);
          scanBusy.current = false;
          await processDetectedCode(String(raw));
        })();
      };
      onDetectedRef.current = onDetected;
      Quagga.onDetected(onDetected);

      await new Promise<void>((resolve, reject) => {
        void Quagga.init(
          {
            inputStream: {
              type: "LiveStream",
              target,
              constraints: {
                facingMode: "environment",
                width: { ideal: 1280 },
                height: { ideal: 720 },
              },
              area: {
                top: "30%",
                right: "10%",
                left: "10%",
                bottom: "30%",
                borderColor: "rgba(212, 167, 87, 0.85)",
                borderWidth: 2,
              },
            },
            decoder: {
              readers: ["ean_reader"],
              multiple: false,
            },
            locate: true,
            frequency: 10,
            locator: { patchSize: "medium", halfSample: true },
            numOfWorkers: 0,
          },
          (err) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });

      Quagga.start();
      setIsStarting(false);
    } catch (e) {
      const msg = `Caméra / scanner : ${formatUnknownError(e)}`;
      showDebugError(msg, setScanError);
      await stopQuagga();
      setScannerOpen(false);
      setIsStarting(false);
      scanBusy.current = false;
    }
  }, [closeScanner, processDetectedCode, stopMediaStream, stopQuagga]);

  useEffect(() => {
    void runBarcodeScan();
    return () => {
      scanBusy.current = false;
      void stopQuagga();
    };
  }, [runBarcodeScan, stopQuagga]);

  const cardStyle: CSSProperties = {
    background: "var(--card-color, #1a1a1a)",
    border: "1px solid var(--border-color, rgba(255,255,255,0.08))",
    borderRadius: 16,
    padding: 20,
    color: "var(--text-primary, #f5f5f5)",
    maxWidth: 400,
    width: "100%",
    margin: "0 auto",
  };

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
        padding: "56px 16px 24px",
        background: "var(--bg-app, #0a0a0a)",
        color: "var(--text-secondary, #9ca3af)",
        overflowY: "auto",
      }}
    >
      <h1
        style={{
          fontSize: 18,
          fontWeight: 700,
          color: "var(--text-primary, #fafafa)",
          margin: "0 0 8px",
          textAlign: "center",
        }}
      >
        Scanner un code-barres
      </h1>
      <p
        style={{
          fontSize: 13,
          textAlign: "center",
          margin: "0 0 20px",
          lineHeight: 1.45,
        }}
      >
        La caméra démarre automatiquement : détection EAN-13 (Quagga2). Contexte sécurisé recommandé (ex.
        iosScheme https côté Capacitor).
      </p>

      {scannerOpen ? (
        <>
          <style>{`
            #scanner-container {
              position: relative;
              flex: 1;
              min-height: 0;
              width: 100%;
              overflow: hidden;
              background: #000;
            }
            #scanner-container video {
              position: absolute;
              inset: 0;
              width: 100%;
              height: 100%;
              object-fit: cover;
              z-index: 0;
            }
            .scanner-zone-overlay {
              position: absolute;
              top: 30%;
              right: 10%;
              left: 10%;
              bottom: 30%;
              z-index: 2;
              pointer-events: none;
              border: 3px solid rgba(212, 167, 87, 0.95);
              border-radius: 10px;
              box-shadow:
                0 0 0 1px rgba(0, 0, 0, 0.5) inset,
                0 0 20px rgba(212, 167, 87, 0.35);
            }
            .scanner-zone-message-wrap {
              position: absolute;
              top: 30%;
              right: 10%;
              left: 10%;
              bottom: 30%;
              z-index: 3;
              pointer-events: none;
              display: flex;
              align-items: center;
              justify-content: center;
            }
          `}</style>
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Scanner code-barres"
            className="pokevault-scanner-shell"
            style={{
              position: "fixed",
              inset: 0,
              width: "100vw",
              height: "100vh",
              maxHeight: "100dvh",
              zIndex: 9999,
              background: "#000",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div
              id="scanner-container"
              ref={quaggaTargetRef}
            >
              <video
                ref={videoRef}
                playsInline
                muted
                autoPlay
              />
              <div className="scanner-zone-overlay" aria-hidden />
              {!isStarting && scanHintVisible ? (
                <div className="scanner-zone-message-wrap" role="status">
                  <span
                    style={{
                      color: "#ffffff",
                      fontSize: 16,
                      fontWeight: 700,
                      textAlign: "center",
                      textShadow: "0 1px 4px rgba(0,0,0,0.8)",
                    }}
                  >
                    Scannez le code-barres de l&apos;item
                  </span>
                </div>
              ) : null}
              {isStarting ? (
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    zIndex: 3,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "rgba(0,0,0,0.55)",
                    color: "#ffffff",
                    fontSize: 17,
                    fontWeight: 600,
                    pointerEvents: "none",
                  }}
                >
                  Démarrage de la caméra…
                </div>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => void closeScanner()}
              style={{
                position: "absolute",
                top: "max(16px, env(safe-area-inset-top, 16px))",
                right: "max(16px, env(safe-area-inset-right, 16px))",
                zIndex: 10001,
                padding: "14px 22px",
                borderRadius: 14,
                border: "2px solid rgba(255,255,255,0.95)",
                fontSize: 16,
                fontWeight: 700,
                letterSpacing: "0.02em",
                background: "transparent",
                color: "#ffffff",
                textShadow: "0 1px 4px rgba(0,0,0,0.8)",
                cursor: "pointer",
                boxShadow: "0 4px 20px rgba(0,0,0,0.55), 0 0 0 1px rgba(212,167,87,0.4)",
              }}
            >
              Fermer
            </button>
          </div>
        </>
      ) : null}

      {scanError ? (
        <div
          role="alert"
          style={{
            marginTop: 16,
            maxWidth: 420,
            marginLeft: "auto",
            marginRight: "auto",
            padding: 14,
            borderRadius: 12,
            background: "rgba(220, 38, 38, 0.15)",
            border: "1px solid rgba(248, 113, 113, 0.45)",
            color: "#fecaca",
            fontSize: 13,
            lineHeight: 1.45,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          {scanError}
        </div>
      ) : null}

      {notFoundModalOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="ajouter-notfound-title"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 160,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
            background: "rgba(0,0,0,0.72)",
          }}
        >
          <div style={cardStyle}>
            <h2
              id="ajouter-notfound-title"
              style={{
                margin: "0 0 20px",
                fontSize: 17,
                color: "var(--text-primary)",
              }}
            >
              Produit non reconnu
            </h2>
            <button
              type="button"
              onClick={() => setNotFoundModalOpen(false)}
              style={{
                width: "100%",
                padding: "12px 16px",
                borderRadius: 12,
                border: "1px solid var(--border-color, rgba(255,255,255,0.15))",
                cursor: "pointer",
                fontSize: 14,
                fontWeight: 600,
                background: "transparent",
                color: "var(--text-primary)",
              }}
            >
              Fermer
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
};
