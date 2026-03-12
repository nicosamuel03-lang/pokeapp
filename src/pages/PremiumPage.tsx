import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useUser } from "@clerk/react";
import { Package, TrendingUp, ShoppingCart, Bell } from "lucide-react";

const CHECKOUT_URL = "https://pokeapp-production-52e4.up.railway.app/api/checkout";

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
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const success = searchParams.get("success") === "1";
  const canceled = searchParams.get("canceled") === "1";

  const handleSubscribe = async () => {
    setLoading(true);
    setError(null);
    try {
      const baseUrl = window.location.origin;
      const res = await fetch(CHECKOUT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          success_url: `${baseUrl}/success`,
          cancel_url: `${baseUrl}/premium?canceled=1`,
          client_reference_id: user?.id ?? null,
        }),
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
      <h1
        className="title-section"
        style={{
          fontSize: "22px",
          color: "#C9A84C",
          marginBottom: 4,
          letterSpacing: "0.08em",
          textAlign: "center",
        }}
      >
        BOSS ACCESS
      </h1>
      <p
        style={{
          textAlign: "center",
          fontSize: "18px",
          fontWeight: 700,
          color: "var(--text-primary)",
          marginBottom: 24,
        }}
      >
        €3,99 / mois
      </p>

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
              <b.Icon size={18} color="#C9A84C" strokeWidth={2} />
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
        Résiliable à tout moment. Aucun engagement.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <button
          type="button"
          onClick={handleSubscribe}
          disabled={loading}
          style={{
            width: "100%",
            padding: "14px 24px",
            borderRadius: 9999,
            background: "linear-gradient(135deg, #C9A84C 0%, #B18A4A 100%)",
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
          {loading ? "Redirection…" : "S'abonner maintenant"}
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
