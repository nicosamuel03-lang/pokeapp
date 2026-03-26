/**
 * eBay Finding API — findCompletedItems (ventes terminées)
 * Authentification : SECURITY-APPNAME = EBAY_APP_ID (pas d'OAuth2)
 * Endpoint : https://svcs.ebay.com/services/search/FindingService/v1
 */

const FINDING_URL =
  "https://svcs.ebay.com/services/search/FindingService/v1";

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 heure

// ─── Cache résultats ────────────────────────────────────────────────────────

const resultCache = new Map();

function getCached(key) {
  const entry = resultCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAtMs) {
    resultCache.delete(key);
    return null;
  }
  return entry.result;
}

function setCached(key, result) {
  resultCache.set(key, { result, expiresAtMs: Date.now() + CACHE_TTL_MS });
}

// ─── Nettoyage de la requête ─────────────────────────────────────────────────

/**
 * Simplifie un nom de produit Pokémon pour la recherche eBay.
 * Ex : "UPC Sulfura ex Team Rocket" → "Sulfura Team Rocket pokemon"
 */
function simplifyQuery(raw) {
  let q = String(raw || "").trim();

  // Supprime les préfixes de catégorie
  q = q.replace(/^(ETB|UPC|Display|Coffret|Blister)\s+/i, "");

  // Supprime les codes set (EB07, EV08.5, SV09, …)
  q = q.replace(/\(?\b(EB|EV|ME|SL|SV|XY|BW|DP|HGSS)\d{1,2}(?:\.\d+)?\b\)?/gi, "");

  // Supprime "ex" isolé (suffixe pokémon qui gêne la recherche)
  q = q.replace(/\bex\b/gi, "");

  // Supprime les numéros de version isolés (2, II, III)
  q = q.replace(/\s+\b(2|II|III)\b/g, "");

  // Nettoie les espaces multiples
  q = q.replace(/\s{2,}/g, " ").trim();

  // Ajoute "pokemon" pour affiner eBay si absent
  if (!/pokemon/i.test(q)) q = `${q} pokemon`;

  return q;
}

// ─── Extraction du prix EUR depuis un item Finding API ───────────────────────

function extractSellingPriceEur(item) {
  try {
    const node =
      item?.sellingStatus?.[0]?.currentPrice?.[0] ??
      item?.sellingStatus?.[0]?.convertedCurrentPrice?.[0];
    if (!node) return null;
    const currency = (node["@currencyId"] || node.currencyId || "EUR").toUpperCase();
    if (currency !== "EUR") return null;
    const v = parseFloat(node["__value__"] ?? node._);
    return Number.isFinite(v) && v > 0 ? v : null;
  } catch {
    return null;
  }
}

// ─── Appel Finding API ───────────────────────────────────────────────────────

/**
 * Médiane € des 30 dernières ventes terminées ≥ 30 € (Finding API).
 * Résultat mis en cache 1 heure.
 *
 * @param {string} rawQuery  Nom brut (ex. "UPC Sulfura ex Team Rocket")
 * @param {{ signal?: AbortSignal }} [opts]
 * @returns {Promise<{ averagePriceEur, resultCount, itemsUsed, query }>}
 */
async function searchAveragePriceTop5(rawQuery, opts = {}) {
  const raw = String(rawQuery || "").trim();
  if (!raw) {
    const err = new Error("query vide");
    err.code = "BAD_QUERY";
    throw err;
  }

  const appId = (process.env.EBAY_APP_ID || "").trim();
  if (!appId) {
    const err = new Error("EBAY_APP_ID manquant dans les variables d'environnement");
    err.code = "EBAY_CONFIG";
    throw err;
  }

  const cleanQuery = simplifyQuery(raw);
  const cacheKey = cleanQuery.toLowerCase();

  const cached = getCached(cacheKey);
  if (cached) {
    console.log(`[ebay/finding] cache hit  — "${cleanQuery}" (depuis "${raw}")`);
    return cached;
  }

  // Construction de l'URL Finding API
  const params = new URLSearchParams({
    "SECURITY-APPNAME": appId,
    "GLOBAL-ID": "EBAY-FR",
    "RESPONSE-DATA-FORMAT": "JSON",
    "REST-PAYLOAD": "true",
    "OPERATION-NAME": "findCompletedItems",
    keywords: cleanQuery,
    "itemFilter(0).name": "SoldItemsOnly",
    "itemFilter(0).value": "true",
    "itemFilter(1).name": "MinPrice",
    "itemFilter(1).value": "30",
    "itemFilter(1).paramName": "Currency",
    "itemFilter(1).paramValue": "EUR",
    paginationInput_entriesPerPage: "30",
    sortOrder: "EndTimeSoonest",
  });

  const fullUrl = `${FINDING_URL}?${params.toString()}`;
  console.log(`[ebay/finding] Recherche — original: "${raw}" → simplifié: "${cleanQuery}"`);
  console.log(`[ebay/finding] URL: ${fullUrl}`);

  const res = await fetch(fullUrl, { signal: opts.signal });

  // On tente toujours de parser le JSON, même sur 4xx/5xx (eBay y met ses erreurs)
  let data;
  try {
    data = await res.json();
  } catch {
    const err = new Error(`Finding API HTTP ${res.status} — réponse non-JSON`);
    err.code = "EBAY_PARSE";
    throw err;
  }

  // Vérification d'erreur au niveau racine (rate limit errorId=10001, etc.)
  const rootError = data?.errorMessage?.[0]?.error?.[0];
  if (rootError) {
    const msg = rootError.message?.[0] ?? "Erreur eBay Finding API";
    const errorId = rootError.errorId?.[0];
    console.error(`[ebay/finding] Erreur API errorId=${errorId}: ${msg}`);
    const err = new Error(msg);
    err.code = `EBAY_FINDING_${errorId || "ERR"}`;
    throw err;
  }

  if (!res.ok) {
    const msg = `Finding API HTTP ${res.status}`;
    console.error(`[ebay/finding] Erreur HTTP sans corps JSON structuré: ${msg}`);
    const err = new Error(msg);
    err.code = "EBAY_HTTP";
    throw err;
  }

  const searchResult =
    data?.findCompletedItemsResponse?.[0]?.searchResult?.[0];
  const rawItems = searchResult?.item ?? [];

  console.log(`[ebay/finding] ${rawItems.length} résultat(s) bruts reçus`);

  // Extraction et filtrage des prix EUR
  const prices = [];
  for (const item of rawItems) {
    const price = extractSellingPriceEur(item);
    if (price !== null) prices.push(price);
  }

  console.log(
    `[ebay/finding] ${prices.length} prix EUR extraits : [${prices.join(", ")}]`
  );

  if (prices.length === 0) {
    const err = new Error("Aucune vente EUR trouvée pour cette requête");
    err.code = "NO_PRICES";
    throw err;
  }

  // Médiane sur les prix disponibles (max 30)
  const sorted = [...prices].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const medianPriceEur =
    sorted.length % 2 === 0
      ? Math.round(((sorted[mid - 1] + sorted[mid]) / 2) * 100) / 100
      : Math.round(sorted[mid] * 100) / 100;

  const result = {
    averagePriceEur: medianPriceEur,
    resultCount: rawItems.length,
    itemsUsed: prices.length,
    query: cleanQuery,
  };

  setCached(cacheKey, result);
  console.log(
    `[ebay/finding] Succès — "${cleanQuery}" → médiane ${medianPriceEur} € (${prices.length} prix, cache 1h)`
  );
  return result;
}

module.exports = { searchAveragePriceTop5, simplifyQuery };
