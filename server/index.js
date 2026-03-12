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
    const sig = req.headers["stripe-signature"];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error("STRIPE_WEBHOOK_SECRET is not set");
      return res.status(500).send("Webhook secret missing");
    }
    let event;
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (err) {
      console.error("Webhook signature verification failed:", err?.message);
      return res.status(400).send(`Webhook Error: ${err?.message}`);
    }
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const clerkUserId = session.client_reference_id;
      const subscriptionId = session.subscription || null;
      if (clerkUserId && supabase) {
        const { error } = await supabase
          .from("users")
          .upsert(
            {
              id: clerkUserId,
              is_premium: true,
              stripe_subscription_id: subscriptionId,
            },
            { onConflict: "id" }
          );
        if (error) {
          console.error("Supabase upsert failed:", error);
          return res.status(500).send("Failed to update premium status");
        }
        console.log(
          "Premium activated for user:",
          clerkUserId,
          "subscription:",
          subscriptionId
        );
      }
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
console.log("✅ Stripe Server is ready with Secret Key");

app.post("/api/checkout", async (req, res) => {
  console.log("FRONTEND IS CALLING ME!", req.body);
  try {
    const baseUrl = req.body.base_url || "http://localhost:5173";
    const success_url =
      req.body.success_url || `${baseUrl}/success`;
    const cancel_url =
      req.body.cancel_url || `${baseUrl}/premium?canceled=1`;
    const client_reference_id = req.body.client_reference_id || null;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "subscription",
      line_items: [
        {
          price_data: {
            currency: "eur",
            product_data: {
              name: "Premium Access (2.99€)",
            },
            unit_amount: 299,
            recurring: {
              interval: "month",
            },
          },
          quantity: 1,
        },
      ],
      success_url,
      cancel_url,
      client_reference_id,
    });

    return res.json({ url: session.url });
  } catch (err) {
    console.error("STRIPE / SERVER ERROR:", err?.message || err);
    return res
      .status(500)
      .json({ error: err?.message || "Unknown server error" });
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
