/**
 * Génère des fichiers .webp à côté des PNG/JPEG dans `public/`
 * pour réduire la bande passante (Vite ne optimise pas les assets de `public/`).
 *
 * Usage : npm run optimize:images
 * Prérequis : devDependency `sharp` (installée via npm install).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(__dirname, "..", "public");

let sharp;
try {
  sharp = (await import("sharp")).default;
} catch {
  console.error(
    "❌ Le module `sharp` est introuvable. Installe-le :\n   npm install -D sharp\n"
  );
  process.exit(1);
}

const EXT = /\.(png|jpe?g)$/i;

function walk(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) walk(full, files);
    else if (st.isFile() && EXT.test(name) && !name.toLowerCase().endsWith(".webp")) {
      files.push(full);
    }
  }
  return files;
}

function formatKb(n) {
  return `${(n / 1024).toFixed(1)} Ko`;
}

const inputs = walk(publicDir);
if (inputs.length === 0) {
  console.log("Aucune image PNG/JPEG trouvée dans public/.");
  process.exit(0);
}

let totalBefore = 0;
let totalAfter = 0;
let written = 0;

for (const inputPath of inputs) {
  const { dir, name, ext } = path.parse(inputPath);
  const extLower = ext.toLowerCase();
  if (![".png", ".jpg", ".jpeg"].includes(extLower)) continue;
  if (name.includes("..") || name.endsWith(".")) {
    console.warn(`Ignoré (nom de fichier ambigu) : ${path.relative(publicDir, inputPath)}`);
    continue;
  }
  const outPath = path.join(dir, `${name}.webp`);

  const before = fs.statSync(inputPath).size;
  await sharp(inputPath)
    .webp({ quality: 82, effort: 6 })
    .toFile(outPath);

  const after = fs.statSync(outPath).size;
  totalBefore += before;
  totalAfter += after;
  written += 1;
  const pct = before > 0 ? ((1 - after / before) * 100).toFixed(1) : "0";
  console.log(
    `✓ ${path.relative(publicDir, outPath)}  ${formatKb(before)} → ${formatKb(after)} (−${pct}%)`
  );
}

console.log("\n─── Résumé ───");
console.log(`Fichiers WebP écrits : ${written}`);
console.log(`Taille totale avant : ${formatKb(totalBefore)}`);
console.log(`Taille totale après : ${formatKb(totalAfter)} (WebP uniquement)`);
if (totalBefore > 0) {
  console.log(
    `Économie indicative si les clients chargent le WebP : ${((1 - totalAfter / totalBefore) * 100).toFixed(1)}%`
  );
}
console.log(
  "\nLes URLs en `.png` dans ton code restent valides : le composant RasterImage tente le .webp en premier."
);
