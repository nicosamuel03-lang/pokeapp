/**
 * eBay Browse API — OAuth2 (client credentials)
 * Credentials : EBAY_APP_ID (client_id) + EBAY_CERT_ID (client_secret)
 *
 * Flow :
 *  1. POST /identity/v1/oauth2/token → Bearer token (mis en cache 2h)
 *  2. GET  /buy/browse/v1/item_summary/search  (FIXED_PRICE, EBAY_FR, limit=20)
 *  3. Garde les prix EUR, retire top/bottom 15 %, retourne la médiane
 *  4. Résultat mis en cache 24h par query normalisée
 */

const EBAY_TOKEN_URL  = "https://api.ebay.com/identity/v1/oauth2/token";
const EBAY_SEARCH_URL = "https://api.ebay.com/buy/browse/v1/item_summary/search";
const EBAY_SCOPE      = "https://api.ebay.com/oauth/api_scope";

const TOKEN_TTL_MS  = 2  * 60 * 60 * 1000; // 2 heures
const RESULT_TTL_MS = 24 * 60 * 60 * 1000; // 24 heures

// ─── Cache token OAuth2 ──────────────────────────────────────────────────────

let _tokenCache = { token: null, expiresAtMs: 0 };

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

  const res = await fetch(EBAY_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type":  "application/x-www-form-urlencoded",
      "Authorization": `Basic ${basic}`,
    },
    body: `grant_type=client_credentials&scope=${encodeURIComponent(EBAY_SCOPE)}`,
  });

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
function simplifyQuery(raw) {
  let q = String(raw || "").trim();

  // Détecter le type AVANT de supprimer les préfixes
  const isETB     = /^ETB\b/i.test(q);
  const isUPC     = /^UPC\b/i.test(q);
  const isDisplay = /^Display\b/i.test(q);

  // Supprime le préfixe de catégorie
  q = q.replace(/^(ETB|UPC|Display|Coffret|Blister)\s+/i, "");

  // Supprime les codes set (EB07, EV08.5, SV09, …)
  q = q.replace(/\(?\b(EB|EV|ME|SL|SV|XY|BW|DP|HGSS)\d{1,2}(?:\.\d+)?\b\)?/gi, "");

  // Supprime " FR" en fin de chaîne
  q = q.replace(/\s+FR\s*$/i, "");

  // Supprime "ex" isolé (suffixe Pokémon)
  q = q.replace(/\bex\b/gi, "");

  // Supprime les numéros de version isolés (2, II, III)
  q = q.replace(/\s+\b(2|II|III)\b/g, "");

  // Nettoie les espaces multiples
  q = q.replace(/\s{2,}/g, " ").trim();

  // Ajoute les termes produit scellé selon le type
  if (isETB) {
    // "coffret dresseur élite" = traduction française officielle de "Elite Trainer Box"
    q = `${q} coffret dresseur élite pokemon scellé`;
  } else if (isUPC) {
    q = `${q} ultra premium collection pokemon scellé`;
  } else if (isDisplay) {
    q = `${q} display pokemon scellé`;
  } else {
    if (!/pokemon/i.test(q)) q = `${q} pokemon`;
    q = `${q} scellé`;
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
    "\\bcode\\b",            // code booster numérique
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

// ─── Calcul médiane avec écrêtage 15 %/15 % ──────────────────────────────────

function trimmedMedian(prices) {
  if (prices.length === 0) return null;
  const sorted = [...prices].sort((a, b) => a - b);
  const cut = Math.floor(sorted.length * 0.15);
  const trimmed = cut > 0 ? sorted.slice(cut, sorted.length - cut) : sorted;
  if (trimmed.length === 0) return sorted[Math.floor(sorted.length / 2)];
  const mid = Math.floor(trimmed.length / 2);
  return trimmed.length % 2 === 0
    ? (trimmed[mid - 1] + trimmed[mid]) / 2
    : trimmed[mid];
}

// ─── Point d'entrée public ───────────────────────────────────────────────────

/**
 * Médiane € (écrêtée 15%/15%) des annonces FIXED_PRICE eBay FR.
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

  const cleanQuery = simplifyQuery(raw);
  const cacheKey   = cleanQuery.toLowerCase();

  const cached = getCached(cacheKey);
  if (cached) {
    console.log(`[ebay/browse] cache hit — "${cleanQuery}"`);
    return cached;
  }

  console.log(`[ebay/browse] Recherche — "${raw}" → "${cleanQuery}"`);

  const token = await getAccessToken();

  // Catégorie eBay pour les produits Pokémon scellés (183454 = Pokémon Sealed)
  // Prix minimum 80 € pour exclure les cartes individuelles et boosters seuls
  const EBAY_FILTER = "buyingOptions:{FIXED_PRICE},price:[80..],priceCurrency:EUR,categoryIds:{183454}";

  const url = new URL(EBAY_SEARCH_URL);
  url.searchParams.set("q",      cleanQuery);
  url.searchParams.set("limit",  "20");
  url.searchParams.set("filter", EBAY_FILTER);

  const fullUrl = url.toString();
  console.log(`[ebay/browse] GET ${fullUrl}`);

  let res = await fetch(fullUrl, {
    method: "GET",
    headers: {
      "Authorization":           `Bearer ${token}`,
      "X-EBAY-C-MARKETPLACE-ID": "EBAY_FR",
      "Content-Type":            "application/json",
    },
    signal: opts.signal,
  });

  let data = await res.json().catch(() => ({}));

  // Si la catégorie 183454 retourne 0 résultats, réessaye sans le filtre categoryIds
  if (res.ok && (!data.itemSummaries || data.itemSummaries.length === 0)) {
    console.log("[ebay/browse] 0 résultat avec categoryIds:183454 — nouvelle tentative sans filtre catégorie");
    const url2 = new URL(EBAY_SEARCH_URL);
    url2.searchParams.set("q",      cleanQuery);
    url2.searchParams.set("limit",  "20");
    url2.searchParams.set("filter", "buyingOptions:{FIXED_PRICE},price:[80..],priceCurrency:EUR");
    res  = await fetch(url2.toString(), {
      method: "GET",
      headers: {
        "Authorization":           `Bearer ${token}`,
        "X-EBAY-C-MARKETPLACE-ID": "EBAY_FR",
        "Content-Type":            "application/json",
      },
      signal: opts.signal,
    });
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

  // Post-filtrage : exclure les titres contenant des mots-clés hors-sujet
  const validSummaries = summaries.filter((item) => !isTitleBlacklisted(item.title));
  const excluded = summaries.length - validSummaries.length;
  if (excluded > 0) {
    console.log(`[ebay/browse] ${excluded} annonce(s) exclue(s) par filtre de titre`);
  }

  const prices = validSummaries.map(extractPriceEur).filter((p) => p !== null);
  console.log(`[ebay/browse] ${prices.length} prix EUR retenus : [${prices.map(p => p + '€').join(", ")}]`);

  if (prices.length === 0) {
    const err = new Error("Aucun prix EUR dans les résultats eBay FR");
    err.code = "NO_PRICES";
    throw err;
  }

  const median = trimmedMedian(prices);
  const averagePriceEur = Math.round(median * 100) / 100;

  // Nb de prix utilisés après écrêtage
  const cut = Math.floor(prices.length * 0.15);
  const itemsUsed = Math.max(1, prices.length - 2 * cut);

  const result = {
    averagePriceEur,
    resultCount: validSummaries.length,
    itemsUsed,
    query:       cleanQuery,
    marketplace: "EBAY_FR",
  };

  setCached(cacheKey, result);
  console.log(
    `[ebay/browse] Succès — "${cleanQuery}" → médiane ${averagePriceEur} € (${prices.length} prix, écrêtage 15%, cache 24h)`
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

  const cleanQuery = simplifyQuery(raw);
  const cacheKey   = cleanQuery.toLowerCase();

  // On supprime l'entrée du cache pour forcer un fetch frais
  _resultCache.delete(cacheKey);

  return searchAveragePriceTop5(rawQuery, opts);
}

module.exports = { searchAveragePriceTop5, searchFresh, simplifyQuery };
