/**
 * eBay Browse API — OAuth2 (client credentials)
 * Credentials : EBAY_APP_ID (client_id) + EBAY_CERT_ID (client_secret)
 *
 * Flow :
 *  1. POST /identity/v1/oauth2/token → Bearer token (mis en cache 2h)
 *  2. GET  /buy/browse/v1/item_summary/search  (FIXED_PRICE, EBAY_FR, limit=80)
 *  3. Garde les prix EUR, retire top/bottom 15 %, médiane sur le cœur (≈70 %)
 *  4. Résultat mis en cache 24h par query normalisée
 */

const https = require("https");

const EBAY_TOKEN_URL  = "https://api.ebay.com/identity/v1/oauth2/token";
const EBAY_SEARCH_URL = "https://api.ebay.com/buy/browse/v1/item_summary/search";
const EBAY_SCOPE      = "https://api.ebay.com/oauth/api_scope";

const TOKEN_TTL_MS  = 2  * 60 * 60 * 1000; // 2 heures
const RESULT_TTL_MS = 24 * 60 * 60 * 1000; // 24 heures

// ─── Cache token OAuth2 ──────────────────────────────────────────────────────

let _tokenCache = { token: null, expiresAtMs: 0 };

async function httpsPost(urlStr, headers, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: "POST",
      headers: { ...headers, "Content-Length": Buffer.byteLength(body) },
    };
    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => {
        resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, status: res.statusCode, json: () => Promise.resolve(JSON.parse(data)) });
      });
    });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

async function httpsGet(urlStr, headers) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: "GET",
      headers,
    };
    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => {
        resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, status: res.statusCode, json: () => Promise.resolve(JSON.parse(data)) });
      });
    });
    req.on("error", reject);
    req.end();
  });
}

async function getAccessToken() {
  if (_tokenCache.token && Date.now() < _tokenCache.expiresAtMs - 60_000) {
    return _tokenCache.token;
  }

  const appId   = (process.env.EBAY_APP_ID   || "").trim();
  const certId  = (process.env.EBAY_CERT_ID  || "").trim();

  if (!appId || !certId) {
    const err = new Error("EBAY_APP_ID et EBAY_CERT_ID doivent être définis");
    err.code = "EBAY_CONFIG";
    throw err;
  }

  const basic = Buffer.from(`${appId}:${certId}`).toString("base64");

  console.log(`[ebay/oauth] Demande de token (appId=${appId.slice(0, 16)}…)`);

  const body = `grant_type=client_credentials&scope=${encodeURIComponent(EBAY_SCOPE)}`;
  const res = await httpsPost(EBAY_TOKEN_URL, {
    "Content-Type": "application/x-www-form-urlencoded",
    "Authorization": `Basic ${basic}`,
  }, body);

  const data = await res.json().catch(() => ({}));

  if (!res.ok || !data.access_token) {
    const msg = data.error_description || data.error || `OAuth HTTP ${res.status}`;
    console.error(`[ebay/oauth] Échec : ${msg}`);
    const err = new Error(msg);
    err.code = "EBAY_OAUTH";
    throw err;
  }

  const expiresIn = typeof data.expires_in === "number" ? data.expires_in : 7200;
  _tokenCache = {
    token:       data.access_token,
    expiresAtMs: Date.now() + Math.min(expiresIn * 1000, TOKEN_TTL_MS),
  };

  console.log(`[ebay/oauth] Token OK — expire dans ${expiresIn}s`);
  return _tokenCache.token;
}

// ─── Cache résultats ─────────────────────────────────────────────────────────

const _resultCache = new Map();

function getCached(key) {
  const entry = _resultCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAtMs) { _resultCache.delete(key); return null; }
  return entry.result;
}

function setCached(key, result) {
  _resultCache.set(key, { result, expiresAtMs: Date.now() + RESULT_TTL_MS });
}

// ─── Nettoyage de la requête ─────────────────────────────────────────────────

/**
 * Construit une query eBay ciblant les produits scellés Pokémon.
 *
 * "ETB EB07 Évolution Céleste FR" → "Évolution Céleste coffret dresseur élite pokemon scellé"
 * "UPC Sulfura ex Team Rocket"    → "Sulfura Team Rocket ultra premium collection pokemon"
 * "Display Flammes Obsidiennes"   → "Flammes Obsidiennes display pokemon scellé"
 */
/** Exclusions strictes pour Display / Booster Box (évite boosters unitaires, codes, etc.). */
const DISPLAY_OR_BOOSTER_BOX_EXCLUSIONS =
  "sealed -booster -empty -vide -artset -code -loose -lot -online -repacked";

function simplifyQuery(raw) {
  let q = String(raw || "").trim();

  // Détecter Display / Booster Box AVANT de supprimer les codes set
  const isDisplay = /\bDisplay\b/i.test(q);
  const isBoosterBox = /\bBooster\s*Box\b/i.test(q);

  // Supprime les codes set (EB07, EV08.5, SV09, …)
  q = q.replace(/\(?\b(EB|EV|ME|SL|SV|XY|BW|DP|HGSS)\d{1,2}(?:\.\d+)?\b\)?/gi, "");

  // Supprime les numéros de version isolés (2, II, III)
  q = q.replace(/\s+\b(2|II|III)\b/g, "");

  // Nettoie les espaces multiples
  q = q.replace(/\s{2,}/g, " ").trim();

  // Ajoute "pokemon" si absent
  if (!/\bpokemon\b/i.test(q)) {
    q = `${q} pokemon`.trim();
  }

  // Force un suffixe "FR scellé neuf" (sans enlever d'éventuels "FR" déjà présents)
  if (!/\bFR\s+scellé\s+neuf\s*$/i.test(q)) {
    q = `${q} FR scellé neuf`.trim();
  }

  if (isDisplay || isBoosterBox) {
    q = `${q} ${DISPLAY_OR_BOOSTER_BOX_EXCLUSIONS}`.replace(/\s{2,}/g, " ").trim();
  }

  return q;
}

// ─── Filtre des titres invalides ──────────────────────────────────────────────

/**
 * Mots-clés signalant une annonce hors-sujet (carte seule, boîte vide, ouverte…).
 * Retourne true si le titre doit être exclu.
 */
const TITLE_BLACKLIST_RE = new RegExp(
  [
    "\\bcarte(s)?\\b",       // carte individuelle
    "\\bvide\\b",            // boîte vide
    "\\bouvert(e)?\\b",      // produit ouvert
    "\\bouverture\\b",       // vidéo d'ouverture
    "\\bbooster(s)?\\s+seul", // booster seul
    "\\blot\\s+de\\s+cartes?",
    "\\bslot\\b",
    "\\bcheck\\s*list\\b",
    "\\bproxy\\b",
  ].join("|"),
  "i"
);

function isTitleBlacklisted(title) {
  return TITLE_BLACKLIST_RE.test(String(title || ""));
}

// ─── Extraction du prix EUR (Browse API) ─────────────────────────────────────

function extractPriceEur(item) {
  const nodes = [
    item?.price,
    item?.marketingPrice?.originalPrice,
    item?.marketingPrice?.discountPrice,
  ];
  for (const node of nodes) {
    if (!node || node.value == null) continue;
    const cur = (node.currency || "").toUpperCase();
    if (cur !== "EUR") continue;
    const v = parseFloat(String(node.value).replace(",", "."));
    if (Number.isFinite(v) && v > 0) return v;
  }
  return null;
}

// ─── Médiane sur prix triés après exclusion du bas 15 % et haut 15 % ─────────

function medianOfSorted(sorted) {
  if (sorted.length === 0) return null;
  const m = sorted.length;
  const mid = Math.floor(m / 2);
  return m % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/**
 * Trie les prix, retire 15 % bas + 15 % haut, médiane sur le cœur (~70 %).
 * Retourne { value, usedCount } où usedCount = nombre de prix dans le cœur.
 */
function outlierTrimmedMedian15(prices) {
  if (prices.length === 0) return { value: null, usedCount: 0 };
  const sorted = [...prices].sort((a, b) => a - b);
  const n = sorted.length;
  const cut = Math.floor(n * 0.15);
  let core = sorted.slice(cut, n - cut);
  if (core.length === 0) core = sorted;
  return { value: medianOfSorted(core), usedCount: core.length };
}

/** Seuils planchers (€) pour flag « market data warning » (aligné client : `ebayMarketDataWarning.ts`). */
const MIN_DISPLAY_MARKET_EUR_BY_SET = { EB07: 450 };

function computeMarketDataWarning(rawQuery, priceEur) {
  if (priceEur == null || !Number.isFinite(priceEur)) return false;
  const raw = String(rawQuery || "");
  const isDisplayLike = /\bDisplay\b/i.test(raw) || /\bBooster\s*Box\b/i.test(raw);
  if (!isDisplayLike) return false;
  const m = raw.match(/\b(EB|EV|ME|SL|SV)\d{1,2}(?:\.\d+)?\b/i);
  if (!m) return false;
  const code = m[0].toUpperCase();
  const min = MIN_DISPLAY_MARKET_EUR_BY_SET[code];
  return min != null && priceEur < min;
}

// ─── Recherche brute (annonces filtrées) ─────────────────────────────────────

/**
 * Appelle l’API Browse, post-filtre les titres ; pas de cache sur ce résultat.
 * @returns {Promise<{ validSummaries: object[], cleanQuery: string, raw: string }>}
 */
async function getBrowseValidSummaries(rawQuery, opts = {}) {
  const raw = String(rawQuery || "").trim();
  if (!raw) {
    const err = new Error("query vide");
    err.code = "BAD_QUERY";
    throw err;
  }

  const cleanQuery =
    opts.skipSimplify === true ? raw : simplifyQuery(raw);

  console.log(`[ebay/browse] Recherche — "${raw}" → "${cleanQuery}"`);

  const token = await getAccessToken();

  const EBAY_FILTER =
    "buyingOptions:{FIXED_PRICE},conditionIds:{1000},price:[80..],priceCurrency:EUR,categoryIds:{183454}";

  const url = new URL(EBAY_SEARCH_URL);
  url.searchParams.set("q", cleanQuery);
  url.searchParams.set("limit", "80");
  url.searchParams.set("filter", EBAY_FILTER);

  const fullUrl = url.toString();
  console.log(`[ebay/browse] GET ${fullUrl}`);

  let res = await httpsGet(fullUrl, { "Authorization": `Bearer ${token}`, "X-EBAY-C-MARKETPLACE-ID": "EBAY_FR", "Content-Type": "application/json" });

  let data = await res.json().catch(() => ({}));

  if (res.ok && (!data.itemSummaries || data.itemSummaries.length === 0)) {
    console.log("[ebay/browse] 0 résultat avec categoryIds:183454 — nouvelle tentative sans filtre catégorie");
    const url2 = new URL(EBAY_SEARCH_URL);
    url2.searchParams.set("q", cleanQuery);
    url2.searchParams.set("limit", "80");
    url2.searchParams.set(
      "filter",
      "buyingOptions:{FIXED_PRICE},conditionIds:{1000},price:[80..],priceCurrency:EUR"
    );
    res = await httpsGet(url2.toString(), { "Authorization": `Bearer ${token}`, "X-EBAY-C-MARKETPLACE-ID": "EBAY_FR", "Content-Type": "application/json" });
    data = await res.json().catch(() => ({}));
    console.log(`[ebay/browse] Fallback sans catégorie — GET ${url2.toString()}`);
  }

  if (!res.ok) {
    const msg = data.errors?.[0]?.message || data.message || `Browse API HTTP ${res.status}`;
    console.error(`[ebay/browse] Erreur HTTP ${res.status}: ${msg}`);
    const err = new Error(msg);
    err.code = "EBAY_BROWSE";
    throw err;
  }

  const summaries = Array.isArray(data.itemSummaries) ? data.itemSummaries : [];
  console.log(`[ebay/browse] ${summaries.length} annonce(s) reçue(s)`);

  const validSummaries = summaries.filter((item) => !isTitleBlacklisted(item.title));
  const excluded = summaries.length - validSummaries.length;
  if (excluded > 0) {
    console.log(`[ebay/browse] ${excluded} annonce(s) exclue(s) par filtre de titre`);
  }

  return { validSummaries, cleanQuery, raw };
}

// ─── Point d'entrée public ───────────────────────────────────────────────────

/**
 * Médiane € (cœur 70 % après retrait 15 % bas / 15 % haut) des annonces FIXED_PRICE eBay FR.
 * Token OAuth2 mis en cache 2h ; résultat mis en cache 24h.
 *
 * @param {string} rawQuery  Nom brut du produit (ex. "ETB Zénith Suprême")
 * @param {{ signal?: AbortSignal }} [opts]
 * @returns {Promise<{ averagePriceEur, resultCount, itemsUsed, query, marketplace }>}
 */
async function searchAveragePriceTop5(rawQuery, opts = {}) {
  const raw = String(rawQuery || "").trim();
  if (!raw) {
    const err = new Error("query vide");
    err.code = "BAD_QUERY";
    throw err;
  }

  const cleanQuery =
    opts.skipSimplify === true ? raw : simplifyQuery(raw);
  const cacheKey = cleanQuery.toLowerCase();

  const cached = getCached(cacheKey);
  if (cached) {
    console.log(`[ebay/browse] cache hit — "${cleanQuery}"`);
    return cached;
  }

  const { validSummaries, cleanQuery: cq, raw: rawInner } = await getBrowseValidSummaries(rawQuery, opts);

  const prices = validSummaries.map(extractPriceEur).filter((p) => p !== null);
  console.log(`[ebay/browse] ${prices.length} prix EUR retenus : [${prices.map(p => p + '€').join(", ")}]`);

  if (prices.length === 0) {
    const err = new Error("Aucun prix EUR dans les résultats eBay FR");
    err.code = "NO_PRICES";
    throw err;
  }

  const { value: medianCore, usedCount: itemsUsed } = outlierTrimmedMedian15(prices);
  if (medianCore == null || !Number.isFinite(medianCore)) {
    const err = new Error("Médiane invalide après filtrage des prix");
    err.code = "NO_PRICES";
    throw err;
  }
  const averagePriceEur = Math.round(medianCore * 100) / 100;
  const marketDataWarning = computeMarketDataWarning(rawInner, averagePriceEur);

  const result = {
    averagePriceEur,
    resultCount: validSummaries.length,
    itemsUsed,
    query: cq,
    marketplace: "EBAY_FR",
    marketDataWarning,
  };

  setCached(cq.toLowerCase(), result);
  console.log(
    `[ebay/browse] Succès — "${cq}" → médiane (cœur 70 %) ${averagePriceEur} € (${prices.length} prix bruts, ${itemsUsed} dans le cœur, cache 24h)`
  );
  return result;
}

/**
 * Identique à searchAveragePriceTop5 mais contourne le cache résultats.
 * Utilisé par priceSyncJob pour obtenir un prix frais à chaque synchronisation.
 * Le token OAuth2 reste mis en cache (2h) pour économiser les appels d'auth.
 */
async function searchFresh(rawQuery, opts = {}) {
  const raw = String(rawQuery || "").trim();
  if (!raw) {
    const err = new Error("query vide");
    err.code = "BAD_QUERY";
    throw err;
  }

  const cleanQuery =
    opts.skipSimplify === true ? raw : simplifyQuery(raw);
  const cacheKey = cleanQuery.toLowerCase();

  _resultCache.delete(cacheKey);

  return searchAveragePriceTop5(rawQuery, opts);
}

/**
 * Fetch frais : jusqu’à `limit` annonces valides (ordre eBay), une valeur EUR par annonce.
 * Contourne le cache agrégé ; insère côté appelant une ligne par prix dans `ebay_prices`.
 *
 * @param {string} rawQuery
 * @param {{ skipSimplify?: boolean, limit?: number, signal?: AbortSignal }} [opts]
 * @returns {Promise<{ listingPricesEur: number[], resultCount: number, itemsReturned: number, averagePriceEur: number, query: string, marketplace: string, marketDataWarning: boolean }>}
 */
async function searchFreshTopListingPrices(rawQuery, opts = {}) {
  const raw = String(rawQuery || "").trim();
  if (!raw) {
    const err = new Error("query vide");
    err.code = "BAD_QUERY";
    throw err;
  }

  const cleanQuery =
    opts.skipSimplify === true ? raw : simplifyQuery(raw);
  _resultCache.delete(cleanQuery.toLowerCase());

  const limit = Math.min(Math.max(Number(opts.limit) || 20, 1), 80);

  const { validSummaries, cleanQuery: cq, raw: rawInner } = await getBrowseValidSummaries(rawQuery, opts);

  const listingPricesEur = [];
  for (const item of validSummaries) {
    const p = extractPriceEur(item);
    if (p !== null) {
      listingPricesEur.push(p);
      if (listingPricesEur.length >= limit) break;
    }
  }

  if (listingPricesEur.length === 0) {
    const err = new Error("Aucun prix EUR dans les résultats eBay FR");
    err.code = "NO_PRICES";
    throw err;
  }

  const sorted = [...listingPricesEur].sort((a, b) => a - b);
  const medianListings = medianOfSorted(sorted);
  if (medianListings == null || !Number.isFinite(medianListings)) {
    const err = new Error("Médiane invalide sur les annonces");
    err.code = "NO_PRICES";
    throw err;
  }
  const averagePriceEur = Math.round(medianListings * 100) / 100;
  const marketDataWarning = computeMarketDataWarning(rawInner, averagePriceEur);

  console.log(
    `[ebay/browse] Top ${listingPricesEur.length} annonce(s) — [${listingPricesEur.map((p) => p + "€").join(", ")}] → médiane ${averagePriceEur} €`
  );

  return {
    listingPricesEur,
    resultCount: validSummaries.length,
    itemsReturned: listingPricesEur.length,
    averagePriceEur,
    query: cq,
    marketplace: "EBAY_FR",
    marketDataWarning,
  };
}

module.exports = {
  searchAveragePriceTop5,
  searchFresh,
  searchFreshTopListingPrices,
  simplifyQuery,
};
