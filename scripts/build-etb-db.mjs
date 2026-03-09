import fs from "node:fs";
import path from "node:path";
import XLSX from "xlsx";

const ROOT = process.cwd();
const xlsxPath = path.join(ROOT, "pokedata (1).xlsx");
const wb = XLSX.readFile(xlsxPath);
const ws = wb.Sheets["🎴 ETB"];

if (!ws) {
  throw new Error('Feuille "🎴 ETB" introuvable dans pokedata (1).xlsx');
}

const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
const dataRows = rows.slice(4).filter((row) => String(row[2] || "").trim());

const END_ISO = "2026-02";

const toIsoMonth = (input) => {
  const raw = String(input ?? "").trim();
  if (!raw) return "2026-01";

  const parts = raw.split("/");
  if (parts.length === 3) {
    const month = Number(parts[1]);
    const year = Number(parts[2]);
    if (Number.isFinite(month) && Number.isFinite(year)) {
      return `${year}-${String(month).padStart(2, "0")}`;
    }
  }
  if (parts.length === 2) {
    const month = Number(parts[0]);
    const year = Number(parts[1]);
    if (Number.isFinite(month) && Number.isFinite(year)) {
      return `${year}-${String(month).padStart(2, "0")}`;
    }
  }
  return "2026-01";
};

const monthDiffInclusive = (startIso, endIso) => {
  const [sy, sm] = startIso.split("-").map(Number);
  const [ey, em] = endIso.split("-").map(Number);
  return (ey - sy) * 12 + (em - sm) + 1;
};

const addMonths = (iso, offset) => {
  const [y, m] = iso.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + offset, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
};

const slugifyColeka = (name) => {
  const base = String(name ?? "").trim().toLowerCase();
  return base
    .replace(/é|è|ê/g, "e")
    .replace(/à/g, "a")
    .replace(/ô/g, "o")
    .replace(/î/g, "i")
    .replace(/û|ù/g, "u")
    .replace(/ç/g, "c")
    .replace(/['’\s]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
};

const buildImageUrl = (extension, code) => {
  if (
    String(extension).trim().toLowerCase() === "héros transcendants".toLowerCase() &&
    String(code).trim() === "ME2.5"
  ) {
    return "https://thumbs.coleka.com/media/item/202602/19/coffret-dresseur-d-elite-etb-heros-transcendants_250x250.webp";
  }
  const slug = `coffret-dresseur-d-elite-etb-${slugifyColeka(extension)}`;
  return `https://thumbs.coleka.com/media/item/${slug}_250x250.webp`;
};

const buildHistorique = (startIso, startPrice, endPrice) => {
  const count = Math.max(1, monthDiffInclusive(startIso, END_ISO));
  if (count === 1) {
    return [{ mois: startIso, prix: Number(endPrice.toFixed(2)) }];
  }

  const points = [];
  for (let i = 0; i < count; i += 1) {
    const t = i / (count - 1);
    const price = startPrice + (endPrice - startPrice) * t;
    points.push({
      mois: addMonths(startIso, i),
      prix: Number(price.toFixed(2)),
    });
  }
  return points;
};

const parsed = dataRows.map((row, idx) => {
  const bloc = String(row[0] || "").trim();
  const code = String(row[1] || "").trim();
  const extension = String(row[2] || "").trim();
  const dateSortieIso = toIsoMonth(row[3]);
  const pvcSortie = Number(row[4] || 0);
  const prixMarche = Number(row[5] || 0);
  const plusValue = Number(row[6] || prixMarche - pvcSortie);
  const evolutionRaw = Number(row[7] || 0);
  const notes = String(row[8] || "").trim();
  const imageUrl = buildImageUrl(extension, code);

  const evolutionPct =
    Number.isFinite(evolutionRaw) && Math.abs(evolutionRaw) <= 10
      ? evolutionRaw * 100
      : evolutionRaw;

  return {
    id: idx + 1,
    bloc,
    code,
    extension,
    dateSortie: dateSortieIso,
    pvcSortie,
    prixMarche,
    plusValue,
    evolutionPct,
    notes,
    imageUrl,
  };
});

const typedTs = `export type PokemonBloc = "Épée & Bouclier" | "Écarlate & Violet" | "Méga Évolution" | string;

export interface PokemonETB {
  id: number;
  bloc: PokemonBloc;
  code: string;
  extension: string;
  dateSortie: string; // YYYY-MM
  pvcSortie: number;
  prixMarche: number;
  plusValue: number;
  evolutionPct: number;
  notes: string;
  imageUrl: string;
}

export const pokemonDB: PokemonETB[] = ${JSON.stringify(parsed, null, 2)};\n`;

const outputTsPath = path.join(ROOT, "src", "data", "pokemonDB.ts");
fs.writeFileSync(outputTsPath, typedTs, "utf8");

const dataJson = parsed.map((item) => ({
  id: item.id,
  nom: `ETB ${item.code} ${item.extension}`,
  emoji: "🎴",
  categorie: "ETB",
  bloc: item.bloc,
  code: item.code,
  extension: item.extension,
  dateSortie: item.dateSortie,
  imageUrl: item.imageUrl,
  quantite: 1,
  prixAchat: item.pvcSortie,
  prixMarcheActuel: item.prixMarche,
  prixVente: null,
  plusValueLatente: Number(item.plusValue.toFixed(2)),
  plusValuePct: Number(item.evolutionPct.toFixed(2)),
  notes: item.notes,
  historique: buildHistorique(item.dateSortie, item.pvcSortie, item.prixMarche),
}));

const outputJsonPath = path.join(ROOT, "src", "data", "data.json");
fs.writeFileSync(outputJsonPath, JSON.stringify(dataJson, null, 2), "utf8");

console.log(`✅ Généré: ${outputTsPath}`);
console.log(`✅ Généré: ${outputJsonPath}`);
console.log(`📦 ETB importés: ${parsed.length}`);
