const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });
require("dotenv").config({ path: path.resolve(__dirname, "../.env.local") });
const express = require("express");
const cors = require("cors");
const jwt = require('jsonwebtoken');
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const { Webhook } = require("svix");
const { createClient } = require("@supabase/supabase-js");

const supabase =
  process.env.SUPABASE_SERVICE_KEY &&
  createClient(
    "https://boshhrzirumhxalhqxmj.supabase.co",
    process.env.SUPABASE_SERVICE_KEY
  );

const app = express();

/** Masque le secret webhook pour les logs (Railway / debug). */
function maskSecret(value) {
  if (!value || typeof value !== "string") return "(absent)";
  if (value.length <= 8) return `set (len=${value.length})`;
  return `set (len=${value.length}, …${value.slice(-4)})`;
}

function sendAPNS(deviceToken, title, body, data = {}) {
  return new Promise((resolve, reject) => {
    const http2 = require('http2');
    const keyId = process.env.APNS_KEY_ID;
    const teamId = process.env.APNS_TEAM_ID;
    const p8Key = (process.env.APNS_KEY_P8 || '').replace(/\\n/g, '\n');

    if (!keyId || !teamId || !p8Key) {
      return reject(new Error('Missing APNs configuration'));
    }

    const token = jwt.sign({}, p8Key, {
      algorithm: 'ES256',
      header: { alg: 'ES256', kid: keyId },
      issuer: teamId,
      expiresIn: '1h',
    });

    const payload = JSON.stringify({
      aps: { alert: { title, body }, sound: 'default', badge: 1 },
      ...data,
    });

    const client = http2.connect('https://api.push.apple.com');

    client.on('error', (err) => {
      console.error('HTTP/2 connection error:', err);
      reject(err);
    });

    const req = client.request({
      ':method': 'POST',
      ':path': `/3/device/${deviceToken}`,
      'authorization': `bearer ${token}`,
      'apns-topic': 'com.giovanni.app',
      'apns-push-type': 'alert',
      'Content-Type': 'application/json',
    });

    let responseData = '';
    let statusCode = 0;

    req.on('response', (headers) => {
      statusCode = headers[':status'];
    });

    req.on('data', (chunk) => { responseData += chunk; });

    req.on('end', () => {
      client.close();
      if (statusCode === 200) {
        console.log('APNs push sent successfully');
        resolve({ success: true });
      } else {
        console.error(`APNs error ${statusCode}: ${responseData}`);
        reject(new Error(`APNs error ${statusCode}: ${responseData}`));
      }
    });

    req.on('error', (err) => {
      client.close();
      reject(err);
    });

    req.write(payload);
    req.end();
  });
}

// CORS doit être le premier middleware pour autoriser le front
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// Webhook Stripe : body brut pour vérification de signature (avant express.json())
app.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    console.log("[stripe webhook] POST /webhook — incoming request");
    const sig = req.headers["stripe-signature"];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    console.log(
      "[stripe webhook] STRIPE_WEBHOOK_SECRET:",
      maskSecret(webhookSecret),
      "| stripe-signature header:",
      sig ? "present" : "MISSING"
    );
    if (!webhookSecret) {
      console.error("[stripe webhook] STRIPE_WEBHOOK_SECRET is not set — set it in Railway to match Stripe Dashboard → Webhooks → signing secret");
      return res.status(500).send("Webhook secret missing");
    }
    let event;
    try {
      console.log("[stripe webhook] Verifying signature with constructEvent…");
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
      console.log("[stripe webhook] Signature OK — event.type:", event.type, "event.id:", event.id);
    } catch (err) {
      console.error(
        "[stripe webhook] Signature verification FAILED (wrong STRIPE_WEBHOOK_SECRET or body parsed as JSON?):",
        err?.message
      );
      return res.status(400).send(`Webhook Error: ${err?.message}`);
    }
    const isActiveSubscriptionStatus = (status) =>
      status === "active" || status === "trialing";

    const upsertPremiumForUser = async ({ clerkUserId, isPremium }) => {
      console.log("[stripe webhook] upsertPremiumForUser — clerkUserId:", clerkUserId, "isPremium:", isPremium);
      if (!clerkUserId) {
        console.warn("[stripe webhook] upsertPremiumForUser — SKIP (no clerkUserId)");
        return;
      }
      if (!supabase) {
        console.error("[stripe webhook] upsertPremiumForUser — SKIP (Supabase client missing: set SUPABASE_SERVICE_KEY)");
        return;
      }
      const { error, data } = await supabase
        .from("users")
        .upsert(
          { id: clerkUserId, is_premium: !!isPremium },
          { onConflict: "id" }
        )
        .select();
      if (error) {
        console.error("[stripe webhook] Supabase upsert error:", error);
        throw error;
      }
      console.log("[stripe webhook] Supabase upsert OK — rows:", data?.length ?? 0, data);
    };

    try {
      if (event.type === "checkout.session.completed") {
        const session = event.data.object;
        console.log(
          "[stripe webhook] checkout.session.completed — FULL session object (JSON):",
          JSON.stringify(session, null, 2)
        );
        console.log(
          "[stripe webhook] checkout.session.completed — session.id:",
          session.id,
          "mode:",
          session.mode
        );
        console.log(
          "[stripe webhook] session.metadata:",
          JSON.stringify(session.metadata || {}),
          "| client_reference_id:",
          session.client_reference_id ?? "(null)"
        );

        const fromMetaUserId = session.metadata?.userId || session.metadata?.user_id;
        const fromMetaClerk = session.metadata?.clerkUserId || session.metadata?.clerk_user_id;
        const fromClientRef = session.client_reference_id;
        const clerkUserId =
          (fromMetaUserId && String(fromMetaUserId).trim()) ||
          (fromMetaClerk && String(fromMetaClerk).trim()) ||
          (fromClientRef && String(fromClientRef).trim()) ||
          null;

        console.log(
          "[stripe webhook] Resolved Clerk user id — metadata.userId:",
          fromMetaUserId ?? "(none)",
          "| metadata.clerkUserId:",
          fromMetaClerk ?? "(none)",
          "| client_reference_id:",
          fromClientRef ?? "(none)",
          "=> using:",
          clerkUserId ?? "NONE — cannot set premium"
        );

        const subscriptionId =
          typeof session.subscription === "string"
            ? session.subscription
            : session.subscription?.id || null;
        const customerId =
          typeof session.customer === "string"
            ? session.customer
            : session.customer?.id || null;

        if (clerkUserId) {
          await upsertPremiumForUser({
            clerkUserId,
            isPremium: true,
          });
          console.log(
            "[stripe webhook] checkout.session.completed — Premium activated (id + is_premium only) for:",
            clerkUserId,
            "| session subscription:",
            subscriptionId,
            "customer:",
            customerId,
            "(Stripe ids not written to Supabase on this event)"
          );
        } else {
          console.error(
            "[stripe webhook] checkout.session.completed — NO USER ID: fix /api/checkout to send metadata.userId + client_reference_id (Clerk id)"
          );
        }
      }

      // Sync durable : si l'abonnement change côté Stripe (pause, cancel, fin de trial, etc.)
      if (
        event.type === "customer.subscription.updated" ||
        event.type === "customer.subscription.deleted"
      ) {
        const sub = event.data.object;
        const subscriptionId = sub.id;
        const status = sub.status;
        const clerkUserId =
          sub?.metadata?.clerkUserId ||
          sub?.metadata?.clerk_user_id ||
          null;

        const premiumNow = isActiveSubscriptionStatus(status);

        if (clerkUserId) {
          await upsertPremiumForUser({
            clerkUserId,
            isPremium: premiumNow,
          });
          console.log(
            "[stripe webhook] subscription sync via metadata for user:",
            clerkUserId,
            "status:",
            status,
            "=> premium:",
            premiumNow
          );
        } else {
          console.warn(
            "[stripe webhook] customer.subscription — no clerkUserId in subscription metadata; cannot upsert is_premium. subscription:",
            subscriptionId
          );
        }
      }
    } catch (err) {
      console.error("[stripe webhook] handler error:", err);
      return res.status(500).send("Webhook handler failed");
    }
    res.json({ received: true });
  }
);

// Clerk webhook : création automatique d'une ligne dans `users` lors du signup
app.post(
  "/api/clerk-webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    try {
      const svixSecret = process.env.CLERK_WEBHOOK_SECRET;
      if (!svixSecret) {
        console.error("CLERK_WEBHOOK_SECRET is not set");
        return res.status(500).send("Webhook secret missing");
      }

      const svixHeaders = {
        "svix-id": req.headers["svix-id"],
        "svix-timestamp": req.headers["svix-timestamp"],
        "svix-signature": req.headers["svix-signature"],
      };

      const wh = new Webhook(svixSecret);
      let evt;
      try {
        evt = wh.verify(req.body, svixHeaders);
      } catch (err) {
        console.error("Clerk webhook verification failed:", err?.message || err);
        return res.status(400).send("Invalid webhook signature");
      }

      const eventType = evt.type;
      if (eventType === "user.created") {
        const user = evt.data;
        const clerkUserId = user.id;

        if (!clerkUserId || !supabase) {
          console.error("[Clerk webhook] missing user id or Supabase client");
          return res.status(500).send("Configuration error");
        }

        console.log("[Clerk webhook] user.created for:", clerkUserId);

        const { error: insertError } = await supabase
          .from("users")
          .insert({
            id: clerkUserId,
            is_premium: false,
          })
          .single();

        if (insertError) {
          console.error("[Clerk webhook] Supabase insert failed:", insertError);
          return res.status(500).send("Failed to insert user");
        }
      }

      return res.json({ received: true });
    } catch (err) {
      console.error("Clerk webhook handler error:", err?.message || err);
      return res.status(500).send("Internal server error");
    }
  }
);

app.use(express.json());

app.post('/api/send-notification', async (req, res) => {
  try {
    const { title, body, adminKey } = req.body;
    
    // Simple admin protection - only you can send notifications
    if (adminKey !== process.env.ADMIN_NOTIFICATION_KEY) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    
    if (!title || !body) {
      return res.status(400).json({ error: 'title and body required' });
    }

    // Get all device tokens from Supabase
    const { data: tokens, error } = await supabase
      .from('device_tokens')
      .select('token');
    
    if (error) throw error;
    
    if (!tokens || tokens.length === 0) {
      return res.json({ success: true, sent: 0, message: 'No devices registered' });
    }

    // Send to all devices
    const results = await Promise.allSettled(
      tokens.map(t => sendAPNS(t.token, title, body))
    );

    const sent = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;
    
    results.forEach((r, i) => {
      if (r.status === 'rejected') {
        console.error(`Push failed for token ${tokens[i]?.token}:`, r.reason?.message || r.reason);
      }
    });
    
    console.log(`Notifications sent: ${sent} success, ${failed} failed`);
    res.json({ success: true, sent, failed, total: tokens.length });
  } catch (err) {
    console.error('Send notification error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/device-tokens", async (req, res) => {
  try {
    const { userId, token, platform } = req.body || {};
    if (!userId || !token || !platform) {
      return res.status(400).json({ error: "Missing userId, token, or platform" });
    }
    if (!supabase) {
      return res.status(500).json({ error: "Supabase not configured" });
    }

    await supabase.from('device_tokens').upsert(
      { user_id: userId, token, platform, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,token' }
    );

    return res.json({ success: true });
  } catch (err) {
    console.error("[api/device-tokens] POST error:", err?.message || err);
    return res.status(500).json({ error: "Failed to store device token" });
  }
});

app.delete("/api/device-tokens", async (req, res) => {
  try {
    const { userId, token } = req.body || {};
    if (!userId || !token) {
      return res.status(400).json({ error: "Missing userId or token" });
    }
    if (!supabase) {
      return res.status(500).json({ error: "Supabase not configured" });
    }

    await supabase.from("device_tokens").delete().eq("user_id", userId).eq("token", token);

    return res.json({ success: true });
  } catch (err) {
    console.error("[api/device-tokens] DELETE error:", err?.message || err);
    return res.status(500).json({ error: "Failed to delete device token" });
  }
});

app.post('/api/activate-premium', async (req, res) => {
  try {
    const { userId, source } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId required' });
    
    const { error } = await supabase
      .from('users')
      .update({ is_premium: true })
      .eq('id', userId);
    
    if (error) throw error;
    
    console.log(`Premium activated for ${userId} via ${source}`);
    res.json({ success: true });
  } catch (err) {
    console.error('Activate premium error:', err);
    res.status(500).json({ error: 'Failed to activate premium' });
  }
});

const {
  searchAveragePriceTop5,
  searchFresh,
  searchFreshTopListingPrices,
} = require("./ebayBrowse");
const { startPriceSyncJob, syncAllPrices } = require("./priceSyncJob");
const { getSupabaseAdmin } = require("./supabaseAdmin");

/** Prix moyen (€) des 5 premières annonces eBay France (Browse API). */
app.get("/api/ebay/price", async (req, res) => {
  const raw = req.query.query;
  if (raw == null || String(raw).trim() === "") {
    return res.status(400).json({ error: "Missing query parameter: query" });
  }
  try {
    const result = await searchAveragePriceTop5(String(raw));
    return res.json({
      averagePriceEur: result.averagePriceEur,
      resultCount: result.resultCount,
      itemsUsed: result.itemsUsed,
      marketplace: result.marketplace,
      query: result.query ?? String(raw).trim(),
      originalQuery: String(raw).trim(),
      marketDataWarning: Boolean(result.marketDataWarning),
    });
  } catch (err) {
    if (err?.code === "EBAY_CONFIG") {
      return res
        .status(503)
        .json({ error: "eBay API not configured (EBAY_APP_ID manquant)" });
    }
    if (err?.code === "BAD_QUERY") {
      return res.status(400).json({ error: err.message });
    }
    console.error("[api/ebay/price]", err?.message || err);
    return res.status(502).json({
      error: err?.message || "eBay request failed",
      code: err?.code || undefined,
    });
  }
});

console.log(
  "TESTING KEY:",
  process.env.STRIPE_SECRET_KEY ? "Key is loaded" : "KEY IS MISSING"
);
console.log("SERVER STARTING - Keys loaded:", !!process.env.STRIPE_SECRET_KEY);
console.log(
  "[stripe] STRIPE_WEBHOOK_SECRET for /webhook:",
  maskSecret(process.env.STRIPE_WEBHOOK_SECRET),
  "— must match Stripe Dashboard → Developers → Webhooks → [endpoint] → Signing secret"
);
console.log("✅ Stripe Server is ready with Secret Key");

app.get("/api/debug-stripe", async (req, res) => {
  res.json({
    monthly: process.env.STRIPE_MONTHLY_PRICE_ID,
    annual: process.env.STRIPE_ANNUAL_PRICE_ID,
  });
});

app.post("/api/checkout", async (req, res) => {
  console.log("[checkout] POST /api/checkout — body:", JSON.stringify(req.body));
  try {
    const baseUrl = req.body.base_url || "http://localhost:5173";
    const {
      success_url: bodySuccessUrl,
      cancel_url: bodyCancelUrl,
      client_reference_id,
      userId: bodyUserId,
      plan,
      priceId: bodyPriceId,
    } = req.body;

    const clerkUserId = [client_reference_id, bodyUserId]
      .map((v) => (v != null && String(v).trim() ? String(v).trim() : ""))
      .find(Boolean);

    if (!clerkUserId) {
      console.error(
        "[checkout] REJECTED — missing Clerk user id (need client_reference_id or userId in JSON body)"
      );
      return res.status(400).json({
        error:
          "Missing user id: sign in and retry, or pass client_reference_id / userId (Clerk user_…)",
      });
    }

    console.log("[checkout] Clerk user id for Stripe session:", clerkUserId);

    const success_url = bodySuccessUrl || `${baseUrl}/success`;
    const cancel_url =
      bodyCancelUrl || `${baseUrl}/premium?canceled=1`;

    const isAnnual = plan === "annual";
    const priceId =
      bodyPriceId && String(bodyPriceId).trim()
        ? String(bodyPriceId).trim()
        : isAnnual
          ? process.env.STRIPE_ANNUAL_PRICE_ID
          : process.env.STRIPE_MONTHLY_PRICE_ID;

    console.log("[checkout] plan:", plan, "isAnnual:", isAnnual, "priceId:", priceId, "source:", bodyPriceId ? "frontend" : "server env");

    const sessionParams = {
      payment_method_types: ["card"],
      mode: "subscription",
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url,
      cancel_url,
      client_reference_id: clerkUserId,
      metadata: {
        userId: clerkUserId,
      },
      subscription_data: {
        trial_period_days: 30,
        metadata: {
          plan: plan || "",
          clerkUserId,
        },
      },
    };
    console.log("[checkout] stripe.checkout.sessions.create params (metadata + client_reference_id set):", JSON.stringify({
      ...sessionParams,
      line_items: sessionParams.line_items,
    }));

    const session = await stripe.checkout.sessions.create(sessionParams);
    console.log("[checkout] Session created:", session.id, "url present:", !!session.url);

    return res.json({ url: session.url });
  } catch (err) {
    console.error("STRIPE / SERVER ERROR:", err?.message || err);
    return res
      .status(500)
      .json({ error: err?.message || "Unknown server error" });
  }
});

// Fallback : vérifier directement sur Stripe si l'abonnement est actif (utile si webhook en retard)
app.get("/api/check-subscription", async (req, res) => {
  try {
    const userId = req.headers["userid"] || req.headers["userId"] || req.headers["user-id"];
    if (!userId) return res.status(400).json({ error: "Missing userId header" });
    if (!supabase) return res.status(500).json({ error: "Supabase not configured" });

    const { data, error } = await supabase
      .from("users")
      .select("stripe_subscription_id")
      .eq("id", String(userId))
      .maybeSingle();
    if (error) return res.status(500).json({ error: "Failed to load user row" });

    const subscriptionId = data?.stripe_subscription_id || null;
    if (!subscriptionId) return res.json({ isPremium: false, source: "no_subscription_id" });

    const sub = await stripe.subscriptions.retrieve(subscriptionId);
    const status = sub?.status;
    const isPremium = status === "active" || status === "trialing";
    return res.json({ isPremium, status, source: "stripe" });
  } catch (err) {
    console.error("[check-subscription] error:", err?.message || err);
    return res.status(500).json({ error: "Failed to verify subscription" });
  }
});

app.post("/api/cancel-subscription", async (req, res) => {
  try {
    const { userId } = req.body || {};
    if (!userId) {
      return res.status(400).json({ error: "Missing userId" });
    }
    if (!supabase) {
      return res.status(500).json({ error: "Supabase not configured" });
    }

    // IMPORTANT : userId doit être l'ID Clerk (format user_xxx) stocké dans users.id
    console.log("[cancel-subscription] incoming userId (expected Clerk ID):", userId);

    const { data, error: fetchError } = await supabase
      .from("users")
      .select("stripe_subscription_id")
      .eq("id", userId)
      .single();
    if (fetchError) {
      console.error("Supabase fetch error:", fetchError);
      return res.status(500).json({ error: "Failed to load subscription" });
    }
    console.log("[cancel-subscription] loaded user row for id =", userId, "=>", data);
    const subscriptionId = data?.stripe_subscription_id;

    // Essayez d'annuler l'abonnement Stripe si nous avons un ID, mais
    // même si l'annulation Stripe échoue ou si aucun ID n'est présent,
    // on repasse quand même l'utilisateur en mode gratuit côté app.
    if (subscriptionId) {
      try {
        await stripe.subscriptions.cancel(subscriptionId);
      } catch (cancelErr) {
        console.error(
          "Stripe subscription cancel failed (will still downgrade user):",
          cancelErr?.message || cancelErr
        );
      }
    }

    const { data: updatedRows, error: updateError } = await supabase
      .from("users")
      .update({ is_premium: false, stripe_subscription_id: null })
      .eq("id", userId)
      .select();
    console.log(
      "UPDATE RESULT:",
      JSON.stringify(updatedRows),
      "ERROR:",
      updateError
    );
    if (updateError) {
      console.error("Supabase update error:", updateError);
      return res.status(500).json({ error: "Failed to update user" });
    }

    return res.json({ ok: true });
  } catch (err) {
    console.error("Cancel subscription error:", err?.message || err);
    return res
      .status(500)
      .json({ error: err?.message || "Unknown server error" });
  }
});

// Suppression de compte : utilise directement l'ID Clerk pour supprimer le compte
app.post("/api/delete-account", async (req, res) => {
  const { userId } = req.body || {};
  if (!userId) {
    return res.status(400).json({ error: "Missing userId" });
  }

  try {
    const clerkSecret = process.env.CLERK_SECRET_KEY;
    if (!clerkSecret) {
      console.error("CLERK_SECRET_KEY is not set");
      return res.status(500).json({ error: "Server not configured for account deletion" });
    }

    const { createClerkClient } = require("@clerk/backend");
    const clerkClient = createClerkClient({ secretKey: clerkSecret });

    await clerkClient.users.deleteUser(userId);

    if (supabase) {
      await supabase.from("users").delete().eq("id", userId);
    }

    return res.json({ ok: true });
  } catch (err) {
    console.error("Delete account error:", err);
    return res.status(500).json({ error: err?.message || "Unknown server error" });
  }
});

const { getStrictEbayPriceFetchConfig } = require("./ebayStrictProductQueries");

/**
 * Appelle eBay (sans réécriture de requête), insère une ou plusieurs lignes `ebay_prices`.
 * @returns {Promise<number|null>} médiane indicative des prix insérés, ou null si pas de mapping / échec
 */
async function fetchAndInsertEbayPriceIfConfigured(productId, db) {
  const conf = getStrictEbayPriceFetchConfig(productId);
  if (!conf) return null;

  const listingLimit = conf.listingFetchLimit;
  if (typeof listingLimit === "number" && listingLimit > 1) {
    const result = await searchFreshTopListingPrices(conf.searchQuery, {
      skipSimplify: true,
      limit: listingLimit,
    });
    const rows = result.listingPricesEur.map((price_eur) => ({
      product_id: productId,
      product_name: conf.productName,
      price_eur,
    }));
    const { error: insertError } = await db.from("ebay_prices").insert(rows);
    if (insertError) {
      console.error(
        `[tracked-price/backfill] Insert échoué pour ${productId}:`,
        insertError.message
      );
      throw insertError;
    }
    console.log(
      `[tracked-price/backfill] ✓ ${productId} → ${rows.length} ligne(s), médiane annonces ${result.averagePriceEur} € (requête stricte)`
    );
    return result.averagePriceEur;
  }

  const result = await searchFresh(conf.searchQuery, { skipSimplify: true });
  const { error: insertError } = await db.from("ebay_prices").insert({
    product_id: productId,
    product_name: conf.productName,
    price_eur: result.averagePriceEur,
  });
  if (insertError) {
    console.error(
      `[tracked-price/backfill] Insert échoué pour ${productId}:`,
      insertError.message
    );
    throw insertError;
  }
  console.log(
    `[tracked-price/backfill] ✓ ${productId} → ${result.averagePriceEur} € (requête stricte)`
  );
  return result.averagePriceEur;
}

// ─── Route : prix trackés (90 derniers jours depuis Supabase) ─────────────────
app.get("/api/ebay/tracked-price", async (req, res) => {
  const productId = String(req.query.productId || "").trim();
  if (!productId) {
    return res.status(400).json({ error: "Paramètre manquant : productId" });
  }

  try {
    const db = getSupabaseAdmin();
    const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await db
      .from("ebay_prices")
      .select("price_eur, fetched_at")
      .eq("product_id", productId)
      .gte("fetched_at", since)
      .order("fetched_at", { ascending: false })
      .limit(200);

    if (error) {
      console.error("[tracked-price] Supabase error:", error.message);
      return res.status(502).json({ error: error.message });
    }

    let entries = Array.isArray(data) ? data : [];

    if (entries.length < 1) {
      try {
        const inserted = await fetchAndInsertEbayPriceIfConfigured(productId, db);
        if (inserted != null && Number.isFinite(inserted)) {
          const { data: data2, error: err2 } = await db
            .from("ebay_prices")
            .select("price_eur, fetched_at")
            .eq("product_id", productId)
            .gte("fetched_at", since)
            .order("fetched_at", { ascending: false })
            .limit(200);
          if (!err2 && Array.isArray(data2) && data2.length > 0) {
            entries = data2;
          } else {
            return res.json({
              available: true,
              pricesEur: [inserted],
              count: 1,
              backfilled: true,
            });
          }
        } else {
          return res.json({ available: false, count: 0 });
        }
      } catch (backfillErr) {
        if (backfillErr?.code === "EBAY_CONFIG" || backfillErr?.code === "SUPABASE_CONFIG") {
          throw backfillErr;
        }
        console.error("[tracked-price/backfill]", backfillErr?.message || backfillErr);
        return res.json({ available: false, count: 0 });
      }
    }

    if (entries.length < 1) {
      return res.json({ available: false, count: 0 });
    }

    const pricesEur = entries.map((e) => Number(e.price_eur)).filter(Number.isFinite);

    return res.json({
      available: true,
      pricesEur,
      count: pricesEur.length,
      oldestEntry: entries[entries.length - 1]?.fetched_at,
      newestEntry: entries[0]?.fetched_at,
    });
  } catch (err) {
    if (err.code === "SUPABASE_CONFIG") {
      return res.status(503).json({ available: false, error: "Supabase non configuré" });
    }
    console.error("[tracked-price]", err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ─── Route : prix trackés en batch (portfolio) ───────────────────────────────
// GET /api/ebay/tracked-prices?ids=ME02.5,display-ME02,upc-UPC08
app.get("/api/ebay/tracked-prices", async (req, res) => {
  const raw = String(req.query.ids || "").trim();
  if (!raw) return res.status(400).json({ error: "Paramètre manquant : ids" });

  const productIds = raw.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 200);

  try {
    const db = getSupabaseAdmin();
    const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await db
      .from("ebay_prices")
      .select("product_id, price_eur")
      .in("product_id", productIds)
      .gte("fetched_at", since);

    if (error) {
      console.error("[tracked-prices/batch] Supabase error:", error.message);
      return res.status(502).json({ error: error.message });
    }

    const buildGrouped = (rowsIn) => {
      const g = new Map();
      for (const row of rowsIn || []) {
        const id = row.product_id;
        if (!g.has(id)) g.set(id, []);
        g.get(id).push(Number(row.price_eur));
      }
      return g;
    };

    let rows = Array.isArray(data) ? data : [];
    let grouped = buildGrouped(rows);

    const missingIds = productIds.filter((id) => (grouped.get(id) || []).length < 1);
    for (const id of missingIds) {
      try {
        await fetchAndInsertEbayPriceIfConfigured(id, db);
      } catch (e) {
        console.warn(`[tracked-prices/batch] backfill skip ${id}:`, e?.message || e);
      }
    }

    if (missingIds.length > 0) {
      const { data: dataFresh, error: errFresh } = await db
        .from("ebay_prices")
        .select("product_id, price_eur")
        .in("product_id", productIds)
        .gte("fetched_at", since);
      if (!errFresh && Array.isArray(dataFresh)) {
        rows = dataFresh;
        grouped = buildGrouped(rows);
      }
    }

    /** Liste brute des prix 90j par produit — médiane + filtre outliers côté client. */
    const priceEntries = {};
    for (const id of productIds) {
      const arr = grouped.get(id) || [];
      priceEntries[id] = arr.filter((p) => Number.isFinite(p));
    }

    return res.json({ priceEntries });
  } catch (err) {
    if (err.code === "SUPABASE_CONFIG") {
      return res.json({
        priceEntries: Object.fromEntries(productIds.map((id) => [id, []])),
      });
    }
    console.error("[tracked-prices/batch]", err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ─── Debug : exécute syncAllPrices une fois et renvoie le résultat HTTP ──────
app.get("/api/ebay/sync-now", async (req, res) => {
  console.log("[ebay/sync-now] Exécution immédiate de syncAllPrices (debug)");
  try {
    const result = await syncAllPrices();
    console.log("[ebay/sync-now] Terminé :", JSON.stringify(result));
    return res.json({ ok: true, result });
  } catch (err) {
    console.error("[ebay/sync-now] Échec :", err?.message || err, err?.code || "");
    return res.status(500).json({
      ok: false,
      error: err?.message || String(err),
      code: err?.code,
    });
  }
});

// ─── Route admin : déclenche la sync manuellement ────────────────────────────
app.get("/api/admin/sync-prices", async (req, res) => {
  console.log("[admin] Sync manuelle déclenchée via GET /api/admin/sync-prices");
  // Répondre immédiatement et lancer la sync en arrière-plan
  res.json({ ok: true, message: "Synchronisation eBay lancée en arrière-plan — consulte les logs Railway" });

  try {
    const result = await syncAllPrices();
    console.log("[admin] Sync terminée :", JSON.stringify(result));
  } catch (err) {
    console.error("[admin] Sync échouée :", err.message);
  }
});

// ─── Health check (Railway / Vercel probes) ──────────────────────────────────
app.get("/api/health", (_req, res) => res.json({ status: "ok", ts: Date.now() }));

// ─── Démarrage du job de sync automatique (toutes les 24h) ───────────────────
startPriceSyncJob();

const PORT = process.env.PORT || 4000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ SERVER IS READY ON PORT ${PORT}`);
});