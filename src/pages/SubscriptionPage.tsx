import { useState } from "react";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useUser } from "@clerk/react";
import { supabase } from "../lib/supabase";

const features = [
  {
    icon: "📦",
    title: "Collection illimitée",
    description:
      "Ajoutez autant d'items que vous voulez. Displays, ETB, UPC... aucune limite.",
  },
  {
    icon: "📈",
    title: "Graphiques d'évolution des prix",
    description:
      "Suivez la valeur de chaque item sur 1 an ou 2 ans et anticipez les meilleures opportunités.",
  },
  {
    icon: "🛒",
    title: "Accès complet au Marché",
    description:
      "Consultez les prix du marché en temps réel et comparez la valeur de vos items.",
  },
  {
    icon: "🔔",
    title: "Alertes prix",
    description:
      "Notification quand un item monte ou descend. Ne ratez plus jamais une opportunité.",
  },
  {
    icon: "🌙",
    title: "Mode sombre",
    description:
      "Personnalisez votre expérience avec le thème sombre, exclusif Boss Access.",
  },
];

export function SubscriptionPage() {
  const navigate = useNavigate();
  const { user } = useUser();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleCancel = async () => {
    setConfirmOpen(true);
  };

  const handleConfirmCancel = async () => {
    if (!user?.id) {
      setConfirmOpen(false);
      return;
    }
    try {
      setLoading(true);
      try {
        await supabase
          .from("users")
          .update({ is_premium: false })
          .eq("id", user.id);
      } catch {
        /* ignore */
      }
      try {
        window.localStorage.setItem("pokevault_is_premium", "false");
      } catch {
        /* ignore */
      }
      // Hard reload pour s'assurer que la home relit bien l'état à jour.
      window.location.href = "/";
    } finally {
      setLoading(false);
      setConfirmOpen(false);
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
      <button
        type="button"
        onClick={() => navigate("/")}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          marginBottom: 16,
          fontSize: 13,
          color: "var(--text-secondary)",
          background: "transparent",
          border: "none",
          padding: 0,
          cursor: "pointer",
        }}
      >
        <ArrowLeft size={16} />
        <span>Retour</span>
      </button>

      <h1
        className="title-section"
        style={{
          fontSize: "22px",
          color: "#D4A757",
          marginBottom: 4,
          letterSpacing: "0.08em",
          textAlign: "left",
        }}
      >
        BOSS ACCESS
      </h1>
      <p
        style={{
          fontSize: 16,
          fontWeight: 700,
          color: "var(--text-primary)",
          marginBottom: 20,
        }}
      >
        €2,99 / mois
      </p>

      <div
        style={{
          borderRadius: 16,
          padding: "16px 14px",
          background: "var(--card-color)",
          boxShadow: "0 2px 12px rgba(0,0,0,0.18)",
          marginBottom: 20,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 12,
          }}
        >
          <CheckCircle2 size={18} color="#22c55e" />
          <span
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: "var(--text-primary)",
            }}
          >
            Statut de l&apos;abonnement : Actif
          </span>
        </div>
        <p
          style={{
            fontSize: 12,
            color: "var(--text-secondary)",
            marginBottom: 8,
          }}
        >
          Votre accès Premium est actuellement actif. Vous profitez de :
        </p>
        <ul
          style={{
            listStyle: "none",
            padding: 0,
            margin: 0,
            display: "flex",
            flexDirection: "column",
            gap: 6,
            fontSize: 12,
            color: "var(--text-secondary)",
          }}
        >
          {features.map((f) => (
            <li
              key={f.title}
              style={{ display: "flex", flexDirection: "column", gap: 2 }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span>{f.icon}</span>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: "var(--text-primary)",
                  }}
                >
                  {f.title}
                </span>
              </div>
              <span
                style={{
                  fontSize: 11,
                  color: "var(--text-secondary)",
                  marginLeft: 20,
                }}
              >
                {f.description}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <button
        type="button"
        onClick={handleCancel}
        style={{
          width: "100%",
          padding: "11px 16px",
          borderRadius: 9999,
          border: "1px solid rgba(248, 113, 113, 0.9)",
          background: "rgba(127, 29, 29, 0.08)",
          color: "#fecaca",
          fontSize: 13,
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        Se désabonner
      </button>

      {confirmOpen && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center px-6"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 40,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "0 24px",
            background: "var(--overlay-bg)",
            backdropFilter: "blur(4px)",
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 320,
              borderRadius: 16,
              padding: "16px 16px 14px",
              background: "var(--card-color)",
              boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
            }}
          >
            <p
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: "var(--text-primary)",
                marginBottom: 8,
              }}
            >
              Confirmer l&apos;annulation ?
            </p>
            <p
              style={{
                fontSize: 12,
                color: "var(--text-secondary)",
                marginBottom: 14,
              }}
            >
              Votre accès BOSS ACCESS sera immédiatement désactivé.
            </p>
            <div
              style={{
                display: "flex",
                gap: 8,
                justifyContent: "flex-end",
              }}
            >
              <button
                type="button"
                onClick={() => !loading && setConfirmOpen(false)}
                style={{
                  padding: "8px 14px",
                  borderRadius: 9999,
                  border: "1px solid var(--border-color)",
                  background: "var(--input-bg)",
                  color: "var(--text-secondary)",
                  fontSize: 12,
                  fontWeight: 500,
                  cursor: "pointer",
                  opacity: loading ? 0.7 : 1,
                }}
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleConfirmCancel}
                disabled={loading}
                style={{
                  padding: "8px 16px",
                  borderRadius: 9999,
                  border: "1px solid rgba(248, 113, 113, 0.9)",
                  background: "rgba(127, 29, 29, 0.9)",
                  color: "#fee2e2",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: loading ? "default" : "pointer",
                  opacity: loading ? 0.8 : 1,
                }}
              >
                {loading ? "Annulation..." : "Confirmer"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ color: "red", fontSize: 24, padding: 20 }}>TEST 12345</div>
    </div>
  );
}

