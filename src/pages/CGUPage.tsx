import { Link } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { useTheme } from "../state/ThemeContext";

export function CGUPage() {
  const { theme } = useTheme();
  const accentGold = theme === "dark" ? "#FBBF24" : "#D4A757";
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
        <ChevronLeft size={28} strokeWidth={1.5} />
        <span>Retour</span>
      </Link>

      <h1
        className="title-section"
        style={{
          fontSize: "22px",
          color: accentGold,
          marginBottom: 24,
          letterSpacing: "0.08em",
        }}
      >
        Conditions Générales d&apos;Utilisation
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
          Les présentes Conditions Générales d&apos;Utilisation (CGU) régissent l&apos;accès
          et l&apos;utilisation de l&apos;application PokéVault.
        </p>
        <p style={{ marginBottom: 12 }}>
          En accédant à l&apos;application, vous acceptez d&apos;être lié par ces conditions.
          Le contenu complet des CGU sera ajouté prochainement.
        </p>
        <p style={{ marginBottom: 0 }}>
          Dernière mise à jour : placeholder.
        </p>
      </div>
    </div>
  );
}
