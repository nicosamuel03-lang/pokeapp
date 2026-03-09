import { useState } from "react";
import { useSearchParams } from "react-router-dom";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

export function PremiumPage() {
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const success = searchParams.get("success") === "1";
  const canceled = searchParams.get("canceled") === "1";

  const handleCheckout = async () => {
    setLoading(true);
    setError(null);
    try {
      const baseUrl = window.location.origin;
      const res = await fetch(`${API_URL}/api/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          success_url: `${baseUrl}/premium?success=1`,
          cancel_url: `${baseUrl}/premium?canceled=1`,
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
    <div style={{ padding: "24px 16px", maxWidth: 480, margin: "0 auto" }}>
      <h2 className="app-heading" style={{ fontSize: "20px", color: "var(--text-primary)", marginBottom: 8 }}>
        Accès Premium
      </h2>
      <p style={{ color: "var(--text-secondary)", marginBottom: 24 }}>
        Accès Premium Giovanni Collection — 9,99 €
      </p>
      {success && (
        <p style={{ color: "var(--gain-green)", marginBottom: 16, fontWeight: 600 }}>
          Paiement réussi. Merci !
        </p>
      )}
      {canceled && (
        <p style={{ color: "var(--text-secondary)", marginBottom: 16 }}>
          Paiement annulé.
        </p>
      )}
      {error && (
        <p style={{ color: "var(--loss-red)", marginBottom: 16 }}>
          {error}
        </p>
      )}
      <button
        type="button"
        onClick={handleCheckout}
        disabled={loading}
        style={{
          padding: "12px 24px",
          borderRadius: "9999px",
          background: "#D4A757",
          color: "#000",
          border: "none",
          cursor: loading ? "not-allowed" : "pointer",
          fontSize: 14,
          fontWeight: 600,
          opacity: loading ? 0.7 : 1,
        }}
      >
        {loading ? "Redirection…" : "Continue"}
      </button>
    </div>
  );
}
