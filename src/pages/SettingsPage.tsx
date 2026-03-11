import { useState, useEffect } from "react";
import { ArrowLeft, Sun, Moon, LogOut, Crown, ExternalLink, Bell } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useClerk, useUser } from "@clerk/react";
import { useTheme } from "../state/ThemeContext";
import { usePremium } from "../hooks/usePremium";

const NOTIFICATIONS_STORAGE_KEY = "pokevault_notifications_enabled";
const API_BASE = "https://pokeapp-production-52e4.up.railway.app";

const sectionHeaderStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "#D4A757",
  padding: "12px 0 6px 0",
  marginTop: 4,
};

const rowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  minHeight: 48,
  padding: "12px 0",
  borderBottom: "1px solid var(--border-color)",
  gap: 12,
};

export function SettingsPage() {
  const navigate = useNavigate();
  const { signOut } = useClerk();
  const { user } = useUser();
  const { theme, toggleTheme } = useTheme();
  const { isPremium } = usePremium();
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelLinkHover, setCancelLinkHover] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(NOTIFICATIONS_STORAGE_KEY);
      setNotificationsEnabled(stored === "true");
    } catch {
      /* ignore */
    }
  }, []);

  const handleNotificationsToggle = (enabled: boolean) => {
    setNotificationsEnabled(enabled);
    try {
      window.localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, String(enabled));
    } catch {
      /* ignore */
    }
  };

  const handleCancelSubscription = async () => {
    if (!user?.id) return;
    setCancelLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/cancel-subscription`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id }),
      });
      if (!res.ok) throw new Error("Échec de l'annulation");
      window.location.href = "/";
    } catch {
      setCancelLoading(false);
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
        onClick={() => navigate(-1)}
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
          marginBottom: 24,
          letterSpacing: "0.08em",
          textAlign: "left",
        }}
      >
        Paramètres
      </h1>

      <div
        style={{
          borderRadius: 16,
          padding: "0 16px",
          background: "var(--card-color)",
          boxShadow: "0 2px 12px rgba(0,0,0,0.18)",
        }}
      >
        {/* COMPTE */}
        <h2 className="title-section" style={{ ...sectionHeaderStyle, marginTop: 0 }}>
          COMPTE
        </h2>
        <div style={rowStyle}>
          <button
            type="button"
            onClick={() => signOut()}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 0",
              border: "none",
              background: "transparent",
              color: "var(--text-primary)",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            <LogOut size={18} />
            Déconnexion
          </button>
        </div>

        {/* APPARENCE */}
        <h2 className="title-section" style={sectionHeaderStyle}>
          APPARENCE
        </h2>
        <div style={rowStyle}>
          <span style={{ fontSize: 14, color: "var(--text-primary)" }}>
            Thème clair / sombre
          </span>
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={theme === "dark" ? "Passer en mode clair" : "Passer en mode sombre"}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 44,
              height: 44,
              borderRadius: "50%",
              background: theme === "dark" ? "var(--bg-card-elevated)" : "#D4A757",
              color: theme === "dark" ? "var(--text-secondary)" : "#111827",
              border: "none",
              cursor: "pointer",
              padding: 0,
            }}
          >
            {theme === "dark" ? <Sun size={20} strokeWidth={2} /> : <Moon size={20} strokeWidth={2} />}
          </button>
        </div>

        {/* ABONNEMENT */}
        <h2 className="title-section" style={sectionHeaderStyle}>
          ABONNEMENT
        </h2>
        <div style={{ ...rowStyle, flexDirection: isPremium ? "row" : "column", alignItems: isPremium ? "center" : "stretch" }}>
          {isPremium ? (
            <>
              <p
                style={{
                  fontSize: 14,
                  color: "var(--text-primary)",
                  margin: 0,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <Crown size={18} color="#D4A757" />
                Boss Access actif
              </p>
              <button
                type="button"
                onClick={handleCancelSubscription}
                disabled={cancelLoading}
                onMouseEnter={() => setCancelLinkHover(true)}
                onMouseLeave={() => setCancelLinkHover(false)}
                style={{
                  padding: 0,
                  border: "none",
                  background: "none",
                  color: "#ef4444",
                  fontSize: 12,
                  cursor: cancelLoading ? "default" : "pointer",
                  opacity: cancelLoading ? 0.7 : 1,
                  textDecoration: cancelLinkHover && !cancelLoading ? "underline" : "none",
                }}
              >
                {cancelLoading ? "Annulation…" : "Annuler"}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => navigate("/premium")}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                padding: "12px 16px",
                borderRadius: 9999,
                background: "#D4A757",
                color: "#111827",
                border: "none",
                fontSize: 14,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              <Crown size={18} />
              Passer en Boss Access
            </button>
          )}
        </div>

        {/* LÉGAL */}
        <h2 className="title-section" style={sectionHeaderStyle}>
          LÉGAL
        </h2>
        <a
          href="/cgu"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            ...rowStyle,
            textDecoration: "none",
            color: "var(--text-primary)",
            fontSize: 14,
          }}
        >
          Conditions Générales d&apos;Utilisation
          <ExternalLink size={14} color="var(--text-secondary)" />
        </a>
        <a
          href="/privacy"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            ...rowStyle,
            textDecoration: "none",
            color: "var(--text-primary)",
            fontSize: 14,
            borderBottom: "none",
          }}
        >
          Politique de confidentialité
          <ExternalLink size={14} color="var(--text-secondary)" />
        </a>

        {/* NOTIFICATIONS */}
        <h2 className="title-section" style={sectionHeaderStyle}>
          NOTIFICATIONS
        </h2>
        <div style={{ ...rowStyle, borderBottom: "none", paddingBottom: 16 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: "var(--text-primary)" }}>
            <Bell size={18} />
            Activer les notifications
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={notificationsEnabled}
            onClick={() => handleNotificationsToggle(!notificationsEnabled)}
            style={{
              width: 48,
              height: 28,
              borderRadius: 9999,
              border: "none",
              cursor: "pointer",
              background: notificationsEnabled ? "#D4A757" : "var(--input-bg)",
              position: "relative",
            }}
          >
            <span
              style={{
                position: "absolute",
                top: 2,
                left: notificationsEnabled ? 22 : 2,
                width: 24,
                height: 24,
                borderRadius: "50%",
                background: "#fff",
                boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
                transition: "left 0.2s ease",
              }}
            />
          </button>
        </div>
      </div>
    </div>
  );
}
