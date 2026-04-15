#!/usr/bin/env node
/**
 * Maintenance — cohérence `ebay_prices` pour Évolution Céleste (EB07).
 *
 * 1. Corrige les product_id : lignes dont le nom contient « Évolution Céleste »
 *    (hors Display catalogue) — Noctali → EB07-2, sinon → EB07.
 * 2. Supprime les lignes `display-EB07` avec price_eur > 3000 (données aberrantes).
 * 3. Rafraîchit le prix eBay Display via la requête stricte (clé catalogue `display-EB07`).
 * 4. Affiche le nombre de lignes pour EB07 vs display-EB07 (et EB07-2).
 *
 * Usage:
 *   node scripts/maintenance-ebay-prices-evolution-celeste.js
 *
 * Variables : SUPABASE_SERVICE_KEY, EBAY_APP_ID, EBAY_CERT_ID (voir .env)
 */

const path = require("path");

require("dotenv").config({ path: path.resolve(__dirname, "../.env") });
require("dotenv").config({ path: path.resolve(__dirname, "../.env.local") });

const { getSupabaseAdmin } = require("../server/supabaseAdmin");
const { searchFreshTopListingPrices } = require("../server/ebayBrowse");
const {
  getEbaySearchOptionsForCatalogProduct,
  getStrictProductNameForInsert,
  STRICT_EBAY_QUERY_BY_PRODUCT_ID,
} = require("../server/ebayStrictProductQueries");

const DISPLAY_CATALOG_ID = "display-EB07";

async function countRowsForProductId(db, productId) {
  const { count, error } = await db
    .from("ebay_prices")
    .select("*", { count: "exact", head: true })
    .eq("product_id", productId);
  if (error) throw error;
  return count ?? 0;
}

async function main() {
  const db = getSupabaseAdmin();

  console.log("[maintenance EB07] ── Étape 1 : correction des product_id (Évolution Céleste) ──");

  // Noctali : toujours EB07-2 (ne pas confondre avec Mentali EB07).
  const stepNoctali = await db
    .from("ebay_prices")
    .update({ product_id: "EB07-2" })
    .ilike("product_name", "%Évolution Céleste%")
    .ilike("product_name", "%Noctali%")
    .neq("product_id", DISPLAY_CATALOG_ID)
    .neq("product_id", "EB07-2")
    .select("product_id", { count: "exact", head: true });

  if (stepNoctali.error) {
    console.error("[maintenance EB07] Erreur update Noctali → EB07-2:", stepNoctali.error.message);
    process.exit(1);
  }
  console.log(
    `[maintenance EB07] Noctali (Évolution Céleste) → EB07-2 : ${stepNoctali.count ?? 0} ligne(s) mise(s) à jour`
  );

  // Mentali / autres noms ETB : EB07 (ex. erreurs EB06). Jamais les lignes Display catalogue.
  const stepEtb = await db
    .from("ebay_prices")
    .update({ product_id: "EB07" })
    .ilike("product_name", "%Évolution Céleste%")
    .filter("product_name", "not.ilike", "%Noctali%")
    .neq("product_id", DISPLAY_CATALOG_ID)
    .neq("product_id", "EB07")
    .select("product_id", { count: "exact", head: true });

  if (stepEtb.error) {
    console.error("[maintenance EB07] Erreur update → EB07:", stepEtb.error.message);
    process.exit(1);
  }
  console.log(
    `[maintenance EB07] Autres (Évolution Céleste, hors Display) → EB07 : ${stepEtb.count ?? 0} ligne(s) mise(s) à jour`
  );

  console.log("[maintenance EB07] ── Étape 2 : suppression display-EB07 si price_eur > 3000 € ──");
  const purgeDisplay = await db
    .from("ebay_prices")
    .delete()
    .eq("product_id", DISPLAY_CATALOG_ID)
    .gt("price_eur", 3000)
    .select("product_id", { count: "exact", head: true });

  if (purgeDisplay.error) {
    console.error("[maintenance EB07] Erreur purge display-EB07:", purgeDisplay.error.message);
    process.exit(1);
  }
  console.log(
    `[maintenance EB07] Lignes display-EB07 supprimées (> 3000 €) : ${purgeDisplay.count ?? 0}`
  );

  console.log("[maintenance EB07] ── Étape 3 : fetch eBay Display (requête stricte display-EB07) ──");

  const strictConf = STRICT_EBAY_QUERY_BY_PRODUCT_ID[DISPLAY_CATALOG_ID];
  if (!strictConf) {
    console.error("[maintenance EB07] STRICT_EBAY_QUERY_BY_PRODUCT_ID['display-EB07'] manquant.");
    process.exit(1);
  }

  const { searchQuery, skipSimplify } = getEbaySearchOptionsForCatalogProduct({
    id: DISPLAY_CATALOG_ID,
    name: strictConf.productName,
    type: "DISPLAY",
  });
  const product_name = getStrictProductNameForInsert(DISPLAY_CATALOG_ID) || strictConf.productName;

  console.log(`[maintenance EB07] Requête (strict) : ${searchQuery}`);

  try {
    const limit = strictConf.listingFetchLimit ?? 20;
    const result = await searchFreshTopListingPrices(searchQuery, { skipSimplify, limit });
    const rows = result.listingPricesEur.map((price_eur) => ({
      product_id: DISPLAY_CATALOG_ID,
      product_name,
      price_eur,
    }));
    const { error: insErr } = await db.from("ebay_prices").insert(rows);
    if (insErr) {
      console.error("[maintenance EB07] Échec insertion Display:", insErr.message);
      process.exit(1);
    }
    console.log(
      `[maintenance EB07] Display OK — ${DISPLAY_CATALOG_ID} → ${rows.length} ligne(s), médiane annonces ~ ${result.averagePriceEur} € (${result.itemsReturned}/${result.resultCount} annonces)`
    );
  } catch (e) {
    console.error("[maintenance EB07] Erreur eBay Display:", e?.message || e, e?.code ? `[${e.code}]` : "");
    process.exit(1);
  }

  console.log("[maintenance EB07] ── Étape 4 : résumé des lignes dans ebay_prices ──");

  const nEtb = await countRowsForProductId(db, "EB07");
  const nDisplay = await countRowsForProductId(db, DISPLAY_CATALOG_ID);
  const nEtbNoctali = await countRowsForProductId(db, "EB07-2");

  console.log(`[maintenance EB07] Lignes product_id = EB07 (ETB Mentali / série)     : ${nEtb}`);
  console.log(`[maintenance EB07] Lignes product_id = ${DISPLAY_CATALOG_ID} (Display)     : ${nDisplay}`);
  console.log(`[maintenance EB07] Lignes product_id = EB07-2 (ETB Noctali)           : ${nEtbNoctali}`);
  console.log("[maintenance EB07] Terminé.");
}

main().catch((e) => {
  console.error("[maintenance EB07] Fatal:", e);
  process.exit(1);
});
