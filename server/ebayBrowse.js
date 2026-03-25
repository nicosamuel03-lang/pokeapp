/**
 * eBay Browse API — token OAuth2 (client credentials) + recherche FR.
 * Variables : EBAY_CLIENT_ID, EBAY_CLIENT_SECRET
 */

const EBAY_TOKEN_URL = "https://api.ebay.com/identity/v1/oauth2/token";
const EBAY_SEARCH_URL =
  "https://api.ebay.com/buy/browse/v1/item_summary/search";
const EBAY_OAUTH_SCOPE = "https://api.ebay.com/oauth/api_scope";

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 heure

/**
 * Cache des résultats par requête normalisée.
 * Clé : query.toLowerCase().trim()
 * Valeur : { result, expiresAtMs }
 */
const resultCache = new Map();

function getCached(query) {
  const key = query.toLowerCase().trim();
  const entry = resultCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAtMs) {
    resultCache.delete(key);
    return null;
  }
  return entry.result;
}

function setCached(query, result) {
  const key = query.toLowerCase().trim();
  resultCache.set(key, { result, expiresAtMs: Date.now() + CACHE_TTL_MS });
}

let tokenCache = { accessToken: null, expiresAtMs: 0 };

async function getApplicationAccessToken() {
  const now = Date.now();
  if (tokenCache.accessToken && now < tokenCache.expiresAtMs - 60_000) {
    return tokenCache.accessToken;
  }

  const clientId = process.env.EBAY_CLIENT_ID;
  const clientSecret = process.env.EBAY_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    const err = new Error("EBAY_CLIENT_ID / EBAY_CLIENT_SECRET manquants");
    err.code = "EBAY_CONFIG";
    throw err;
  }

  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    scope: EBAY_OAUTH_SCOPE,
  });

  const res = await fetch(EBAY_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basic}`,
    },
    body: body.toString(),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg =
      data.error_description ||
      data.error ||
      `OAuth eBay HTTP ${res.status}`;
    const err = new Error(msg);
    err.code = "EBAY_OAUTH";
    throw err;
  }

  const expiresInSec =
    typeof data.expires_in === "number" ? data.expires_in : 3600;
  tokenCache = {
    accessToken: data.access_token,
    expiresAtMs: now + expiresInSec * 1000,
  };
  return tokenCache.accessToken;
}

function extractUnitPriceEur(item) {
  const tryAmount = (node) => {
    if (!node || node.value == null) return null;
    const v = parseFloat(String(node.value).replace(",", "."));
    if (!Number.isFinite(v) || v <= 0) return null;
    const cur = (node.currency || "EUR").toUpperCase();
    if (cur !== "EUR") return null;
    return v;
  };

  return (
    tryAmount(item.price) ??
    tryAmount(item.currentBidPrice) ??
    tryAmount(item.marketingPrice?.originalPrice) ??
    tryAmount(item.marketingPrice?.discountPrice)
  );
}

/**
 * Moyenne € des top-5 résultats eBay FR via Browse API.
 * Résultat mis en cache 1 heure côté serveur.
 *
 * @param {string} query
 * @param {{ signal?: AbortSignal }} [opts]
 * @returns {Promise<{ averagePriceEur: number, resultCount: number, itemsUsed: number }>}
 */
async function searchAveragePriceTop5(query, opts = {}) {
  const q = String(query || "").trim();
  if (!q) {
    const err = new Error("query vide");
    err.code = "BAD_QUERY";
    throw err;
  }

  const cached = getCached(q);
  if (cached) {
    console.log(`[ebay/browse] cache hit  — "${q}"`);
    return cached;
  }

  const token = await getApplicationAccessToken();
  const url = new URL(EBAY_SEARCH_URL);
  url.searchParams.set("q", q);
  url.searchParams.set("limit", "5");

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "X-EBAY-C-MARKETPLACE-ID": "EBAY_FR",
      "Content-Type": "application/json",
    },
    signal: opts.signal,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg =
      data.errors?.[0]?.message ||
      data.message ||
      `Browse API HTTP ${res.status}`;
    const err = new Error(msg);
    err.code = "EBAY_BROWSE";
    throw err;
  }

  const summaries = Array.isArray(data.itemSummaries)
    ? data.itemSummaries
    : [];
  const prices = [];
  for (const item of summaries.slice(0, 5)) {
    const eur = extractUnitPriceEur(item);
    if (eur != null) prices.push(eur);
  }

  if (prices.length === 0) {
    const err = new Error("Aucun prix EUR parmi les résultats");
    err.code = "NO_PRICES";
    throw err;
  }

  const sum = prices.reduce((a, b) => a + b, 0);
  const averagePriceEur = Math.round((sum / prices.length) * 100) / 100;

  const result = { averagePriceEur, resultCount: summaries.length, itemsUsed: prices.length };
  setCached(q, result);
  console.log(`[ebay/browse] fresh fetch — "${q}" → ${averagePriceEur} € (cache 1h)`);
  return result;
}

module.exports = {
  getApplicationAccessToken,
  searchAveragePriceTop5,
};
