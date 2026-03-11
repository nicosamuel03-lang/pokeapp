import { useEffect } from "react";
import { CheckCircle2 } from "lucide-react";
import { useUser } from "@clerk/react";
import { supabase } from "../lib/supabase";
import { usePremium } from "../hooks/usePremium";

export function SuccessPage() {
  const { user } = useUser();
  const { setPremiumSuccess } = usePremium();

  useEffect(() => {
    if (!user?.id) return;

    let cancelled = false;

    (async () => {
      await supabase
        .from("profiles")
        .update({ is_premium: true })
        .eq("id", user.id);

      if (cancelled) return;
      setPremiumSuccess();
      try {
        window.localStorage.setItem("pokevault_is_premium", "true");
      } catch {
        /* ignore */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.id, setPremiumSuccess]);

  const handleAccess = () => {
    window.location.href = "/";
  };

  return (
    <div
      style={{
        background: "var(--bg-app)",
        color: "var(--text-secondary)",
        padding: "48px 16px 32px",
        minHeight: "100vh",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 420,
          borderRadius: 24,
          padding: "28px 24px 22px",
          background:
            "radial-gradient(circle at top, rgba(212,167,87,0.20), transparent 55%), var(--card-color)",
          boxShadow: "0 16px 40px rgba(0,0,0,0.40)",
          textAlign: "center",
          margin: "0 auto",
        }}
      >
        <div
          className="success-check-anim"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 72,
            height: 72,
            borderRadius: "9999px",
            marginBottom: 20,
            background:
              "radial-gradient(circle at 30% 0, #FFF7E1, #D4A757)",
            boxShadow: "0 0 0 1px rgba(0,0,0,0.3)",
          }}
        >
          <CheckCircle2 size={40} color="#111827" strokeWidth={2.4} />
        </div>

        <h1
          className="title-section"
          style={{
            fontSize: "22px",
            marginBottom: 8,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: "#D4A757",
          }}
        >
          Bienvenue Boss&nbsp;!
        </h1>
        <p
          style={{
            fontSize: 14,
            lineHeight: 1.6,
            color: "var(--text-secondary)",
            marginBottom: 20,
          }}
        >
          Ton abonnement Premium est maintenant actif. Ta collection est
          débloquée en illimité et toutes les fonctionnalités BOSS ACCESS
          sont disponibles.
        </p>
        <p
          style={{
            fontSize: 12,
            color: "var(--text-secondary)",
            marginBottom: 24,
          }}
        >
          Tu peux modifier ta collection, suivre l&apos;évolution de la valeur
          et profiter des alertes prix dès maintenant.
        </p>

        <button
          type="button"
          onClick={handleAccess}
          style={{
            width: "100%",
            padding: "12px 20px",
            borderRadius: 9999,
            background: "#D4A757",
            color: "#111827",
            border: "none",
            fontSize: 14,
            fontWeight: 700,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            cursor: "pointer",
          }}
        >
          Accéder à ma collection
        </button>
      </div>
    </div>
  );
}

