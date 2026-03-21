import { useEffect, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { SignIn, SignUp, useAuth } from "@clerk/react";

/** Overlay plein écran : au-dessus de tout le layout, scroll iOS, safe area PWA. */
const OVERLAY_STYLE: CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 9999,
  overflowY: "auto",
  overflowX: "visible",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  paddingTop: "env(safe-area-inset-top)",
  paddingBottom: "env(safe-area-inset-bottom)",
  paddingLeft: "env(safe-area-inset-left)",
  paddingRight: "env(safe-area-inset-right)",
  background: "rgba(0,0,0,0.5)",
  WebkitOverflowScrolling: "touch",
};

const PANEL_STYLE: CSSProperties = {
  position: "relative",
  background: "#ffffff",
  borderRadius: 16,
  padding: 24,
  maxWidth: 400,
  width: "min(92vw, 400px)",
  boxShadow: "0 8px 32px rgba(0,0,0,0.15)",
  alignSelf: "center",
  zIndex: 1,
};

type ActiveTab = "connexion" | "inscription";

type Props = {
  open: boolean;
  onClose: () => void;
};

const clerkAuthProps = {
  routing: "virtual" as const,
  fallbackRedirectUrl: "/" as const,
  signUpFallbackRedirectUrl: "/" as const,
  signInUrl: "/sign-in",
  signUpUrl: "/sign-up",
};

/**
 * Modale d’auth : wrapper (carte blanche, fermeture, titre) + composants Clerk officiels.
 * `routing="virtual"` évite la navigation vers /sign-in ou /sign-up.
 */
export function ClerkSignInModal({ open, onClose }: Props) {
  const { isSignedIn } = useAuth();
  const [activeTab, setActiveTab] = useState<ActiveTab>("connexion");

  useEffect(() => {
    if (isSignedIn) onClose();
  }, [isSignedIn, onClose]);

  useEffect(() => {
    if (!open) setActiveTab("connexion");
  }, [open]);

  if (!open) return null;

  const tabBtn = (id: ActiveTab, label: string) => (
    <button
      type="button"
      onClick={() => setActiveTab(id)}
      style={{
        flex: 1,
        padding: "10px 8px",
        border: "none",
        borderBottom: activeTab === id ? "3px solid var(--accent-yellow, #D4A757)" : "3px solid transparent",
        background: "transparent",
        fontWeight: activeTab === id ? 700 : 500,
        color: activeTab === id ? "#1a1a1a" : "#666",
        cursor: "pointer",
        fontSize: 15,
      }}
    >
      {label}
    </button>
  );

  const overlay = (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Connexion"
      style={OVERLAY_STYLE}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div onClick={(e) => e.stopPropagation()} style={PANEL_STYLE}>
        <button
          type="button"
          aria-label="Fermer"
          onClick={onClose}
          style={{
            position: "absolute",
            top: 12,
            right: 12,
            border: "none",
            background: "transparent",
            fontSize: 22,
            lineHeight: 1,
            cursor: "pointer",
            color: "#666",
          }}
        >
          ×
        </button>

        <h2 style={{ margin: "0 0 16px", fontSize: 20, color: "#1a1a1a" }}>Compte</h2>

        <div style={{ display: "flex", marginBottom: 20, gap: 0 }}>
          {tabBtn("connexion", "Connexion")}
          {tabBtn("inscription", "S'inscrire")}
        </div>

        {activeTab === "connexion" ? (
          <SignIn {...clerkAuthProps} />
        ) : (
          <SignUp {...clerkAuthProps} />
        )}
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
}
