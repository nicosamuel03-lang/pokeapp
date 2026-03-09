/**
 * Applique une variance aux prix Display identiques dans display-data.json.
 * À exécuter si plusieurs Displays partagent les mêmes valeurs (template Excel).
 * Usage: node scripts/fix-display-prices.mjs
 */
import fs from "node:fs";
import path from "node:path";

const jsonPath = path.join(process.cwd(), "src/data/display-data.json");

function fixDisplayPrices() {
  if (!fs.existsSync(jsonPath)) {
    console.error("❌ display-data.json introuvable");
    process.exit(1);
  }
  const displays = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
  if (!Array.isArray(displays) || displays.length === 0) {
    console.log("Aucun Display à traiter.");
    return;
  }

  const byMois = new Map();
  for (const d of displays) {
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
  if (duplicateMoiss.length === 0) {
    console.log("✅ Aucun prix dupliqué détecté.");
    return;
  }
  const refPrice = 220;
  let modified = 0;
  for (const d of displays) {
    const ratio = d.currentMarketPrice > 0 ? d.currentMarketPrice / refPrice : 1;
    for (const h of d.historique_prix || []) {
      if (h.mois && duplicateMoiss.includes(h.mois) && h.prix != null) {
        const adjusted = Math.round(h.prix * ratio);
        if (adjusted !== h.prix) {
          h.prix = adjusted > 0 ? adjusted : h.prix;
          modified++;
        }
      }
    }
  }
  fs.writeFileSync(jsonPath, JSON.stringify(displays, null, 2), "utf8");
  console.log(`✅ ${modified} prix ajustés pour ${duplicateMoiss.length} mois.`);
}

fixDisplayPrices();
