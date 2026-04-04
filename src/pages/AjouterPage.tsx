import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import Quagga from "@ericblade/quagga2";
import type { QuaggaJSResultObject } from "@ericblade/quagga2";
import { supabase } from "../lib/supabase";
import { useCollection } from "../state/CollectionContext";
import type { Product } from "../state/ProductsContext";

type ScannedProduct = {
  name: string | null;
  series: string | null;
  era: string | null;
  category: string | null;
  id: string;
  imageUrl?: string | null;
  currentPrice?: number | null;
};

function rowToProduct(row: ScannedProduct): Product {
  const price = Number(row.currentPrice);
  const currentPrice = Number.isFinite(price) && price >= 0 ? price : 0;
  return {
    id: row.id,
    name: row.name ?? "Produit",
    emoji: "📦",
    category: (row.category as Product["category"]) || "UPC",
    set: row.series ?? "",
    condition: "Neuf scellé",
    currentPrice,
    change30dPercent: 0,
    badge: row.era ?? row.category ?? "",
    createdAt: Date.now(),
    imageUrl: row.imageUrl ?? undefined,
  };
}

async function fetchProductByEan(code: string): Promise<ScannedProduct | null> {
  const { data, error } = await supabase
    .from("products")
    .select("id, name, series, era, category, ean")
    .eq("ean", code)
    .maybeSingle();

  if (error || !data) return null;

  const r = data as Record<string, unknown>;
  const id = r.id != null ? String(r.id) : "";
  if (!id) return null;

  return {
    id,
    name: (r.name as string) ?? null,
    series: (r.series as string) ?? null,
    era: (r.era as string) ?? null,
    category: (r.category as string) ?? null,
  };
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

export const AjouterPage = () => {
  const { addToCollection } = useCollection();
  const quaggaTargetRef = useRef<HTMLDivElement>(null);
  const onDetectedRef = useRef<((r: QuaggaJSResultObject) => void) | null>(null);
  const scanBusy = useRef(false);

  const [scannerOpen, setScannerOpen] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [product, setProduct] = useState<ScannedProduct | null>(null);
  const [successModalOpen, setSuccessModalOpen] = useState(false);
  const [notFoundModalOpen, setNotFoundModalOpen] = useState(false);

  const processEanCode = useCallback(async (code: string) => {
    const trimmed = code.trim().replace(/\s/g, "");
    if (!trimmed) {
      setNotFoundModalOpen(true);
      return;
    }

    const found = await fetchProductByEan(trimmed);
    if (!found) {
      setNotFoundModalOpen(true);
      return;
    }

    setProduct(found);
    setSuccessModalOpen(true);
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
  }, []);

  const closeScanner = useCallback(async () => {
    await stopQuagga();
    setScannerOpen(false);
    setIsAnalyzing(false);
    scanBusy.current = false;
  }, [stopQuagga]);

  useEffect(() => {
    return () => {
      void stopQuagga();
    };
  }, [stopQuagga]);

  const runBarcodeScan = useCallback(async () => {
    if (scanBusy.current) {
      const msg = "Un scan est déjà en cours.";
      showDebugError(msg, setScanError);
      return;
    }
    scanBusy.current = true;
    setIsAnalyzing(true);
    setScanError(null);
    setNotFoundModalOpen(false);

    try {
      try {
        const probe = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        probe.getTracks().forEach((t) => t.stop());
      } catch (e) {
        const msg = `Caméra : ${formatUnknownError(e)}`;
        showDebugError(msg, setScanError);
        scanBusy.current = false;
        setIsAnalyzing(false);
        return;
      }

      setScannerOpen(true);
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      });

      const target = quaggaTargetRef.current;
      if (!target) {
        showDebugError("Conteneur de scan introuvable.", setScanError);
        await closeScanner();
        return;
      }

      const onDetected = (data: QuaggaJSResultObject) => {
        const code = data.codeResult?.code;
        if (code == null || String(code).trim() === "") return;

        void (async () => {
          await stopQuagga();
          setScannerOpen(false);
          setIsAnalyzing(false);
          scanBusy.current = false;
          await processEanCode(String(code));
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
                width: { min: 640 },
                height: { min: 480 },
                facingMode: "environment",
              },
            },
            locator: { patchSize: "medium", halfSample: true },
            frequency: 8,
            decoder: {
              readers: ["ean_reader"],
            },
            numOfWorkers: 0,
            locate: true,
          },
          (err) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });

      Quagga.start();
      setIsAnalyzing(false);
    } catch (e) {
      const msg = `Scanner : ${formatUnknownError(e)}`;
      showDebugError(msg, setScanError);
      await stopQuagga();
      setScannerOpen(false);
      setIsAnalyzing(false);
      scanBusy.current = false;
    }
  }, [closeScanner, processEanCode, stopQuagga]);

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

  const labelStyle: CSSProperties = {
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    color: "var(--text-secondary, #9ca3af)",
    marginBottom: 4,
  };

  const darkButtonStyle: CSSProperties = {
    display: "block",
    width: "100%",
    maxWidth: 420,
    margin: "0 auto",
    padding: "18px 24px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.12)",
    cursor: isAnalyzing ? "wait" : "pointer",
    fontSize: 17,
    fontWeight: 600,
    background: "var(--card-color, #1f1f1f)",
    color: "var(--text-primary, #fafafa)",
    boxShadow: "0 4px 24px rgba(0,0,0,0.35)",
    opacity: isAnalyzing ? 0.75 : 1,
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
        Appuyez sur Scanner : la caméra lit le code EAN-13 en direct dans le navigateur (Quagga2).
      </p>

      <button
        type="button"
        disabled={isAnalyzing}
        onClick={() => void runBarcodeScan()}
        style={darkButtonStyle}
      >
        Scanner
      </button>

      {scannerOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Scanner code-barres"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 100,
            background: "#000",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div
            ref={quaggaTargetRef}
            style={{
              flex: 1,
              minHeight: 0,
              width: "100%",
              position: "relative",
            }}
          >
            <video
              playsInline
              muted
              autoPlay
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "cover",
              }}
            />
          </div>
          <button
            type="button"
            onClick={() => void closeScanner()}
            style={{
              flexShrink: 0,
              margin: 12,
              padding: "14px 20px",
              borderRadius: 12,
              border: "none",
              fontSize: 16,
              fontWeight: 600,
              background: "rgba(255,255,255,0.15)",
              color: "#fff",
              cursor: "pointer",
            }}
          >
            Fermer
          </button>
        </div>
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

      {isAnalyzing && !scannerOpen ? (
        <div
          style={{
            textAlign: "center",
            padding: 24,
            color: "var(--text-primary)",
            fontSize: 15,
          }}
        >
          Ouverture de la caméra…
        </div>
      ) : null}

      {successModalOpen && product ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="ajouter-success-title"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 60,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
            background: "rgba(0,0,0,0.72)",
          }}
        >
          <div style={cardStyle}>
            <h2
              id="ajouter-success-title"
              style={{
                margin: "0 0 16px",
                fontSize: 17,
                color: "var(--text-primary)",
              }}
            >
              Produit trouvé
            </h2>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 12,
                marginBottom: 20,
              }}
            >
              <div>
                <div style={labelStyle}>Nom</div>
                <div style={{ fontSize: 15, color: "var(--text-primary)" }}>
                  {product.name ?? "—"}
                </div>
              </div>
              <div>
                <div style={labelStyle}>Série</div>
                <div style={{ fontSize: 15, color: "var(--text-primary)" }}>
                  {product.series ?? "—"}
                </div>
              </div>
              <div>
                <div style={labelStyle}>Ère</div>
                <div style={{ fontSize: 15, color: "var(--text-primary)" }}>
                  {product.era ?? "—"}
                </div>
              </div>
              <div>
                <div style={labelStyle}>Catégorie</div>
                <div style={{ fontSize: 15, color: "var(--text-primary)" }}>
                  {product.category ?? "—"}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                addToCollection(rowToProduct(product));
                setSuccessModalOpen(false);
              }}
              style={{
                width: "100%",
                padding: "12px 16px",
                borderRadius: 12,
                border: "none",
                cursor: "pointer",
                fontSize: 14,
                fontWeight: 600,
                background: "#D4A757",
                color: "#111827",
              }}
            >
              Ajouter à ma collection
            </button>
          </div>
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
            zIndex: 60,
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
