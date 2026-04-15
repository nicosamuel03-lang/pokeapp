#!/usr/bin/env node
/**
 * Recovery & Sync — réinsère les prix eBay manquants dans `ebay_prices`.
 *
 * 1. Détecte les product_id sans aucune ligne dans `ebay_prices` (ou hors liste distincte).
 * 2. Appelle la même logique eBay que l’app (`searchFresh` + exclusions Display dans simplifyQuery,
 *    ou requête stricte : tous les ETB + overrides Display via `server/ebayStrictProductQueries.js`).
 * 3. Utilise UPSERT sur `product_id` si une contrainte UNIQUE existe ; sinon INSERT.
 *
 * Usage:
 *   node scripts/recovery-ebay-prices.js
 *   node scripts/recovery-ebay-prices.js --source=catalog
 *   node scripts/recovery-ebay-prices.js --source=products
 *   node scripts/recovery-ebay-prices.js --source=both
 *
 * Variables : SUPABASE_SERVICE_KEY, EBAY_APP_ID, EBAY_CERT_ID (voir .env)
 *
 * Source `catalog` : compare `server/productCatalog.json` aux product_id présents dans ebay_prices.
 * Source `products` : lignes de la table Supabase `products` mappées vers un ebay product_id (code set + category).
 * Source `both`    : union des product_id à traiter (catalog ∪ products) − déjà présents dans ebay_prices.
 */

const path = require("path");
const fs = require("fs");

require("dotenv").config({ path: path.resolve(__dirname, "../.env") });
require("dotenv").config({ path: path.resolve(__dirname, "../.env.local") });

const { getSupabaseAdmin } = require("../server/supabaseAdmin");
const { searchFresh, searchFreshTopListingPrices } = require("../server/ebayBrowse");
const {
  getEbaySearchOptionsForCatalogProduct,
  getStrictProductNameForInsert,
  getStrictEbayPriceFetchConfig,
} = require("../server/ebayStrictProductQueries");

const DELAY_MS = 3000;

const CATALOG_PATH = path.join(__dirname, "../server/productCatalog.json");

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function parseArgs() {
  const argv = process.argv.slice(2);
  let source = "catalog";
  for (const a of argv) {
    if (a.startsWith("--source=")) {
      const v = a.split("=")[1]?.toLowerCase();
      if (v === "catalog" || v === "products" || v === "both") source = v;
    }
  }
  return { source };
}

/** Distinct product_id présents au moins une fois dans ebay_prices. */
async function fetchDistinctEbayProductIds(db) {
  const seen = new Set();
  let from = 0;
  const PAGE = 1000;
  for (;;) {
    const { data, error } = await db
      .from("ebay_prices")
      .select("product_id")
      .range(from, from + PAGE - 1);
    if (error) throw error;
    if (!data?.length) break;
    for (const row of data) {
      if (row.product_id) seen.add(String(row.product_id).trim());
    }
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return seen;
}

function loadCatalog() {
  const raw = fs.readFileSync(CATALOG_PATH, "utf8");
  const list = JSON.parse(raw);
  if (!Array.isArray(list)) throw new Error("productCatalog.json invalide");
  return list.map((p) => ({
    id: String(p.id).trim(),
    name: String(p.name || "").trim(),
    type: String(p.type || "").trim(),
  }));
}

/**
 * Reproduit la logique AjouterPage / fiche produit pour dériver ebay product_id.
 */
function productsRowToEbayProductId(row) {
  const cat = String(row.category || "").trim().toLowerCase();
  const codeKeys = ["etb_id", "etbId", "code", "set_code", "product_code", "set_id"];
  let code = null;
  for (const k of codeKeys) {
    const v = row[k];
    if (typeof v === "string" && v.trim()) {
      const t = v.trim();
      if (/^(?:EB|EV|ME|SL|SV)\d{1,2}(?:\.\d)?$/i.test(t)) {
        code = t.toUpperCase();
        break;
      }
    }
  }
  if (!code && typeof row.name === "string") {
    const m = row.name.match(/\b((?:EB|EV|ME|SL|SV)\d{1,2}(?:\.\d)?)\b/i);
    if (m) code = m[1].toUpperCase();
  }
  if (!code) return null;
  if (cat === "display" || cat === "displays") {
    return `display-${code.replace(/^display-/i, "")}`;
  }
  if (cat === "upc") {
    return `upc-${code.replace(/^upc-/i, "")}`;
  }
  return code;
}

async function fetchAllProductsTableRows(db) {
  const out = [];
  let from = 0;
  const PAGE = 500;
  for (;;) {
    const { data, error } = await db.from("products").select("*").range(from, from + PAGE - 1);
    if (error) {
      console.warn(`[recovery] Table products indisponible ou vide: ${error.message}`);
      return out;
    }
    if (!data?.length) break;
    out.push(...data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return out;
}

function catalogProductById(catalog, id) {
  return catalog.find((p) => p.id === id) || null;
}

/**
 * Upsert puis fallback insert si pas de contrainte unique sur product_id.
 */
async function upsertEbayPriceRow(db, { product_id, product_name, price_eur }) {
  const payload = {
    product_id,
    product_name,
    price_eur,
  };

  const attemptUpsert = await db.from("ebay_prices").upsert(payload, {
    onConflict: "product_id",
  });

  if (!attemptUpsert.error) return { ok: true, mode: "upsert" };

  const msg = attemptUpsert.error.message || "";
  if (/unique|constraint|on conflict|does not exist/i.test(msg)) {
    console.warn(
      `[recovery] Upsert indisponible (${msg.slice(0, 120)}…) — fallback INSERT pour product_id=${product_id}`
    );
  }

  const attemptInsert = await db.from("ebay_prices").insert(payload);
  if (attemptInsert.error) {
    return { ok: false, error: attemptInsert.error };
  }
  return { ok: true, mode: "insert" };
}

async function main() {
  const { source } = parseArgs();
  console.log(`[recovery] Démarrage — source=${source}`);

  const db = getSupabaseAdmin();
  const onEbay = await fetchDistinctEbayProductIds(db);
  console.log(`[recovery] product_id distincts dans ebay_prices : ${onEbay.size}`);

  const catalog = loadCatalog();
  const catalogById = new Map(catalog.map((p) => [p.id, p]));

  /** @type {Set<string>} */
  const wantIds = new Set();

  if (source === "catalog" || source === "both") {
    for (const p of catalog) {
      wantIds.add(p.id);
    }
    console.log(`[recovery] Catalogue JSON : ${catalog.length} entrées`);
  }

  /** product_id → première ligne products (nom affiché / recherche eBay si hors catalogue) */
  const productsRowByEbayId = new Map();

  if (source === "products" || source === "both") {
    const rows = await fetchAllProductsTableRows(db);
    let mapped = 0;
    for (const row of rows) {
      const id = productsRowToEbayProductId(row);
      if (id) {
        wantIds.add(id);
        mapped++;
        if (!productsRowByEbayId.has(id)) productsRowByEbayId.set(id, row);
      }
    }
    console.log(`[recovery] Table products : ${rows.length} ligne(s), ${mapped} product_id dérivé(s)`);
  }

  const missing = [...wantIds].filter((id) => !onEbay.has(id));
  missing.sort();

  console.log(`[recovery] À récupérer (sans ligne ebay_prices) : ${missing.length} product_id`);
  if (missing.length === 0) {
    console.log("[recovery] Rien à faire.");
    process.exit(0);
  }

  let ok = 0;
  let err = 0;

  for (const productId of missing) {
    let catProd = catalogProductById(catalog, productId);
    if (!catProd) {
      const row = productsRowByEbayId.get(productId);
      const nameFromProducts =
        row && typeof row.name === "string" && row.name.trim()
          ? row.name.trim()
          : productId;
      const typeFromRow =
        row && typeof row.category === "string"
          ? String(row.category).trim()
          : "";
      catProd = {
        id: productId,
        name: nameFromProducts,
        type: typeFromRow,
      };
    }

    const fetchConf = getStrictEbayPriceFetchConfig(productId);
    const strictName = getStrictProductNameForInsert(productId);
    const product_name = strictName || catProd.name;

    const { searchQuery, skipSimplify } = getEbaySearchOptionsForCatalogProduct({
      id: catProd.id,
      name: catProd.name,
      type: catProd.type,
    });

    process.stdout.write(
      `[recovery] UPDATING product_id=${productId}  query=${skipSimplify ? "(strict) " : ""}${searchQuery.slice(0, 72)}…\n`
    );

    try {
      if (fetchConf?.listingFetchLimit > 1) {
        const result = await searchFreshTopListingPrices(searchQuery, {
          skipSimplify,
          limit: fetchConf.listingFetchLimit,
        });
        const rows = result.listingPricesEur.map((price_eur) => ({
          product_id: productId,
          product_name,
          price_eur,
        }));
        const { error: insertErr } = await db.from("ebay_prices").insert(rows);
        if (insertErr) {
          console.error(`[recovery] ERREUR DB product_id=${productId}:`, insertErr.message);
          err++;
        } else {
          console.log(
            `[recovery] OK product_id=${productId}  ${rows.length} ligne(s)  médiane ~ ${result.averagePriceEur} €  (annonces: ${result.itemsReturned}/${result.resultCount})`
          );
          ok++;
        }
      } else {
        const result = await searchFresh(searchQuery, { skipSimplify });
        const price = result.averagePriceEur;

        const resDb = await upsertEbayPriceRow(db, {
          product_id: productId,
          product_name,
          price_eur: price,
        });

        if (!resDb.ok) {
          console.error(
            `[recovery] ERREUR DB product_id=${productId}:`,
            resDb.error?.message || resDb.error
          );
          err++;
        } else {
          console.log(
            `[recovery] OK product_id=${productId}  price_eur=${price} €  mode=${resDb.mode}  (annonces utiles: ${result.itemsUsed})`
          );
          ok++;
        }
      }
    } catch (e) {
      console.error(
        `[recovery] ERREUR eBay product_id=${productId}:`,
        e?.message || e,
        e?.code ? ` [${e.code}]` : ""
      );
      err++;
    }

    await sleep(DELAY_MS);
  }

  console.log(`[recovery] Terminé — réussites: ${ok}  erreurs: ${err}`);
  process.exit(err > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error("[recovery] Fatal:", e);
  process.exit(1);
});
