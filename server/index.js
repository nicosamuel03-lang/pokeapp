require("dotenv").config({
  path: require("path").resolve(__dirname, "../.env.local"),
});
const express = require("express");
const cors = require("cors");
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

    const upsertPremiumForUser = async ({
      clerkUserId,
      isPremium,
      subscriptionId,
      customerId,
    }) => {
      console.log("[stripe webhook] upsertPremiumForUser — clerkUserId:", clerkUserId, "isPremium:", isPremium);
      if (!clerkUserId) {
        console.warn("[stripe webhook] upsertPremiumForUser — SKIP (no clerkUserId)");
        return;
      }
      if (!supabase) {
        console.error("[stripe webhook] upsertPremiumForUser — SKIP (Supabase client missing: set SUPABASE_SERVICE_KEY)");
        return;
      }
      const payload = {
        id: clerkUserId,
        is_premium: !!isPremium,
        ...(subscriptionId ? { stripe_subscription_id: subscriptionId } : {}),
        ...(customerId ? { stripe_customer_id: customerId } : {}),
      };
      console.log("[stripe webhook] Supabase upsert payload:", JSON.stringify(payload));
      const { error, data } = await supabase
        .from("users")
        .upsert(payload, { onConflict: "id" })
        .select();
      if (error) {
        console.error("[stripe webhook] Supabase upsert error:", error);
        throw error;
      }
      console.log("[stripe webhook] Supabase upsert OK — rows:", data?.length ?? 0, data);
    };

    const updatePremiumBySubscriptionId = async ({
      subscriptionId,
      isPremium,
    }) => {
      if (!subscriptionId || !supabase) return false;
      const { data, error } = await supabase
        .from("users")
        .select("id")
        .eq("stripe_subscription_id", subscriptionId)
        .maybeSingle();
      if (error || !data?.id) return false;
      const { error: updateError } = await supabase
        .from("users")
        .update({ is_premium: !!isPremium })
        .eq("id", data.id);
      if (updateError) throw updateError;
      return true;
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
            subscriptionId,
            customerId,
          });
          console.log(
            "[stripe webhook] checkout.session.completed — Premium activated for:",
            clerkUserId,
            "subscription:",
            subscriptionId,
            "customer:",
            customerId
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
        const customerId = sub.customer || null;
        const clerkUserId =
          sub?.metadata?.clerkUserId ||
          sub?.metadata?.clerk_user_id ||
          null;

        const premiumNow = isActiveSubscriptionStatus(status);

        if (clerkUserId) {
          await upsertPremiumForUser({
            clerkUserId,
            isPremium: premiumNow,
            subscriptionId,
            customerId,
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
          const updated = await updatePremiumBySubscriptionId({
            subscriptionId,
            isPremium: premiumNow,
          });
          console.log(
            "[stripe webhook] subscription sync via stripe_subscription_id:",
            subscriptionId,
            "status:",
            status,
            "updatedRow:",
            updated
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

const PORT = 4000;
app.listen(4000, "0.0.0.0", () =>
  console.log("SERVER STRIPE IS READY ON PORT 4000")
);
