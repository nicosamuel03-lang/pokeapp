import { useNavigate } from "react-router-dom";
import { Star } from "lucide-react";
import { usePremium } from "../hooks/usePremium";
import { useTheme } from "../state/ThemeContext";

export function PremiumBanner() {
  const navigate = useNavigate();
  const { isPremium } = usePremium();
  const { theme } = useTheme();
  const isLight = theme === "light";

  if (isPremium) {
    const badgeBorder = isLight ? "#B8860B" : "rgba(212, 167, 87, 0.6)";
    const badgeTextColor = isLight ? "#8B6914" : "#FBBF24";
    const starColor = isLight ? "#8B6914" : "#FDE68A";
    const badgeBgTint = isLight ? "rgba(184, 134, 11, 0.12)" : "rgba(212, 167, 87, 0.18)";
    const badgeShadow = isLight ? "0 0 0 1px rgba(139, 105, 20, 0.25)" : "0 0 0 1px rgba(0,0,0,0.4)";

    return (
      <button
        type="button"
        onClick={() => navigate("/mon-abonnement")}
        style={{
          border: `1px solid ${badgeBorder}`,
          borderRadius: 9999,
          padding: "6px 10px",
          marginBottom: 8,
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          background: `radial-gradient(circle at 0 0, ${badgeBgTint}, transparent 55%), var(--card-color)`,
          boxShadow: badgeShadow,
          cursor: "pointer",
        }}
      >
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 18,
            height: 18,
            borderRadius: "9999px",
            background: badgeBgTint,
          }}
        >
          <Star size={12} color={starColor} strokeWidth={2.4} />
        </span>
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: badgeTextColor,
            whiteSpace: "nowrap",
          }}
        >
          Boss Access
        </span>
      </button>
    );
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
          background: "linear-gradient(135deg, #D4A757 0%, #B18A4A 100%)",
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
