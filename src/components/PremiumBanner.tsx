import { useNavigate } from "react-router-dom";
import { usePremium } from "../hooks/usePremium";
import { useTheme } from "../state/ThemeContext";

export function PremiumBanner() {
  const navigate = useNavigate();
  const { isPremium } = usePremium();
  const { theme } = useTheme();
  const accentGold = theme === "dark" ? "#FBBF24" : "#D4A757";
  const buttonBg = theme === "dark" ? "linear-gradient(135deg, #FBBF24 0%, #FBBF24 100%)" : "linear-gradient(135deg, #D4A757 0%, #B18A4A 100%)";

  if (isPremium) {
    return null;
  }

  const handlePremiumClick = () => {
    navigate("/premium");
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
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 6,
          flex: "1 1 auto",
          minWidth: 0,
        }}
      >
        <span
          className="title-section"
          style={{
            color: "#9ca3af",
            whiteSpace: "nowrap",
          }}
        >
          Accès Boss
        </span>
        <span
          style={{
            fontSize: 11,
            color: "var(--text-secondary)",
            whiteSpace: "nowrap",
          }}
        >
          3.99€ / mois
        </span>
      </div>
      <button
        type="button"
        onClick={handlePremiumClick}
        style={{
          padding: "6px 14px",
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: "0.02em",
          textTransform: "uppercase",
          color: "#FFFFFF",
          background: buttonBg,
          border: "1px solid #E5C284",
          borderRadius: 9999,
          boxShadow: "0 2px 4px rgba(212, 167, 87, 0.3)",
          cursor: "pointer",
          flexShrink: 0,
        }}
      >
        Premium
      </button>
    </section>
  );
}
