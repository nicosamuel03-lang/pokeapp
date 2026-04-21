import { useNavigate } from "react-router-dom";

export function AuthPage() {
  const navigate = useNavigate();

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--bg-app)",
        color: "var(--text-secondary)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        boxSizing: "border-box",
      }}
    >
      <div style={{ width: "100%", maxWidth: 360 }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
          <img
            src="/images/GIOVANNI_version_deux.png"
            alt="Giovanni"
            width={120}
            height={120}
            style={{ width: 120, height: 120, objectFit: "contain", marginBottom: 14 }}
          />
          <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: "0.14em", color: "#c91517" }}>
            GIOVANNI TCG
          </div>
          <div style={{ marginTop: 8, marginBottom: 18, fontSize: 13, color: "var(--text-secondary)" }}>
            Gérez votre collection Pokémon scellée
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <button
            type="button"
            onClick={() => navigate("/sign-up")}
            style={{
              width: "100%",
              padding: "14px 16px",
              borderRadius: 9999,
              border: "none",
              background: "var(--accent-yellow, #FBBF24)",
              color: "#111827",
              fontSize: 14,
              fontWeight: 800,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              cursor: "pointer",
            }}
          >
            S&apos;inscrire
          </button>
          <button
            type="button"
            onClick={() => navigate("/sign-in")}
            style={{
              width: "100%",
              padding: "14px 16px",
              borderRadius: 9999,
              border: "1px solid var(--accent-yellow, #FBBF24)",
              background: "transparent",
              color: "var(--accent-yellow, #FBBF24)",
              fontSize: 14,
              fontWeight: 800,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              cursor: "pointer",
            }}
          >
            Se connecter
          </button>
        </div>
      </div>
    </div>
  );
}

