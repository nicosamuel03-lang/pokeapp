import { useNavigate } from "react-router-dom";
import { useSubscription } from "../state/SubscriptionContext";
import { useTheme } from "../state/ThemeContext";


export function PremiumBanner() {
  const navigate = useNavigate();
  const { isPremium, isLoading } = useSubscription();
  console.log("[RENDER] PremiumBanner", "isPremium:", isPremium, "isLoading:", isLoading, new Date().toISOString());
  const { theme } = useTheme();
  const accentGold = theme === "dark" ? "#FBBF24" : "#D4A757";
  const buttonBg = theme === "dark" ? "#FBBF24" : "#D4A757";

  if (isLoading || isPremium) {
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
          fontSize: 12,
          fontWeight: 600,
          letterSpacing: "0.02em",
          textTransform: "uppercase",
          color: "#111827",
          background: buttonBg,
          border: "none",
          borderRadius: 9999,
          cursor: "pointer",
          flexShrink: 0,
        }}
      >
        Premium
      </button>
    </section>
  );
}
