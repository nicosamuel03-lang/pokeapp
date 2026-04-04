import { useCallback, useEffect, useRef, useState } from "react";
import type { ChangeEvent, CSSProperties } from "react";
import { Capacitor } from "@capacitor/core";
import {
  BarcodeScanner,
  BarcodeFormat,
  type Barcode,
} from "@capacitor-mlkit/barcode-scanning";
import {
  BarcodeFormat as ZxBarcodeFormat,
  BrowserMultiFormatReader,
  DecodeHintType,
} from "@zxing/library";
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

function barcodeToEanString(barcode: Barcode): string {
  const raw = (barcode.rawValue ?? barcode.displayValue ?? "").trim();
  return raw.replace(/\s/g, "");
}

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

/** Évite un double lancement auto du scan en React StrictMode (remontage). */
let autoNativeBarcodeScanLaunched = false;

export const AjouterPage = () => {
  const { addToCollection } = useCollection();
  const inputRef = useRef<HTMLInputElement>(null);
  const scanBusy = useRef(false);

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [product, setProduct] = useState<ScannedProduct | null>(null);
  const [successModalOpen, setSuccessModalOpen] = useState(false);
  const [notFoundModalOpen, setNotFoundModalOpen] = useState(false);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const clearPreview = () => {
    setPreviewUrl(null);
  };

  const processEanCode = useCallback(async (code: string) => {
    const trimmed = code.trim();
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

  const openMlKitScanner = useCallback(async () => {
    if (scanBusy.current) return;
    scanBusy.current = true;
    setIsAnalyzing(true);
    setNotFoundModalOpen(false);

    try {
      const perm = await BarcodeScanner.requestPermissions();
      if (perm.camera !== "granted" && perm.camera !== "limited") {
        return;
      }

      const { barcodes } = await BarcodeScanner.scan({
        formats: [BarcodeFormat.Ean13],
        autoZoom: true,
      });

      const eanBarcode =
        barcodes.find((b) => b.format === BarcodeFormat.Ean13) ?? barcodes[0];
      const ean = eanBarcode ? barcodeToEanString(eanBarcode) : "";

      if (!ean) {
        return;
      }

      await processEanCode(ean);
    } catch {
      /* annulation utilisateur ou indisponibilité */
    } finally {
      setIsAnalyzing(false);
      scanBusy.current = false;
    }
  }, [processEanCode]);

  const openScanner = useCallback(async () => {
    if (Capacitor.isNativePlatform()) {
      await openMlKitScanner();
      return;
    }

    try {
      const { supported } = await BarcodeScanner.isSupported();
      if (supported) {
        await openMlKitScanner();
        return;
      }
    } catch {
      /* fallback fichier */
    }

    inputRef.current?.click();
  }, [openMlKitScanner]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform() || autoNativeBarcodeScanLaunched) return;
    autoNativeBarcodeScanLaunched = true;
    const id = window.setTimeout(() => {
      void openMlKitScanner();
    }, 400);
    return () => clearTimeout(id);
  }, [openMlKitScanner]);

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setPreviewUrl(URL.createObjectURL(file));

    setIsAnalyzing(true);
    setNotFoundModalOpen(false);

    const hints = new Map();
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [
      ZxBarcodeFormat.EAN_13,
      ZxBarcodeFormat.EAN_8,
      ZxBarcodeFormat.UPC_A,
      ZxBarcodeFormat.UPC_E,
    ]);
    hints.set(DecodeHintType.TRY_HARDER, true);
    const reader = new BrowserMultiFormatReader(hints);

    const objectUrl = URL.createObjectURL(file);
    let decodeObjectUrlRevoked = false;

    try {
      const result = await reader.decodeFromImageUrl(objectUrl);
      URL.revokeObjectURL(objectUrl);
      decodeObjectUrlRevoked = true;

      const code = result.getText().trim();
      await processEanCode(code);
    } catch (err) {
      console.log("ZXing error:", err);
      if (!decodeObjectUrlRevoked) URL.revokeObjectURL(objectUrl);
      setNotFoundModalOpen(true);
    } finally {
      setIsAnalyzing(false);
    }
  };

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
        {Capacitor.isNativePlatform()
          ? "La caméra s’ouvre pour lire le code EAN-13. Vous pouvez aussi relancer le scan ci-dessous."
          : "Prenez une photo nette du code-barres du produit, ou utilisez le scan si votre navigateur le permet."}
      </p>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: "none" }}
        onChange={handleFileChange}
      />

      <button
        type="button"
        disabled={isAnalyzing}
        onClick={() => void openScanner()}
        style={darkButtonStyle}
      >
        📷 Prendre une photo
      </button>

      {previewUrl ? (
        <div
          style={{
            width: "100%",
            maxWidth: 420,
            margin: "20px auto 0",
            borderRadius: 12,
            overflow: "hidden",
            border: "1px solid var(--border-color, rgba(255,255,255,0.08))",
            background: "#000",
          }}
        >
          <img
            src={previewUrl}
            alt="Aperçu de la photo"
            style={{
              display: "block",
              width: "100%",
              height: "auto",
              verticalAlign: "top",
            }}
          />
        </div>
      ) : null}

      {isAnalyzing ? (
        <div
          style={{
            textAlign: "center",
            padding: 24,
            color: "var(--text-primary)",
            fontSize: 15,
          }}
        >
          Analyse en cours...
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
                clearPreview();
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
              onClick={() => {
                setNotFoundModalOpen(false);
                clearPreview();
              }}
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
