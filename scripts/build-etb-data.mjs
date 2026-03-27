import fs from "node:fs";
import path from "node:path";
import XLSX from "xlsx";

// pokedata.xlsx at project ROOT
const xlsxPath = path.resolve(process.cwd(), "pokedata.xlsx");

console.log(`📂 Lecture Excel: ${xlsxPath}`);

if (!fs.existsSync(xlsxPath)) {
  console.error(`Fichier introuvable: ${xlsxPath}`);
  process.exit(1);
}

const wb = XLSX.readFile(xlsxPath);
const sheetNames = wb.SheetNames || [];
const ws = wb.Sheets[sheetNames[0]];

if (!ws) {
  throw new Error(`Aucune feuille dans ${path.basename(xlsxPath)}.`);
}

const rawRows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });

// Headers at row 4 (index 3), data from row 5 (index 4)
const HEADER_ROW_INDEX = 3;
const DATA_START_INDEX = 4;

const dataRows = rawRows.slice(DATA_START_INDEX);

// Column mapping (0-based). Data starts at row 5.
// A=0: block, B=1: code (id), C=2: name, D=3: releaseDate, E=4: msrp
// F=5: (unused), G=6: status
// H–S (7–18): priceHistory2024 [Jan24 … Déc24]
// T–AE (19–30): priceHistory2025 [Jan25 … Déc25]
// AF–AQ (31–42): priceHistory2026 [Jan26 … Déc26]
// AG (32): currentMarketPrice = Février 2026
// AR (43): imageUrl
const COL_BLOCK = 0;
const COL_CODE = 1;
const COL_NAME = 2;
const COL_RELEASE_DATE = 3;
const COL_MSRP = 4;
const COL_STATUS = 6;
const COL_PRICE_2024_START = 7;   // H
const COL_PRICE_2024_END = 18;     // S
const COL_PRICE_2025_START = 19;   // T
const COL_PRICE_2025_END = 30;     // AE
const COL_PRICE_2026_START = 31;   // AF
const COL_PRICE_2026_END = 42;     // AQ
const COL_CURRENT_MARKET = 32;    // AG = Fév 2026
const COL_IMAGE_URL = 43;          // AR

const MONTHS_2024 = [
  { label: "Janvier 2024", iso: "2024-01" },
  { label: "Février 2024", iso: "2024-02" },
  { label: "Mars 2024", iso: "2024-03" },
  { label: "Avril 2024", iso: "2024-04" },
  { label: "Mai 2024", iso: "2024-05" },
  { label: "Juin 2024", iso: "2024-06" },
  { label: "Juillet 2024", iso: "2024-07" },
  { label: "Août 2024", iso: "2024-08" },
  { label: "Septembre 2024", iso: "2024-09" },
  { label: "Octobre 2024", iso: "2024-10" },
  { label: "Novembre 2024", iso: "2024-11" },
  { label: "Décembre 2024", iso: "2024-12" },
];

const MONTHS_2025 = [
  { label: "Janvier 2025", iso: "2025-01" },
  { label: "Février 2025", iso: "2025-02" },
  { label: "Mars 2025", iso: "2025-03" },
  { label: "Avril 2025", iso: "2025-04" },
  { label: "Mai 2025", iso: "2025-05" },
  { label: "Juin 2025", iso: "2025-06" },
  { label: "Juillet 2025", iso: "2025-07" },
  { label: "Août 2025", iso: "2025-08" },
  { label: "Septembre 2025", iso: "2025-09" },
  { label: "Octobre 2025", iso: "2025-10" },
  { label: "Novembre 2025", iso: "2025-11" },
  { label: "Décembre 2025", iso: "2025-12" },
];

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

function normBloc(val) {
  const s = String(val ?? "").trim().toLowerCase();
  if (s.startsWith("sl") || s.startsWith("sm")) return "sl";
  if (s.startsWith("ev")) return "ev";
  if (s.startsWith("me")) return "me";
  return "eb";
}

const SOLEIL_LUNE_SET_NAMES = new Set([
  "Alliance Infaillible",
  "Tempête Céleste",
  "Éclipse Cosmique",
  "Lumière Interdite",
  "Tonnerre Perdue",
  "Tonnerre Perdu",
  "Majesté des Dragons",
  "Destinées Ocultes",
  "Destinées Cachées",
  "Duo de Choc",
  "Harmonie des Esprits",
  "Soleil et Lune",
]);

/** Libellés Excel → nom affiché (fichier image = nom corrigé + .png). */
const ETB_NAME_FROM_EXCEL_FIXES = {
  "Dragon Majesty": "Majesté des Dragons",
  "Destinées Cachées": "Destinées Occultes",
};

/** Nom produit → base du fichier .png dans public/images/etb/ */
const ETB_IMAGE_FILE_OVERRIDES = {
  "Tonnerre Perdu": "Tonnerre Perdue",
};

function resolveSeries(block, name) {
  const rawName = String(name ?? "").trim().replace(/\s+FR$/, "").trim();
  if (block === "sl" || SOLEIL_LUNE_SET_NAMES.has(rawName)) return "Soleil et Lune";
  if (block === "eb") return "Épée & Bouclier";
  if (block === "ev") return "Écarlate & Violet";
  return "Méga Évolution";
}

function num(val) {
  const n = Number(val);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

/** Parse price cell: N/A or invalid → null, else number. */
function parsePrice(raw) {
  const s = String(raw ?? "").trim().toUpperCase();
  if (s === "" || s === "N/A" || s === "N.A.") return null;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** 0-based column index to Excel letter(s), e.g. 0→A, 25→Z, 26→AA, 31→AF. */
function colToLetter(index) {
  if (index < 26) return String.fromCharCode(65 + index);
  return String.fromCharCode(64 + Math.floor(index / 26)) + String.fromCharCode(65 + (index % 26));
}

// Charger les dates de sortie FR correctes et overrides d'ID
const overridePath = path.join(process.cwd(), "scripts", "release-dates-override.json");
let etbDateOverride = {};
const idOverride = {
  "EB02.2": "EB01",
  "EB06.2": "EB05",
  "EB07.2": "EB06",
  "EB08.2": "EB07",
  "EV02.2": "EV01",
  "EV05.2": "EV04",
  "EV06.2": "EV05",
  "ME02.2": "ME01",
};
if (fs.existsSync(overridePath)) {
  const override = JSON.parse(fs.readFileSync(overridePath, "utf8"));
  etbDateOverride = override?.etb ?? {};
}

const items = [];

for (let i = 0; i < dataRows.length; i += 1) {
  const row = dataRows[i] || [];
  const code = String(row[COL_CODE] ?? "").trim();
  let nameFromC = String(row[COL_NAME] ?? "").trim();
  // Only include rows that exist in pokedata.xlsx (have a code in column B)
  if (!code) continue;

  // Normaliser les codes set pour affichage : EV10.5a/EV10.5b → EV10.5, ME2.5 → ME02.5
  let id = code;
  if (/^EV10\.5[ab]$/i.test(code)) id = "EV10.5";
  else if (/^ME2\.5$/i.test(code)) id = "ME02.5";
  // Variantes "X 2" : id unique pour éviter doublons (EB02.2, ME02.2, etc.)
  if (/ 2$/.test(nameFromC)) id = code + ".2";
  // Évolution Céleste 2 : EB08 en doublon avec EB07 → EB08.2 avec image dédiée
  const hasPrevEvolution = items.some((it) => it.nom && it.nom.includes("Évolution Céleste") && !it.nom.includes(" 2"));
  if (nameFromC === "Évolution Céleste" && hasPrevEvolution && code === "EB08") {
    id = "EB08.2";
    nameFromC = "Évolution Céleste 2";
  }
  if (ETB_NAME_FROM_EXCEL_FIXES[nameFromC]) {
    nameFromC = ETB_NAME_FROM_EXCEL_FIXES[nameFromC];
  }
  // Derive bloc from code (column B) so EBxx=eb, EVxx=ev, MExx=me regardless of column A
  const block = normBloc(code);
  // Name comes ONLY from column C; for ETB (bloc eb) use "Extension FR" so app shows "ETB Extension FR"
  const name = block === "eb" ? (nameFromC ? `${nameFromC} FR` : "") : nameFromC;
  const series = resolveSeries(block, nameFromC);
  const releaseDate = String(row[COL_RELEASE_DATE] ?? "").trim();
  const msrp = num(row[COL_MSRP]);
  const status = String(row[COL_STATUS] ?? "").trim();

  // priceHistory2024: Col H–S (index 7–18)
  const historique_prix_2024 = MONTHS_2024.map(({ iso, label }, monthIndex) => {
    const colIndex = COL_PRICE_2024_START + monthIndex;
    const prix = parsePrice(row[colIndex]);
    return { mois: iso, mois_label: label, prix };
  });

  // priceHistory2025: Col T–AE (index 19–30)
  const historique_prix_2025 = MONTHS_2025.map(({ iso, label }, monthIndex) => {
    const colIndex = COL_PRICE_2025_START + monthIndex;
    const prix = parsePrice(row[colIndex]);
    return { mois: iso, mois_label: label, prix };
  });

  // priceHistory2026: Col AF–AQ (index 31–42)
  const historique_prix = MONTHS_2026.map(({ iso, label }, monthIndex) => {
    const colIndex = COL_PRICE_2026_START + monthIndex;
    const prix = parsePrice(row[colIndex]);
    return { mois: iso, mois_label: label, prix };
  });

  // prixActuel = dernier prix non-null dans l'historique (2026 > 2025 > 2024),
  // sinon colonne AG (Fév 2026) si renseignée, sinon MSRP.
  function lastNonNull(arr) {
    for (let k = arr.length - 1; k >= 0; k--) {
      if (arr[k] !== null && arr[k] !== undefined && arr[k] > 0) return arr[k];
    }
    return 0;
  }
  const prix2026Values = historique_prix.map((p) => p.prix);
  const prix2025Values = historique_prix_2025.map((p) => p.prix);
  const prix2024Values = historique_prix_2024.map((p) => p.prix);

  const lastFrom2026 = lastNonNull(prix2026Values);
  const lastFrom2025 = lastNonNull(prix2025Values);
  const lastFrom2024 = lastNonNull(prix2024Values);
  const marchePrice = num(row[COL_CURRENT_MARKET]);

  // Priorité : dernier prix 2026 → dernier prix 2025 → dernier prix 2024 → colonne AG → MSRP
  const prixActuel =
    lastFrom2026 > 0 ? lastFrom2026 :
    lastFrom2025 > 0 ? lastFrom2025 :
    lastFrom2024 > 0 ? lastFrom2024 :
    marchePrice > 0 ? marchePrice :
    msrp;

  // Image locale : préférer fichier existant dans public/images/etb/
  const etbDir = path.join(process.cwd(), "public", "images", "etb");
  const imageBaseName = nameFromC || code;
  const imageFileBase = ETB_IMAGE_FILE_OVERRIDES[imageBaseName] ?? imageBaseName;
  let imageUrl = null;
  if (imageFileBase) {
    const exactPath = path.join(etbDir, `${imageFileBase}.png`);
    const altPath = path.join(etbDir, `${imageFileBase.replace(/Combat 2$/, "Combats 2")}.png`);
    if (fs.existsSync(exactPath)) {
      imageUrl = `/images/etb/${imageFileBase}.png`;
    } else if (fs.existsSync(altPath)) {
      imageUrl = `/images/etb/${imageFileBase.replace(/Combat 2$/, "Combats 2")}.png`;
    } else {
      imageUrl = `/images/etb/${imageFileBase}.png`;
    }
  }

  if (idOverride[id]) id = idOverride[id];
  const dateSortie = etbDateOverride[id] ?? releaseDate;

  items.push({
    id,
    nom: name,
    bloc: block,
    series,
    dateSortie,
    pvcSortie: msrp,
    statut: status,
    prixActuel,
    imageUrl,
    historique_prix,
    historique_prix_2024,
    historique_prix_2025,
  });
}

// Trier par date de sortie (du plus récent au plus ancien)
function parseDateForSort(d) {
  const s = String(d ?? "").trim();
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    const [, dd, mm, yyyy] = m;
    return `${yyyy}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
  }
  return "0000-00-00";
}
items.sort((a, b) => {
  const da = parseDateForSort(a.dateSortie);
  const db = parseDateForSort(b.dateSortie);
  return db.localeCompare(da);
});

const outputPath = path.join(process.cwd(), "src", "data", "etbData.ts");

const fileContent = `// Auto-generated by scripts/build-etb-data.mjs from ${path.basename(xlsxPath)}

export interface MoisPrix {
  mois: string;
  mois_label: string;
  prix: number | null;
}

export type HistoriquePrixPoint = MoisPrix;

export type EtbBloc = "eb" | "ev" | "me" | "sl";

export interface ETBItem {
  id: string;
  nom: string;
  bloc: EtbBloc;
  series: "Méga Évolution" | "Écarlate & Violet" | "Épée & Bouclier" | "Soleil et Lune";
  dateSortie: string;
  pvcSortie: number;
  statut: string;
  prixActuel: number;
  imageUrl: string | null;
  historique_prix: MoisPrix[];
  /** Prix mensuels 2024 (Jan–Déc). */
  historique_prix_2024: MoisPrix[];
  /** Prix mensuels 2025 (Jan–Déc). */
  historique_prix_2025: MoisPrix[];
}

export const etbData: ETBItem[] = ${JSON.stringify(items, null, 2)};
`;

fs.writeFileSync(outputPath, fileContent, "utf8");

console.log(`✅ Généré: ${outputPath}`);
console.log(`📦 ETB: ${items.length}`);

// ── Catalogue produits pour le serveur (priceSyncJob) ──────────────────────
const serverCatalogPath = path.join(process.cwd(), "server", "productCatalog.json");

// Lire le catalogue existant pour ne pas écraser les entrées Display/UPC
let existingCatalog = [];
if (fs.existsSync(serverCatalogPath)) {
  try {
    const raw = fs.readFileSync(serverCatalogPath, "utf8");
    existingCatalog = JSON.parse(raw).filter((e) => e.type !== "ETB");
  } catch { existingCatalog = []; }
}

const etbCatalogEntries = items.map((item) => ({
  id:   item.id,
  name: `ETB ${item.nom}`,
  type: "ETB",
}));

const merged = [...etbCatalogEntries, ...existingCatalog];
fs.writeFileSync(serverCatalogPath, JSON.stringify(merged, null, 2), "utf8");
console.log(`📋 Catalogue serveur mis à jour: ${serverCatalogPath} (${merged.length} produits)`);
