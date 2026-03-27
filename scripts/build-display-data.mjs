import fs from "node:fs";
import path from "node:path";
import XLSX from "xlsx";

const displayXlsxPath = path.join(process.cwd(), "pokedisplay.xlsx");
const upcXlsxPath = path.join(process.cwd(), "pokeupc.xlsx");

const MONTHS_2026 = [
  { label: "Janvier 2026", iso: "2026-01" },
  { label: "Février 2026", iso: "2026-02" },
  { label: "Mars 2026", iso: "2026-03" },
  { label: "Avril 2026", iso: "2026-04" },
  { label: "Mai 2026", iso: "2026-05" },
  { label: "Juin 2026", iso: "2026-06" },
  { label: "Juillet 2026", iso: "2026-07" },
  { label: "Août 2026", iso: "2026-08" },
  { label: "Septembre 2026", iso: "2026-09" },
  { label: "Octobre 2026", iso: "2026-10" },
  { label: "Novembre 2026", iso: "2026-11" },
  { label: "Décembre 2026", iso: "2026-12" },
];

function excelDateToRelease(dateSortie) {
  const s = String(dateSortie ?? "").trim();
  const parts = s.split("/");
  if (parts.length === 3) {
    const [dd, mm, yyyy] = parts;
    if (yyyy && mm) return `${yyyy}-${String(mm).padStart(2, "0")}`;
  }
  // Déjà au format YYYY-MM ?
  if (/^\d{4}-\d{2}/.test(s)) return s.slice(0, 7);
  return "";
}

function findHeaderRowIndex(rows) {
  return rows.findIndex((r) => {
    const cells = (Array.isArray(r) ? r : []).map((c) =>
      String(c ?? "").trim().toLowerCase()
    );
    return (
      cells.some((c) => c === "bloc" || c.includes("bloc")) &&
      cells.some((c) => c === "code" || c.includes("code")) &&
      cells.some((c) => c.includes("extension") || c.includes("nom"))
    );
  });
}

/** UPC sheet: Bloc, Code, Nom, Date, PVC (+ optional month columns) */
function findUpcHeaderRowIndex(rows) {
  return rows.findIndex((r) => {
    const cells = (Array.isArray(r) ? r : []).map((c) =>
      String(c ?? "").trim().toLowerCase()
    );
    return (
      cells.some((c) => c === "bloc" || c.includes("bloc")) &&
      cells.some((c) => c === "code" || c.includes("code")) &&
      cells.some((c) => c === "nom" || c.includes("nom"))
    );
  });
}

function findCol(header, ...keywords) {
  const kws = keywords.map((k) => k.toLowerCase());
  return header.findIndex((h) => {
    const t = String(h ?? "").trim().toLowerCase();
    return kws.some((k) => t.includes(k));
  });
}

function detectImageUrlCol(rows, startIndex, sampleSize = 30) {
  const counts = {};
  const sample = rows.slice(startIndex, startIndex + sampleSize);
  for (const r of sample) {
    const row = Array.isArray(r) ? r : [];
    for (let i = 0; i < row.length; i += 1) {
      const v = String(row[i] ?? "").trim();
      if (v.startsWith("http")) counts[i] = (counts[i] ?? 0) + 1;
    }
  }
  const entries = Object.entries(counts).sort((a, b) => Number(b[1]) - Number(a[1]));
  return entries.length ? Number(entries[0][0]) : 19;
}

function parseUpcData() {
  if (!fs.existsSync(upcXlsxPath)) {
    console.log(`ℹ️  Fichier UPC non trouvé : ${path.basename(upcXlsxPath)} — ignoré`);
    return [];
  }

  const wb = XLSX.readFile(upcXlsxPath);
  const sheetNames = wb.SheetNames || [];
  if (!sheetNames.length) return [];

  const ws = wb.Sheets[sheetNames[0]];
  const rawRows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
  if (!rawRows.length) return [];

  const headerRowIndex = findUpcHeaderRowIndex(rawRows);
  if (headerRowIndex < 0) {
    console.warn(`⚠️  Ligne d'en-têtes UPC introuvable dans ${path.basename(upcXlsxPath)}`);
    return [];
  }

  const headerRow = rawRows[headerRowIndex] || [];
  const headerCells = headerRow.map((c) => String(c ?? "").trim());
  const rows = rawRows.slice(headerRowIndex + 1);

  const blocCol = findCol(headerCells, "bloc");
  const codeCol = findCol(headerCells, "code");
  const nomCol = findCol(headerCells, "nom");
  const dateCol = findCol(headerCells, "date");
  const msrpCol = findCol(headerCells, "pvc");
  const currentCol = findCol(headerCells, "marché", "marche", "fév", "fev");

  const monthCols = MONTHS_2026.map((m) => ({
    ...m,
    idx: headerCells.findIndex((h) => h.toLowerCase() === m.label.toLowerCase()),
  }));

  const upcDir = path.join(process.cwd(), "public", "images", "upc");

  /** Chemins manuels fixes — /images/upc/ = public/images/upc/ (pas de 'public' dans l'URL). */
  const UPC_IMAGE_OVERRIDES = {
    UPC01: "/images/upc/UPC Célébrations 25 ans.png",
    UPC02: "/images/upc/UPC Dracaufeu VSTAR.png?v=2",
    UPC03: "/images/upc/UPC Mew 151.png",
    UPC04: "/images/upc/UPC Amphinobi ex.png",
    UPC05: "/images/upc/UPC Terapagos ex.png",
    UPC06: "/images/upc/UPC Évoli ex (Évolutions Prismatiques).png",
    UPC07: "/images/upc/UPC Méga-Dracaufeu X ex.png",
    UPC08: "/images/upc/UPC Sulfura ex Team Rocket.png",
  };

  const upcItems = rows
    .map((r) => {
      const row = Array.isArray(r) ? r : [];
      const bloc = blocCol >= 0 ? String(row[blocCol] ?? "").trim() : "";
      const code = codeCol >= 0 ? String(row[codeCol] ?? "").trim() : "";
      let nom = nomCol >= 0 ? String(row[nomCol] ?? "").trim() : "";
      const releaseDate = dateCol >= 0 ? excelDateToRelease(row[dateCol]) : "";
      const msrpRaw = msrpCol >= 0 ? Number(row[msrpCol]) : 0;
      const msrp = Number.isFinite(msrpRaw) ? msrpRaw : 0;
      const currentRaw = currentCol >= 0 ? Number(row[currentCol]) : NaN;
      const currentMarketPrice = Number.isFinite(currentRaw) && currentRaw > 0 ? currentRaw : msrp;

      if (!code || !nom || !bloc) return null;

      const codeUpper = code.toUpperCase().replace(/\s/g, "");
      const nomClean = nom.replace(/^UPC\s+/i, "") || nom;
      const name = `UPC ${nomClean} FR`;

      let imageUrl = UPC_IMAGE_OVERRIDES[codeUpper] ?? null;
      if (!imageUrl) {
        const imageCandidates = [
          path.join(upcDir, `${codeUpper}.jpg`),
          path.join(upcDir, `${codeUpper}.png`),
          path.join(upcDir, `${nom}.jpg`),
          path.join(upcDir, `${nom}.png`),
        ];
        for (const p of imageCandidates) {
          if (fs.existsSync(p)) {
            const rel = path.relative(path.join(process.cwd(), "public"), p).replace(/\\/g, "/");
            imageUrl = `/${rel}`;
            break;
          }
        }
      }

      const historique_prix = monthCols.map(({ label, iso, idx }) => {
        const vRaw = idx !== -1 ? Number(row[idx] || 0) : NaN;
        const prix = Number.isFinite(vRaw) && vRaw > 0 ? vRaw : null;
        return { mois: iso, mois_label: label, prix };
      });

      return {
        id: codeUpper,
        name,
        category: "UPC",
        block: bloc,
        releaseDate,
        msrp,
        currentMarketPrice,
        imageUrl,
        historique_prix,
      };
    })
    .filter(Boolean);

  upcItems.sort((a, b) => {
    const da = (a.releaseDate && a.releaseDate.length >= 7) ? a.releaseDate : "0000-00";
    const db = (b.releaseDate && b.releaseDate.length >= 7) ? b.releaseDate : "0000-00";
    return db.localeCompare(da);
  });

  console.log(`✅ UPC : ${upcItems.length} items extraits de ${path.basename(upcXlsxPath)}`);
  return upcItems;
}

function buildDisplayData() {
  try {
    if (!fs.existsSync(displayXlsxPath)) {
      console.error(`❌ Fichier introuvable : ${displayXlsxPath}`);
      process.exit(1);
    }

    const wb = XLSX.readFile(displayXlsxPath);
    const sheetNames = wb.SheetNames || [];
    if (!sheetNames.length) {
      console.error("❌ Aucune feuille dans le fichier.");
      process.exit(1);
    }

    const firstSheetName = sheetNames[0];
    const ws = wb.Sheets[firstSheetName];
    console.log(`✅ Fichier : ${path.basename(displayXlsxPath)}`);
    console.log(`✅ Feuille : ${firstSheetName}`);

    const rawRows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
    if (!rawRows.length) {
      console.error("❌ La feuille est vide.");
      process.exit(1);
    }

    const headerRowIndex = findHeaderRowIndex(rawRows);
    if (headerRowIndex < 0) {
      console.error("❌ Ligne d'en-têtes introuvable (attendu: Bloc/Code/Nom...).");
      process.exit(1);
    }

    const headerRow = rawRows[headerRowIndex] || [];
    const headerCells = headerRow.map((c) => String(c ?? "").trim());
    const rows = rawRows.slice(headerRowIndex + 1);

    // Charger les dates de sortie FR correctes (override)
    const overridePath = path.join(process.cwd(), "scripts", "release-dates-override.json");
    let displayDateOverride = {};
    if (fs.existsSync(overridePath)) {
      const override = JSON.parse(fs.readFileSync(overridePath, "utf8"));
      displayDateOverride = override?.display ?? {};
    }

    const blocCol = findCol(headerCells, "bloc");
    const codeCol = findCol(headerCells, "code");
    const nomCol = findCol(headerCells, "nom", "extension");
    const dateCol = findCol(headerCells, "date");
    const msrpCol = findCol(headerCells, "pvc");
    const currentCol = findCol(headerCells, "marché", "marche", "fév", "fev");
    const imageCol = detectImageUrlCol(rawRows, headerRowIndex + 1);

    const monthCols = MONTHS_2026.map((m) => ({
      ...m,
      idx: headerCells.findIndex(
        (h) => h.toLowerCase() === m.label.toLowerCase()
      ),
    }));

    const displays = rows
      .map((r) => {
        const row = Array.isArray(r) ? r : [];
        const bloc = blocCol >= 0 ? String(row[blocCol] ?? "").trim() : "";
        const code = codeCol >= 0 ? String(row[codeCol] ?? "").trim() : "";
        const extension = nomCol >= 0 ? String(row[nomCol] ?? "").trim() : "";
        const releaseDate = dateCol >= 0 ? excelDateToRelease(row[dateCol]) : "";
        const msrpRaw = msrpCol >= 0 ? Number(row[msrpCol]) : 0;
        const msrp = Number.isFinite(msrpRaw) ? msrpRaw : 0;
        const currentRaw = currentCol >= 0 ? Number(row[currentCol]) : NaN;
        const currentMarketPrice =
          Number.isFinite(currentRaw) && currentRaw > 0 ? currentRaw : msrp;
        const imageFilename =
          imageCol >= 0 ? String(row[imageCol] ?? "").trim() : "";

        // Préférer les images locales dans public/images/displays/ si elles existent
        const displaysDir = path.join(process.cwd(), "public", "images", "displays");
        const localPath = path.join(displaysDir, `${extension}.png`);
        let imageUrl = null;
        if (fs.existsSync(localPath)) {
          // ?v=2 : cache-bust pour forcer le rechargement après remplacement des PNG
          imageUrl = `/images/displays/${extension}.png?v=2`;
        } else if (imageFilename !== "") {
          imageUrl = `/images/pokedata/${imageFilename}`;
        }

        if (!code || !extension || !bloc) return null;

        const historique_prix = monthCols.map(({ label, iso, idx }) => {
          const vRaw = idx !== -1 ? Number(row[idx] || 0) : NaN;
          const prix = Number.isFinite(vRaw) && vRaw > 0 ? vRaw : null;
          return {
            mois: iso,
            mois_label: label,
            prix,
          };
        });

        const displayId = code.toUpperCase();
        const releaseDateFinal = displayDateOverride[displayId] ?? releaseDate;
        const name = `${displayId} ${extension} FR`;
        const category =
          name.startsWith("Display") ? "Displays" :
          name.startsWith("ETB") ? "ETB" :
          "Displays";

        return {
          id: displayId,
          name,
          category,
          block: bloc,
          releaseDate: releaseDateFinal,
          msrp,
          currentMarketPrice,
          imageUrl,
          historique_prix,
        };
      })
      .filter(Boolean);

    // Différencier les prix identiques : si plusieurs Displays partagent les mêmes valeurs
    // pour un mois (ex. template Excel), ajuster par rapport au currentMarketPrice.
    const dedupePrixByCurrentMarket = (displaysList) => {
      const byMois = new Map();
      for (const d of displaysList) {
        for (const h of d.historique_prix || []) {
          if (!h.mois || h.prix == null) continue;
          if (!byMois.has(h.mois)) byMois.set(h.mois, new Map());
          const count = byMois.get(h.mois);
          const k = String(h.prix);
          count.set(k, (count.get(k) || 0) + 1);
        }
      }
      const duplicateMoiss = [];
      for (const [mois, counts] of byMois) {
        const maxCount = Math.max(...counts.values());
        if (maxCount >= 3) duplicateMoiss.push(mois);
      }
      if (duplicateMoiss.length === 0) return;
      const refPrice = 220;
      for (const d of displaysList) {
        const ratio = d.currentMarketPrice > 0 ? d.currentMarketPrice / refPrice : 1;
        for (const h of d.historique_prix || []) {
          if (h.mois && duplicateMoiss.includes(h.mois) && h.prix != null) {
            const adjusted = Math.round(h.prix * ratio);
            h.prix = adjusted > 0 ? adjusted : h.prix;
          }
        }
      }
    };
    dedupePrixByCurrentMarket(displays);

    // Trier par date de sortie (du plus récent au plus ancien)
    displays.sort((a, b) => {
      const da = (a.releaseDate && a.releaseDate.length >= 7) ? a.releaseDate : "0000-00";
      const db = (b.releaseDate && b.releaseDate.length >= 7) ? b.releaseDate : "0000-00";
      return db.localeCompare(da);
    });

    // Parser et fusionner les UPC (chemins manuels UPC07/UPC04 appliqués dans parseUpcData)
    const upcItems = parseUpcData();
    const allItems = [...displays, ...upcItems];

    // 1) JSON source of truth for displays + UPC (used by the app)
    const jsonOutputPath = path.join(process.cwd(), "src/data/display-data.json");
    fs.writeFileSync(jsonOutputPath, JSON.stringify(allItems, null, 2), "utf-8");

    // 2) Type-safe TypeScript wrapper that reuses the JSON (for imports in the app)
    const tsOutputPath = path.join(process.cwd(), "src/data/displayData.ts");
    const tsContent = `/** Généré par scripts/build-display-data.mjs (pokedisplay.xlsx).
 * Source de vérité: src/data/display-data.json
 */
import rawDisplayData from "./display-data.json";

export interface DisplayHistoriquePrixPoint {
  mois: string;
  mois_label: string;
  prix: number | null;
}

export interface DisplayDataItem {
  id: string;
  name: string;
  category: "Displays" | "ETB";
  block: string;
  releaseDate: string;
  msrp: number;
  currentMarketPrice: number;
  imageUrl: string | null;
  historique_prix: DisplayHistoriquePrixPoint[];
}

export const displayData = rawDisplayData as DisplayDataItem[];
`;
    fs.writeFileSync(tsOutputPath, tsContent, "utf-8");

    console.log(`🚀 RÉUSSITE : ${allItems.length} items extraits (${displays.length} Display/ETB + ${upcItems.length} UPC) !`);

    // ── Catalogue produits pour le serveur (priceSyncJob) ───────────────────
    const serverCatalogPath = path.join(process.cwd(), "server", "productCatalog.json");
    let existingCatalog = [];
    if (fs.existsSync(serverCatalogPath)) {
      try {
        existingCatalog = JSON.parse(fs.readFileSync(serverCatalogPath, "utf-8"))
          .filter((e) => e.type === "ETB"); // garde les ETB écrits par build-etb-data
      } catch { existingCatalog = []; }
    }
    const displayEntries = allItems
      .filter((d) => d.category === "Displays")
      .map((d) => ({ id: `display-${d.id}`, name: d.name, type: "Display" }));
    const upcEntries = allItems
      .filter((d) => d.category === "UPC")
      .map((d) => ({ id: `upc-${d.id}`, name: d.name, type: "UPC" }));
    const merged = [...existingCatalog, ...displayEntries, ...upcEntries];
    fs.writeFileSync(serverCatalogPath, JSON.stringify(merged, null, 2), "utf-8");
    console.log(`📋 Catalogue serveur mis à jour: ${merged.length} produits (${displayEntries.length} Display + ${upcEntries.length} UPC)`);
    if (displays.length > 0) {
      console.log(`📸 Image test (colonne T) : ${displays[0].imageUrl || "(vide)"}`);
    }
  } catch (error) {
    console.error("❌ ERREUR :", error.message);
    process.exit(1);
  }
}

buildDisplayData();
