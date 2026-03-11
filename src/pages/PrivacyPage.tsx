import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

export function PrivacyPage() {
  return (
    <div
      style={{
        background: "var(--bg-app)",
        color: "var(--text-secondary)",
        padding: "24px 16px",
        maxWidth: 480,
        margin: "0 auto",
        minHeight: "100vh",
      }}
    >
      <Link
        to="/settings"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          marginBottom: 16,
          fontSize: 13,
          color: "var(--text-secondary)",
          textDecoration: "none",
        }}
      >
        <ArrowLeft size={16} />
        <span>Retour</span>
      </Link>

      <h1
        className="title-section"
        style={{
          fontSize: "22px",
          color: "#D4A757",
          marginBottom: 24,
          letterSpacing: "0.08em",
        }}
      >
        Politique de confidentialité
      </h1>

      <div
        style={{
          background: "var(--card-color)",
          borderRadius: 16,
          padding: 20,
          boxShadow: "0 2px 12px rgba(0,0,0,0.18)",
          lineHeight: 1.6,
          fontSize: 14,
          color: "var(--text-primary)",
        }}
      >
        <p style={{ marginBottom: 12 }}>
          Cette politique de confidentialité décrit comment PokéVault collecte, utilise
          et protège vos données personnelles.
        </p>
        <p style={{ marginBottom: 12 }}>
          Nous nous engageons à préserver la confidentialité des informations que vous
          nous fournissez. Le contenu complet de la politique sera ajouté prochainement.
        </p>
        <p style={{ marginBottom: 0 }}>
          Dernière mise à jour : placeholder.
        </p>
      </div>
    </div>
  );
}
