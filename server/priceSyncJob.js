/**
 * Price Sync Job — synchronisation automatique des prix eBay dans Supabase.
 *
 * - Lit server/productCatalog.json (généré par npm run build:data + build:display)
 * - Appelle la Browse API eBay pour chaque produit (via searchFresh, sans cache résultats)
 * - Insère le prix dans la table Supabase `ebay_prices`
 * - Supprime les entrées de plus de 30 jours
 * - Tourne automatiquement toutes les 24h quand le serveur est actif
 *
 * Déclenchement manuel : GET /api/admin/sync-prices
 */

const path = require("path");
const { searchFresh } = require("./ebayBrowse");
const { getSupabaseAdmin } = require("./supabaseAdmin");

const SYNC_INTERVAL_MS  = 24 * 60 * 60 * 1000; // 24 heures
const RETENTION_DAYS    = 30;
const DELAY_BETWEEN_MS  = 3_000; // 3s entre chaque produit pour éviter le rate limit eBay

// ─── Chargement du catalogue produits ────────────────────────────────────────

function loadProductCatalog() {
  const catalogPath = path.join(__dirname, "productCatalog.json");
  try {
    const raw = require("fs").readFileSync(catalogPath, "utf8");
    const list = JSON.parse(raw);
    if (!Array.isArray(list) || list.length === 0) {
      console.warn("[sync] productCatalog.json vide ou invalide — lance npm run build:data");
      return [];
    }
    return list;
  } catch (err) {
    console.error("[sync] Impossible de lire productCatalog.json :", err.message);
    console.error("[sync] Lance npm run build:data && npm run build:display pour le générer");
    return [];
  }
}

// ─── Utilitaires ─────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Compte les entrées par type (catalogue build:data + build:display = ETB + Display + UPC). */
function summarizeCatalogForLog(catalog) {
  let etb = 0;
  let display = 0;
  let upc = 0;
  let unknownType = 0;
  /** Bloc série pour ETB : EB / EV / ME / SL / … (préfixe avant non-numérique) */
  const seriesBucket = { EB: 0, EV: 0, ME: 0, SL: 0, other: 0 };

  for (const p of catalog) {
    const rawType = String(p?.type ?? "").trim();
    const t = rawType.toUpperCase();
    if (t === "ETB") {
      etb++;
      const id = String(p?.id ?? "");
      const m = id.match(/^([A-Za-z]+)/);
      const prefix = m ? m[1].toUpperCase() : "";
      if (prefix === "EB" || prefix === "EV" || prefix === "ME" || prefix === "SL") {
        seriesBucket[prefix]++;
      } else {
        seriesBucket.other++;
      }
    } else if (t === "DISPLAY" || t === "DISPLAYS") {
      display++;
    } else if (t === "UPC") {
      upc++;
    } else {
      unknownType++;
    }
  }

  return { etb, display, upc, unknownType, seriesBucket };
}

// ─── Cœur de la synchronisation ──────────────────────────────────────────────

async function syncAllPrices({ signal } = {}) {
  const supabase = getSupabaseAdmin();
  const catalog  = loadProductCatalog();

  if (catalog.length === 0) {
    console.log("[sync] Aucun produit dans le catalogue — sync annulée");
    return { synced: 0, errors: 0, skipped: 0 };
  }

  const summary = summarizeCatalogForLog(catalog);
  console.log(
    `[sync] ── Début run: ${catalog.length} produit(s) | types: ETB=${summary.etb} Display=${summary.display} UPC=${summary.upc}` +
      (summary.unknownType ? ` ⚠ type inconnu=${summary.unknownType}` : "") +
      ` | séries ETB: EB=${summary.seriesBucket.EB} EV=${summary.seriesBucket.EV} ME=${summary.seriesBucket.ME} SL=${summary.seriesBucket.SL}` +
      (summary.seriesBucket.other ? ` autre=${summary.seriesBucket.other}` : "")
  );
  if (summary.display === 0 || summary.upc === 0) {
    console.warn(
      "[sync] ⚠ Attendu: au moins un Display et un UPC dans productCatalog.json — lance npm run build:display si la liste est vide."
    );
  }

  let synced  = 0;
  let errors  = 0;
  let skipped = 0;

  for (const product of catalog) {
    if (signal?.aborted) {
      console.log("[sync] Annulé (signal abort)");
      break;
    }

    try {
      const result = await searchFresh(product.name, { signal });

      const { error: insertError } = await supabase
        .from("ebay_prices")
        .insert({
          product_id:   product.id,
          product_name: product.name,
          price_eur:    result.averagePriceEur,
        });

      if (insertError) {
        console.error(`[sync] Insert Supabase échoué pour "${product.name}":`, insertError.message);
        errors++;
      } else {
        console.log(`[sync] ✓ ${product.name.padEnd(45)} → ${result.averagePriceEur} € (${result.itemsUsed} annonces)`);
        synced++;
      }
    } catch (err) {
      if (err.code === "NO_PRICES") {
        console.log(`[sync] ⚠ ${product.name} — aucun résultat eBay (skipped)`);
        skipped++;
      } else if (err.code === "SUPABASE_CONFIG" || err.code === "EBAY_CONFIG") {
        // Erreur critique : arrêt immédiat
        console.error(`[sync] ❌ Erreur critique (${err.code}): ${err.message}`);
        throw err;
      } else {
        console.error(`[sync] ✗ ${product.name} — ${err.code || "ERR"}: ${err.message}`);
        errors++;
      }
    }

    // Pause entre les requêtes eBay
    if (!signal?.aborted) await sleep(DELAY_BETWEEN_MS);
  }

  // ── Purge des entrées > 30 jours ─────────────────────────────────────────
  try {
    const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const { error: purgeError, count } = await getSupabaseAdmin()
      .from("ebay_prices")
      .delete()
      .lt("fetched_at", cutoff);

    if (purgeError) {
      console.warn("[sync] Purge partielle :", purgeError.message);
    } else {
      console.log(`[sync] Purge OK — ${count ?? "?"} entrée(s) > ${RETENTION_DAYS}j supprimée(s)`);
    }
  } catch (err) {
    console.warn("[sync] Erreur pendant la purge :", err.message);
  }

  console.log(
    `[sync] Terminé — ✓ ${synced} sync   ⚠ ${skipped} sans résultat   ✗ ${errors} erreurs`
  );
  return { synced, errors, skipped };
}

// ─── Démarrage du job périodique ─────────────────────────────────────────────

let _jobTimer = null;

function startPriceSyncJob() {
  if (_jobTimer) return; // déjà démarré

  async function tick() {
    console.log("[sync] tick() — lancement d'un cycle (auto ou planifié)");
    try {
      await syncAllPrices();
      console.log(
        `[sync] Cycle OK — prochaine exécution dans ${SYNC_INTERVAL_MS / 3600000}h (${new Date(
          Date.now() + SYNC_INTERVAL_MS
        ).toISOString()} UTC approx.)`
      );
    } catch (err) {
      if (err.code === "SUPABASE_CONFIG") {
        console.warn(
          "[sync] Job désactivé : SUPABASE_SERVICE_KEY manquante." +
          " Ajoute-la dans Railway pour activer la sync automatique."
        );
        console.warn("[sync] Timer récurrent NON reprogrammé (erreur de configuration).");
        return; // ne reprogramme pas le job
      }
      if (err.code === "EBAY_CONFIG") {
        console.warn("[sync] Job désactivé : EBAY_APP_ID / EBAY_CERT_ID manquants.");
        console.warn("[sync] Timer récurrent NON reprogrammé (erreur de configuration).");
        return;
      }
      console.error("[sync] Erreur inattendue pendant la sync :", err?.message || err, err?.code || "");
    }

    // Reprogramme la prochaine exécution (sauf sorties early ci-dessus)
    _jobTimer = setTimeout(tick, SYNC_INTERVAL_MS);
  }

  // Premier lancement après 30 secondes (laisse le serveur démarrer complètement)
  console.log(
    `[sync] Job planifié — première exécution dans 30s, puis toutes les ${SYNC_INTERVAL_MS / 3600000}h (syncAllPrices sur tout le catalogue)`
  );
  _jobTimer = setTimeout(tick, 30_000);
}

function stopPriceSyncJob() {
  if (_jobTimer) {
    clearTimeout(_jobTimer);
    _jobTimer = null;
    console.log("[sync] Job arrêté");
  }
}

module.exports = { startPriceSyncJob, stopPriceSyncJob, syncAllPrices };
