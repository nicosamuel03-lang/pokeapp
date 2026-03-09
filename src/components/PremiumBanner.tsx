import { useState } from "react";

export function PremiumBanner() {
  const [loading, setLoading] = useState(false);

  const handlePremiumClick = async () => {
    setLoading(true);
    try {
      // On utilise 127.0.0.1 au lieu de localhost pour éviter les blocages Windows
      const response = await fetch("http://127.0.0.1:4000/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          success_url: window.location.origin,
          cancel_url: window.location.origin,
        }),
      });

      if (!response.ok) {
        throw new Error(`Erreur serveur: ${response.status}`);
      }

      const data = await response.json();
      if (data.url) {
        window.location.assign(data.url);
      } else {
        alert("Erreur: Stripe n'a pas renvoyé de lien.");
      }
    } catch (err) {
      console.error(err);
      alert("ERREUR RÉELLE : " + (err as Error).message + " | Vérifie que le terminal affiche 'SERVER STRIPE IS READY ON PORT 4000'");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section
      style={{
        background: "var(--card-color)",
        borderRadius: 8,
        padding: "8px 12px",
        marginBottom: 12,
        boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
        border: "1px solid var(--border-color, rgba(255,255,255,0.06))",
        maxHeight: "15vh",
        minHeight: 40,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 10,
        flexWrap: "wrap",
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: 6, flex: "1 1 auto", minWidth: 0 }}>
        <span
          className="title-section"
          style={{
            color: "#9ca3af",
            whiteSpace: "nowrap",
          }}
        >
          Accès Boss
        </span>
        <span style={{ fontSize: 11, color: "var(--text-secondary)", whiteSpace: "nowrap" }}>
          2.99€ / mois
        </span>
      </div>
      <button
        type="button"
        onClick={handlePremiumClick}
        disabled={loading}
        style={{
          padding: "6px 14px",
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: "0.02em",
          textTransform: "uppercase",
          color: "#FFFFFF",
          background: "linear-gradient(135deg, #D4A757 0%, #B18A4A 100%)",
          border: "1px solid #E5C284",
          borderRadius: 9999,
          boxShadow: "0 2px 4px rgba(212, 167, 87, 0.3)",
          cursor: loading ? "not-allowed" : "pointer",
          opacity: loading ? 0.7 : 1,
          flexShrink: 0,
        }}
      >
        {loading ? "Chargement..." : "Premium"}
      </button>
    </section>
  );
}