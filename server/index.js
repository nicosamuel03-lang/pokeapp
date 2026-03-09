require("dotenv").config({
  path: require("path").resolve(__dirname, "../.env.local"),
});
const express = require("express");
const cors = require("cors");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
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
    allowedHeaders: ["Content-Type"],
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
      if (clerkUserId && supabase) {
        const { error } = await supabase
          .from("users")
          .upsert(
            { id: clerkUserId, is_premium: true },
            { onConflict: "id" }
          );
        if (error) {
          console.error("Supabase upsert failed:", error);
          return res.status(500).send("Failed to update premium status");
        }
        console.log("Premium activated for user:", clerkUserId);
      }
    }
    res.json({ received: true });
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
      req.body.success_url || `${baseUrl}/premium?success=1`;
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

const PORT = 4000;
app.listen(4000, "0.0.0.0", () =>
  console.log("SERVER STRIPE IS READY ON PORT 4000")
);
