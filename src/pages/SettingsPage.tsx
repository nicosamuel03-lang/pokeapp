import { useState, useEffect } from "react";
import { ArrowLeft, Sun, Moon, LogOut, Crown, ExternalLink, Bell, Mail, Star, Trash2, Lock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useClerk, useUser, useAuth } from "@clerk/react";
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
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const { getToken } = useAuth();

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

  const handleDeleteAccountConfirm = async () => {
    setDeleteLoading(true);
    try {
      const token = await getToken();
      const res = await fetch(`${API_BASE}/api/delete-account`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ userId: user?.id }),
      });
      if (!res.ok) throw new Error("Échec de la suppression");
      await signOut();
      window.location.href = "/";
    } catch {
      setDeleteLoading(false);
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
        <div style={rowStyle}>
          <button
            type="button"
            onClick={() => setDeleteModalOpen(true)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 0",
              border: "none",
              background: "transparent",
              color: "#ef4444",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            <Trash2 size={18} />
            Supprimer mon compte
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
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <button
              type="button"
              onClick={isPremium ? toggleTheme : undefined}
              disabled={!isPremium}
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
                cursor: isPremium ? "pointer" : "not-allowed",
                padding: 0,
                opacity: isPremium ? 1 : 0.4,
              }}
            >
              {theme === "dark" ? <Sun size={20} strokeWidth={2} /> : <Moon size={20} strokeWidth={2} />}
            </button>
            {!isPremium && (
              <Lock size={14} color="var(--text-secondary)" aria-hidden />
            )}
          </div>
        </div>

        {/* ABONNEMENT */}
        <h2 className="title-section" style={sectionHeaderStyle}>
          ABONNEMENT
        </h2>
        <div
          style={{
            ...rowStyle,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
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
            <>
              <span style={{ fontSize: 14, color: "var(--text-primary)" }}>
                Passez en Boss Access pour débloquer toutes les fonctionnalités
              </span>
              <button
                type="button"
                onClick={() => navigate("/premium")}
                aria-label="Passer en Boss Access"
                style={{
                  width: "44px",
                  height: "44px",
                  borderRadius: "50%",
                  minWidth: "44px",
                  minHeight: "44px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: "#C9A84C",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                <Crown size={20} />
              </button>
            </>
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

        {/* SUPPORT */}
        <h2 className="title-section" style={sectionHeaderStyle}>
          SUPPORT
        </h2>
        <a
          href="mailto:support@pokevault.app"
          style={{
            ...rowStyle,
            textDecoration: "none",
            color: "var(--text-primary)",
            fontSize: 14,
          }}
        >
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Mail size={18} color="var(--text-secondary)" />
            Nous contacter
          </span>
          <ExternalLink size={14} color="var(--text-secondary)" />
        </a>
        <a
          href="https://apps.apple.com"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            ...rowStyle,
            textDecoration: "none",
            color: "var(--text-primary)",
            fontSize: 14,
          }}
        >
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Star size={18} color="var(--text-secondary)" />
            Noter l&apos;app
          </span>
          <ExternalLink size={14} color="var(--text-secondary)" />
        </a>

        {/* NOTIFICATIONS */}
        <h2 className="title-section" style={sectionHeaderStyle}>
          NOTIFICATIONS
        </h2>
        <div style={{ ...rowStyle, borderBottom: "none", paddingBottom: 20 }}>
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

      <p
        style={{
          textAlign: "center",
          color: "#666666",
          fontSize: 12,
          marginTop: 32,
          marginBottom: 100,
        }}
      >
        PokéVault v1.0.0
      </p>

      {/* Modal confirmation suppression compte */}
      {deleteModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 50,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
            background: "var(--overlay-bg)",
            backdropFilter: "blur(4px)",
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 320,
              borderRadius: 16,
              padding: 20,
              background: "var(--card-color)",
              boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
            }}
          >
            <p
              style={{
                fontSize: 16,
                fontWeight: 600,
                color: "var(--text-primary)",
                marginBottom: 8,
              }}
            >
              Supprimer mon compte
            </p>
            <p
              style={{
                fontSize: 14,
                color: "var(--text-secondary)",
                marginBottom: 20,
                lineHeight: 1.5,
              }}
            >
              Êtes-vous sûr ? Cette action est irréversible.
            </p>
            <div
              style={{
                display: "flex",
                gap: 12,
                justifyContent: "flex-end",
              }}
            >
              <button
                type="button"
                onClick={() => !deleteLoading && setDeleteModalOpen(false)}
                disabled={deleteLoading}
                style={{
                  padding: "10px 18px",
                  borderRadius: 9999,
                  border: "1px solid var(--border-color)",
                  background: "var(--input-bg)",
                  color: "var(--text-secondary)",
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: deleteLoading ? "default" : "pointer",
                }}
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleDeleteAccountConfirm}
                disabled={deleteLoading}
                style={{
                  padding: "10px 18px",
                  borderRadius: 9999,
                  border: "none",
                  background: "#ef4444",
                  color: "#fff",
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: deleteLoading ? "default" : "pointer",
                  opacity: deleteLoading ? 0.8 : 1,
                }}
              >
                {deleteLoading ? "Suppression…" : "Supprimer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
