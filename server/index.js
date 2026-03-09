require("dotenv").config({
  path: require("path").resolve(__dirname, "../.env.local"),
});
const express = require("express");
const cors = require("cors");
const Stripe = require("stripe");

const app = express();
// CORS doit être le premier middleware pour autoriser le front
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type"],
  })
);
app.use(express.json());

console.log(
  "TESTING KEY:",
  process.env.STRIPE_SECRET_KEY ? "Key is loaded" : "KEY IS MISSING"
);
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

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
