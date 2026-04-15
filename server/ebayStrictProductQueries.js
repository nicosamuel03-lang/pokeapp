/**
 * Requêtes eBay « strictes » (skip simplifyQuery) pour Display (overrides) et tous les ETB.
 * ETB : `ETB … scellé -display -booster -vide` (évite displays / boosters).
 * Aligné sur le backfill HTTP dans `server/index.js` et `server/priceSyncJob.js`.
 */

const fs = require("fs");
const path = require("path");

const ETB_STRICT_SUFFIX = " scellé -display -booster -vide";

/** Overrides manuels (ex. display-EB07) : prioritaires sur la génération auto. */
const STRICT_EBAY_QUERY_BY_PRODUCT_ID = {
  "display-EB07": {
    searchQuery:
      "Display Évolution Céleste scellé -booster -vide -empty",
    productName: "EB07 Évolution Céleste FR",
    listingFetchLimit: 20,
  },
  EB05: {
    searchQuery: "ETB Style de Combat scellé -display -booster",
    productName: "EB05 Styles de Combat FR",
    listingFetchLimit: 20,
  },
  EB02: {
    searchQuery: "ETB Clash des Rebelles scellé -display -booster -vide",
    productName: "EB02 Clash des Rebelles FR",
    listingFetchLimit: 20,
  },
};

let _catalogCache = null;

function getProductCatalog() {
  if (_catalogCache) return _catalogCache;
  const catalogPath = path.join(__dirname, "productCatalog.json");
  _catalogCache = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
  return _catalogCache;
}

function getCatalogProductById(productId) {
  const id = String(productId || "").trim();
  if (!id) return null;
  return getProductCatalog().find((p) => p && p.id === id) || null;
}

/** Parenthèse de code set : EB07, ME02.5, SL05-2, EB03,5 (pas « Mentali », « Lucario »). */
function isSetCodeInner(inner) {
  const code = String(inner || "").trim();
  return /^(EB|EV|ME|SL)([\d][\d.,-]*)$/i.test(code);
}

/**
 * Retire de la fin les segments `(EB07)`, `(SL05-2)`, `(EV10.5)`, `(ME02)`, `(EB03,5)`, etc.
 */
function stripTrailingSetCodeParens(title) {
  let s = String(title || "").trim();
  const re = /^(.+)\s+\(([^)]+)\)\s*$/;
  for (;;) {
    const m = s.match(re);
    if (!m) break;
    if (!isSetCodeInner(m[2])) break;
    s = m[1].trim();
  }
  return s;
}

/**
 * @param {string} catalogName — ex. `ETB Évolution Céleste (Mentali) (EB07) FR`
 * @returns {string} requête eBay stricte
 */
function buildEtbStrictSearchQuery(catalogName) {
  let core = String(catalogName || "")
    .trim()
    .replace(/^ETB\s+/i, "")
    .replace(/\s+FR\s*$/i, "");
  core = stripTrailingSetCodeParens(core);
  return `ETB ${core}${ETB_STRICT_SUFFIX}`;
}

/**
 * @param {{ id: string, name: string, type?: string }} catalogProduct
 * @returns {{ searchQuery: string, skipSimplify: boolean }}
 */
function getEbaySearchOptionsForCatalogProduct(catalogProduct) {
  const conf = STRICT_EBAY_QUERY_BY_PRODUCT_ID[catalogProduct.id];
  if (conf) {
    return { searchQuery: conf.searchQuery, skipSimplify: true };
  }
  const t = String(catalogProduct.type || "").toUpperCase();
  if (t === "ETB") {
    return {
      searchQuery: buildEtbStrictSearchQuery(catalogProduct.name),
      skipSimplify: true,
    };
  }
  return { searchQuery: catalogProduct.name, skipSimplify: false };
}

/**
 * @param {string} productId
 * @returns {string|undefined} product_name pour insert/upsert si requête stricte
 */
function getStrictProductNameForInsert(productId) {
  return (
    STRICT_EBAY_QUERY_BY_PRODUCT_ID[productId]?.productName ||
    getCatalogProductById(productId)?.name
  );
}

/**
 * Config pour backfill `/api/ebay/tracked-price` : médiane sur N annonces (ETB + overrides).
 * @returns {{ searchQuery: string, productName: string, listingFetchLimit: number } | null}
 */
function getStrictEbayPriceFetchConfig(productId) {
  const manual = STRICT_EBAY_QUERY_BY_PRODUCT_ID[productId];
  if (manual) {
    return {
      searchQuery: manual.searchQuery,
      productName: manual.productName,
      listingFetchLimit:
        typeof manual.listingFetchLimit === "number" ? manual.listingFetchLimit : 1,
    };
  }
  const product = getCatalogProductById(productId);
  if (!product || String(product.type || "").toUpperCase() !== "ETB") {
    return null;
  }
  return {
    searchQuery: buildEtbStrictSearchQuery(product.name),
    productName: product.name,
    listingFetchLimit: 20,
  };
}

module.exports = {
  STRICT_EBAY_QUERY_BY_PRODUCT_ID,
  buildEtbStrictSearchQuery,
  getEbaySearchOptionsForCatalogProduct,
  getStrictProductNameForInsert,
  getStrictEbayPriceFetchConfig,
  getCatalogProductById,
};
