import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useUser } from "@clerk/react";
import { Package, TrendingUp, ShoppingCart, Bell } from "lucide-react";
import { useTheme } from "../state/ThemeContext";
import { STAT_CARD_VALUE_CLASS } from "../constants/statCardValueClass";
import { apiUrl, getApiBaseUrl } from "../config/apiUrl";

const VITE_MONTHLY_PRICE_ID = import.meta.env.VITE_STRIPE_MONTHLY_PRICE_ID as string | undefined;
const VITE_ANNUAL_PRICE_ID = import.meta.env.VITE_STRIPE_ANNUAL_PRICE_ID as string | undefined;

const benefits = [
  {
    Icon: Package,
    label: "Collection illimitée",
    sub: "Ajoutez autant d'items que vous voulez. Displays, ETB, UPC... aucune limite.",
  },
  {
    Icon: TrendingUp,
    label: "Graphiques d'évolution des prix",
    sub: "Suivez la valeur de chaque item sur 1 an ou 2 ans et anticipez les meilleures opportunités.",
  },
  {
    Icon: ShoppingCart,
    label: "Accès complet au Marché",
    sub: "Consultez les prix du marché en temps réel et comparez la valeur de vos items.",
  },
  {
    Icon: Bell,
    label: "Alertes prix",
    sub: "Notification quand un item monte ou descend. Ne ratez plus jamais une opportunité.",
  },
  {
    Icon: Bell,
    label: "Mode sombre",
    sub: "Personnalisez votre expérience avec le thème sombre, exclusif Boss Access.",
  },
];

export function PremiumPage() {
  const { user } = useUser();
  const { theme } = useTheme();
  const accentGold = theme === "dark" ? "#FBBF24" : "#D4A757";
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [plan, setPlan] = useState<"monthly" | "annual">("monthly");
  const success = searchParams.get("success") === "1";
  const canceled = searchParams.get("canceled") === "1";

  const isAnnual = plan === "annual";
  const selectedPriceLabel = isAnnual ? "39,99 € par an" : "3,99 € par mois";

  const handleSubscribe = async () => {
    setLoading(true);
    setError(null);
    try {
      if (!user?.id) {
        setError("Connectez-vous pour souscrire — compte requis pour lier l’abonnement.");
        return;
      }
      const checkoutUrl = apiUrl("/api/checkout");
      console.log(
        "[Premium checkout] Calling exact URL:",
        checkoutUrl,
        "| API base:",
        getApiBaseUrl(),
        "| VITE_API_URL env:",
        import.meta.env.VITE_API_URL ?? "(défaut code / .env.*)"
      );
      const baseUrl = window.location.origin;
      const priceId =
        plan === "annual"
          ? VITE_ANNUAL_PRICE_ID
          : VITE_MONTHLY_PRICE_ID;
      const payload = {
        success_url: `${baseUrl}/success`,
        cancel_url: `${baseUrl}/premium?canceled=1`,
        client_reference_id: user.id,
        userId: user.id,
        plan,
        ...(priceId && { priceId }),
      };
      console.log(
        "[Premium checkout] plan:",
        plan,
        "Clerk userId:",
        user.id,
        "priceId sent to server:",
        priceId ?? "(none – server will use env)"
      );
      const res = await fetch(checkoutUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Checkout failed");
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      throw new Error("No redirect URL received");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors du checkout");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        background: "var(--bg-app)",
        color: "var(--text-secondary)",
        padding: "24px 16px",
        maxWidth: 480,
        margin: "0 auto",
        paddingBottom: 120,
      }}
    >
      <div
        style={{
          marginBottom: 24,
          borderRadius: 20,
          padding: "14px 16px 16px",
          background: "#FFFFFF",
          boxShadow: "0 6px 18px rgba(0,0,0,0.35)",
          border: "1px solid rgba(201,168,76,0.9)",
          textAlign: "center",
        }}
      >
        <h1
          className="title-section"
          style={{
            fontSize: "20px",
            fontWeight: "bold",
            color: accentGold,
            letterSpacing: "0.08em",
            textAlign: "center",
            marginBottom: 4,
          }}
        >
          COMMENCER VOTRE ESSAI GRATUIT
        </h1>
        <p
          className="title-section"
          style={{
            fontSize: "24px",
            fontWeight: "bold",
            color: accentGold,
            letterSpacing: "0.08em",
            textAlign: "center",
            marginBottom: 0,
          }}
        >
          1ER MOIS OFFERT
        </p>
      </div>

      {success && (
        <p
          style={{
            color: "var(--gain-green)",
            marginBottom: 16,
            fontWeight: 600,
            textAlign: "center",
          }}
        >
          Paiement réussi. Merci !
        </p>
      )}
      {canceled && (
        <p
          style={{
            color: "var(--text-secondary)",
            marginBottom: 16,
            textAlign: "center",
          }}
        >
          Paiement annulé.
        </p>
      )}
      {error && (
        <p style={{ color: "var(--loss-red)", marginBottom: 16, textAlign: "center" }}>
          {error}
        </p>
      )}

      <section
        style={{
          background: "var(--card-color)",
          borderRadius: 16,
          padding: 20,
          marginBottom: 24,
          boxShadow: "0 2px 12px rgba(0,0,0,0.15)",
          border: "1px solid var(--border-color, rgba(255,255,255,0.08))",
        }}
      >
        {/* Sélecteur de plan */}
        <div
          style={{
            display: "flex",
            gap: 8,
            marginBottom: 18,
            padding: 4,
            borderRadius: 9999,
            background: "var(--bg-app)",
          }}
        >
          <button
            type="button"
            onClick={() => setPlan("monthly")}
            style={{
              flex: 1,
              padding: "8px 10px",
              borderRadius: 9999,
              border: "none",
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              background: !isAnnual ? accentGold : "transparent",
              color: !isAnnual ? "#111827" : "var(--text-secondary)",
              boxShadow: !isAnnual ? "0 1px 4px rgba(201,168,76,0.4)" : "none",
            }}
          >
            Mensuel ·{" "}
            <span className={STAT_CARD_VALUE_CLASS}>
              3,99 € / mois
            </span>
          </button>
          <button
            type="button"
            onClick={() => setPlan("annual")}
            style={{
              flex: 1,
              padding: "8px 10px",
              borderRadius: 9999,
              border: "none",
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              background: isAnnual ? accentGold : "transparent",
              color: isAnnual ? "#111827" : "var(--text-secondary)",
              boxShadow: isAnnual ? "0 1px 4px rgba(201,168,76,0.4)" : "none",
              position: "relative",
            }}
          >
            Annuel ·{" "}
            <span className={STAT_CARD_VALUE_CLASS}>
              39,99 € / an
            </span>
            <span
              style={{
                position: "absolute",
                top: -12,
                right: 12,
                fontSize: 9,
                padding: "3px 8px",
                borderRadius: 9999,
                background: "#FFFFFF",
                color: accentGold,
                fontWeight: 600,
                border: "1px solid rgba(201,168,76,0.8)",
                boxShadow: "0 2px 6px rgba(0,0,0,0.25)",
                textTransform: "uppercase",
              }}
            >
              Plus avantageux
            </span>
          </button>
        </div>

        {benefits.map((b) => (
          <div
            key={b.label}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 12,
              marginBottom: 16,
            }}
          >
            <span
              style={{
                display: "flex",
                alignItems: "center",
                flexShrink: 0,
                width: 18,
                height: 18,
              }}
            >
              <b.Icon size={18} color={accentGold} strokeWidth={2} />
            </span>
            <div>
              <p
                style={{
                  fontWeight: 700,
                  color: "var(--text-primary)",
                  margin: 0,
                  fontSize: 14,
                }}
              >
                {b.label}
              </p>
              {b.sub && (
                <p
                  style={{
                    margin: "2px 0 0 0",
                    fontSize: 12,
                    color: "var(--text-secondary)",
                  }}
                >
                  {b.sub}
                </p>
              )}
            </div>
          </div>
        ))}
      </section>

      <p
        style={{
          marginBottom: 16,
          fontSize: 12,
          color: "var(--text-secondary)",
          textAlign: "center",
        }}
      >
        Essai gratuit de 30 jours. Résiliable à tout moment sans frais. Le prélèvement
        commencera à la fin de l&apos;essai, à hauteur de{" "}
        <span className={STAT_CARD_VALUE_CLASS}>
          {selectedPriceLabel}
        </span>
        .
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {!user?.id && (
          <p style={{ fontSize: 12, color: "var(--loss-red)", textAlign: "center", marginBottom: 8 }}>
            Connectez-vous pour souscrire — votre compte lie l’abonnement Premium.
          </p>
        )}
        <button
          type="button"
          onClick={handleSubscribe}
          disabled={loading || !user?.id}
          style={{
            width: "100%",
            padding: "14px 24px",
            borderRadius: 9999,
            background: theme === "dark" ? "linear-gradient(135deg, #FBBF24 0%, #FBBF24 100%)" : "linear-gradient(135deg, #D4A757 0%, #B18A4A 100%)",
            color: "#000",
            border: "1px solid #E5C284",
            boxShadow: "0 2px 4px rgba(201, 168, 76, 0.3)",
            cursor: loading ? "not-allowed" : "pointer",
            fontSize: 14,
            fontWeight: 700,
            letterSpacing: "0.05em",
            textTransform: "uppercase",
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? "Redirection…" : "Démarrer mon mois gratuit"}
        </button>
        <Link
          to="/"
          style={{
            display: "block",
            textAlign: "center",
            padding: "12px",
            color: "var(--text-secondary)",
            fontWeight: 600,
            fontSize: 14,
            textDecoration: "none",
          }}
        >
          ← Retour à l'accueil
        </Link>
      </div>
    </div>
  );
}
