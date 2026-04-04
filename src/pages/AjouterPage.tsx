import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import Quagga from "@ericblade/quagga2";
import type { QuaggaJSResultObject } from "@ericblade/quagga2";
import { supabase } from "../lib/supabase";
import {
  removeAccents,
  type ModernBlock,
  type ModernSealedType,
  type PokemonCatalogueItem,
} from "../data/pokemonCatalogue";

const SCAN_CATALOGUE_ITEM_KEY = "pokevault_scan_catalogue_item";

function coerceNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = parseFloat(v.replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function inferBlockFromEraSeries(era: string, series: string): ModernBlock {
  const norm = removeAccents(`${era} ${series}`.toLowerCase());
  if (norm.includes("mega") || norm.includes("mega evolution")) return "Méga Évolution";
  if (norm.includes("epee") || norm.includes("bouclier") || norm.includes("e&b")) {
    return "Épée & Bouclier";
  }
  return "Écarlate & Violet";
}

function inferTypeFromCategory(category: string | null): ModernSealedType {
  const c = (category ?? "").toLowerCase();
  if (c.includes("upc")) return "UPC";
  if (c.includes("display")) return "Display";
  return "ETB";
}

function normalizeReleaseDate(value: unknown): string {
  if (typeof value !== "string" || value.length < 7) return "2024-01";
  const m = value.match(/^(\d{4})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}`;
  return "2024-01";
}

function supabaseRowToCatalogueItem(row: Record<string, unknown>): PokemonCatalogueItem | null {
  const id = row.id != null ? String(row.id) : "";
  if (!id) return null;
  const name =
    typeof row.name === "string" && row.name.trim() ? row.name.trim() : "Produit";
  const era = typeof row.era === "string" ? row.era : "";
  const series = typeof row.series === "string" ? row.series : "";
  const category = typeof row.category === "string" ? row.category : null;
  const block = inferBlockFromEraSeries(era, series);
  const type = inferTypeFromCategory(category);
  const msrp = coerceNumber(row.msrp ?? row.retail_price ?? row.pvc ?? row.retail) ?? 0;
  const market =
    coerceNumber(
      row.current_price ?? row.current_market_price ?? row.currentMarketPrice ?? msrp
    ) ?? 0;
  const seriesTrimmed = series.trim();
  const imageUrl =
    seriesTrimmed !== ""
      ? `/images/etb/${seriesTrimmed}.webp`
      : typeof row.image_url === "string"
        ? row.image_url
        : typeof row.imageUrl === "string"
          ? row.imageUrl
          : null;
  const releaseDate = normalizeReleaseDate(row.release_date ?? row.releaseDate);
  const etbIdRaw = row.etb_id ?? row.etbId;
  const etbId =
    typeof etbIdRaw === "string" && etbIdRaw.trim() ? etbIdRaw.trim() : undefined;
  return {
    id,
    name,
    block,
    type,
    releaseDate,
    msrp: msrp >= 0 ? msrp : 0,
    currentMarketPrice: market >= 0 ? market : 0,
    imageUrl,
    emoji: "📦",
    etbId,
  };
}

async function fetchCatalogueItemByBarcode(code: string): Promise<PokemonCatalogueItem | null> {
  const { data, error } = await supabase.from("products").select("*").eq("barcode", code);
  if (error || data == null) return null;
  const row = Array.isArray(data) ? data[0] : data;
  if (row == null) return null;
  return supabaseRowToCatalogueItem(row as Record<string, unknown>);
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

export const AjouterPage = () => {
  const navigate = useNavigate();
  const quaggaTargetRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const onDetectedRef = useRef<((r: QuaggaJSResultObject) => void) | null>(null);
  const scanBusy = useRef(false);

  const [scannerOpen, setScannerOpen] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [notFoundModalOpen, setNotFoundModalOpen] = useState(false);

  const processDetectedCode = useCallback(
    async (code: string) => {
      const trimmed = code.trim().replace(/\s/g, "");
      if (!trimmed) {
        setNotFoundModalOpen(true);
        return;
      }

      const found = await fetchCatalogueItemByBarcode(trimmed);
      if (!found) {
        setNotFoundModalOpen(true);
        return;
      }

      try {
        sessionStorage.setItem(SCAN_CATALOGUE_ITEM_KEY, JSON.stringify(found));
      } catch {
        setNotFoundModalOpen(true);
        return;
      }

      navigate("/ajouter?fromScan=1");
    },
    [navigate]
  );

  const stopMediaStream = useCallback(() => {
    mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
    mediaStreamRef.current = null;
    const v = videoRef.current;
    if (v) {
      v.srcObject = null;
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
      /* ignore */
    }
    stopMediaStream();
  }, [stopMediaStream]);

  const closeScanner = useCallback(async () => {
    await stopQuagga();
    setScannerOpen(false);
    setIsStarting(false);
    scanBusy.current = false;
  }, [stopQuagga]);

  useEffect(() => {
    return () => {
      void stopQuagga();
    };
  }, [stopQuagga]);

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
        showDebugError("Élément vidéo introuvable.", setScanError);
        await closeScanner();
        return;
      }

      video.srcObject = stream;
      video.muted = true;
      video.playsInline = true;
      await video.play();

      const target = quaggaTargetRef.current;
      if (!target) {
        stopMediaStream();
        showDebugError("Conteneur de scan introuvable.", setScanError);
        await closeScanner();
        return;
      }

      stream.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
      video.srcObject = null;

      let handled = false;
      const onDetected = (data: QuaggaJSResultObject) => {
        if (handled) return;
        if (!isHighConfidenceScan(data)) return;
        const raw = data.codeResult?.code;
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

  const darkButtonStyle: CSSProperties = {
    display: "block",
    width: "100%",
    maxWidth: 420,
    margin: "0 auto",
    padding: "18px 24px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.12)",
    cursor: isStarting || scannerOpen ? "wait" : "pointer",
    fontSize: 17,
    fontWeight: 600,
    background: "var(--card-color, #1f1f1f)",
    color: "var(--text-primary, #fafafa)",
    boxShadow: "0 4px 24px rgba(0,0,0,0.35)",
    opacity: isStarting || scannerOpen ? 0.75 : 1,
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
        Appuyez sur Scanner : flux caméra en direct et détection EAN-13 (Quagga2). Contexte sécurisé
        recommandé (ex. iosScheme https côté Capacitor).
      </p>

      <button
        type="button"
        disabled={isStarting || scannerOpen}
        onClick={() => void runBarcodeScan()}
        style={darkButtonStyle}
      >
        Scanner
      </button>

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
                background: "rgba(0,0,0,0.82)",
                color: "#ffffff",
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

      {isStarting ? (
        <div
          style={{
            textAlign: "center",
            padding: 24,
            color: "var(--text-primary)",
            fontSize: 15,
          }}
        >
          Démarrage de la caméra…
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
