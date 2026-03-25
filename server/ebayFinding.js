/**
 * eBay Finding API — findCompletedItems (ventes terminées, FR).
 * Variables : EBAY_APP_ID (SECURITY-APPNAME), EBAY_CERT_ID, EBAY_DEV_ID (validés à la config).
 *
 * @see https://developer.ebay.com/devzone/finding/callref/findCompletedItems.html
 */

const FINDING_BASE =
  "https://svcs.ebay.com/services/search/FindingService/v1";
const SERVICE_VERSION = "1.13.0";
const GLOBAL_ID_FR = "EBAY-FR";
const MIN_EUR_EXCLUSIVE = 30;
const TOP_N = 30;

function first(node) {
  if (node == null) return undefined;
  return Array.isArray(node) ? node[0] : node;
}

function ensureFindingKeys() {
  const appId = process.env.EBAY_APP_ID?.trim();
  const certId = process.env.EBAY_CERT_ID?.trim();
  const devId = process.env.EBAY_DEV_ID?.trim();
  if (!appId || !certId || !devId) {
    const err = new Error(
      "EBAY_APP_ID, EBAY_CERT_ID et EBAY_DEV_ID doivent être définis"
    );
    err.code = "EBAY_FINDING_CONFIG";
    throw err;
  }
  return { appId, certId, devId };
}

function parsePriceEurStrict(item) {
  const ss = first(item.sellingStatus);
  if (!ss) return null;
  for (const key of ["currentPrice", "convertedCurrentPrice"]) {
    const node = first(ss[key]);
    if (!node || typeof node !== "object") continue;
    const currency = node["@currencyId"] || node.currencyId;
    const raw =
      node.__value__ ?? node.value ?? (typeof node === "string" ? node : null);
    if (raw == null) continue;
    const n = parseFloat(String(raw).replace(",", "."));
    if (currency === "EUR" && Number.isFinite(n) && n > MIN_EUR_EXCLUSIVE) {
      return n;
    }
  }
  return null;
}

function parseEndTimeMs(item) {
  const li = first(item.listingInfo);
  if (!li) return 0;
  const et = first(li.endTime);
  if (et == null) return 0;
  const s = typeof et === "string" ? et : et.__value__ ?? "";
  const t = Date.parse(String(s));
  return Number.isFinite(t) ? t : 0;
}

function median(valuesAsc) {
  const n = valuesAsc.length;
  if (n === 0) return null;
  const mid = Math.floor(n / 2);
  return n % 2 === 1
    ? valuesAsc[mid]
    : (valuesAsc[mid - 1] + valuesAsc[mid]) / 2;
}

function buildFindCompletedUrl(keywords, appId) {
  const url = new URL(FINDING_BASE);
  const pairs = [
    ["OPERATION-NAME", "findCompletedItems"],
    ["SERVICE-VERSION", SERVICE_VERSION],
    ["SECURITY-APPNAME", appId],
    ["RESPONSE-DATA-FORMAT", "JSON"],
    ["REST-PAYLOAD", "true"],
    ["GLOBAL-ID", GLOBAL_ID_FR],
    ["keywords", keywords],
    ["paginationInput.entriesPerPage", "100"],
    ["paginationInput.pageNumber", "1"],
  ];

  let fi = 0;
  pairs.push(
    [`itemFilter(${fi}).name`, "SoldItemsOnly"],
    [`itemFilter(${fi}).value`, "true"]
  );
  fi += 1;
  /** Garde côté API pour limiter le volume ; le filtre strict &gt; 30 € est repris en JS. */
  pairs.push(
    [`itemFilter(${fi}).name`, "MinPrice"],
    [`itemFilter(${fi}).value`, String(MIN_EUR_EXCLUSIVE)],
    [`itemFilter(${fi}).paramName`, "Currency"],
    [`itemFilter(${fi}).paramValue`, "EUR"]
  );

  for (const [k, v] of pairs) {
    url.searchParams.append(k, v);
  }
  return url.toString();
}

/** Erreur racine (ex. rate limit) sans bloc findCompletedItemsResponse. */
function parseRootFindingError(payload) {
  const em0 = first(payload?.errorMessage);
  if (!em0) return null;
  const err0 = first(em0.error);
  if (!err0) return null;
  const msg = first(err0.message);
  const id = first(err0.errorId);
  const sub = first(err0.subdomain);
  if (typeof msg !== "string") return null;
  const bits = [];
  if (id != null) bits.push(`errorId=${id}`);
  if (sub) bits.push(String(sub));
  const prefix = bits.length ? `[${bits.join("] [")}] ` : "";
  return `${prefix}${msg}`.trim();
}

function extractItems(payload) {
  if (!payload || typeof payload !== "object") {
    return { ack: "Failure", items: [], error: "Réponse eBay invalide" };
  }

  let block = payload.findCompletedItemsResponse;
  if (Array.isArray(block)) block = block[0];
  if (!block) {
    const rootErr = parseRootFindingError(payload);
    return {
      ack: "Failure",
      items: [],
      error: rootErr || "Empty response",
    };
  }

  const ack = first(block.ack);
  const itemsNode = first(block.searchResult)?.item;
  let items = [];
  if (itemsNode != null) {
    items = Array.isArray(itemsNode) ? itemsNode : [itemsNode];
  }

  if (ack === "Failure") {
    const em = first(block.errorMessage);
    let msg = "Finding API Failure";
    if (em) {
      const m = first(em.message);
      if (typeof m === "string") msg = m;
    }
    return { ack, items: [], error: msg };
  }

  return { ack: ack || "Unknown", items, error: null };
}

/**
 * Médiane des prix (€, &gt; 30) sur les 30 ventes les plus récentes (findCompletedItems).
 * @param {string} keywords
 * @param {{ signal?: AbortSignal }} [opts]
 */
async function findCompletedSoldMedian(keywords, opts = {}) {
  const q = String(keywords || "").trim();
  if (!q) {
    const err = new Error("keywords vide");
    err.code = "BAD_QUERY";
    throw err;
  }

  const { appId } = ensureFindingKeys();
  const url = buildFindCompletedUrl(q, appId);

  const res = await fetch(url, {
    method: "GET",
    headers: { Accept: "application/json" },
    signal: opts.signal,
  });

  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    const err = new Error("Réponse eBay non JSON");
    err.code = "EBAY_PARSE";
    throw err;
  }

  const { items, error, ack } = extractItems(json);
  if (error) {
    const err = new Error(error);
    err.code = "EBAY_FINDING";
    err.ack = ack;
    throw err;
  }

  const rows = [];
  for (const item of items) {
    const price = parsePriceEurStrict(item);
    if (price == null) continue;
    const endMs = parseEndTimeMs(item);
    rows.push({ price, endMs });
  }

  rows.sort((a, b) => b.endMs - a.endMs);
  const picked = rows.slice(0, TOP_N);
  const pricesAsc = [...picked.map((r) => r.price)].sort((a, b) => a - b);
  const med = median(pricesAsc);

  if (med == null) {
    const err = new Error(
      "Aucune vente eBay FR en EUR au-dessus de 30 € pour cette recherche"
    );
    err.code = "NO_RESULTS";
    throw err;
  }

  return {
    medianPriceEur: Math.round(med * 100) / 100,
    sampleSize: pricesAsc.length,
    totalMatched: items.length,
    usedFromResponse: rows.length,
    query: q,
    ack,
  };
}

module.exports = {
  findCompletedSoldMedian,
  ensureFindingKeys,
};
