import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { useAuth, useSignIn, useSignUp } from "@clerk/react";

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

const GOLD_BTN: CSSProperties = {
  width: "100%",
  padding: "12px 16px",
  border: "none",
  borderRadius: 10,
  background: "var(--accent-yellow, #D4A757)",
  color: "#1a1a1a",
  fontWeight: 600,
  fontSize: 16,
  cursor: "pointer",
};

const INPUT_STYLE: CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 8,
  border: "1px solid #ddd",
  fontSize: 16,
  boxSizing: "border-box",
};

type Tab = "connexion" | "inscription";

function clerkErrMessage(err: unknown): string {
  if (err && typeof err === "object" && "message" in err && typeof (err as { message: string }).message === "string") {
    return (err as { message: string }).message;
  }
  return "Une erreur est survenue.";
}

type Props = {
  open: boolean;
  onClose: () => void;
};

/** Modale connexion / inscription headless (sans <SignIn /> Clerk) — meilleure compat iOS PWA. */
export function ClerkSignInModal({ open, onClose }: Props) {
  const { isSignedIn, isLoaded } = useAuth();
  const { signIn } = useSignIn();
  const { signUp } = useSignUp();

  const [tab, setTab] = useState<Tab>("connexion");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (isSignedIn) onClose();
  }, [isSignedIn, onClose]);

  useEffect(() => {
    if (!open) {
      setError(null);
      setLoading(false);
      setOauthLoading(false);
    }
  }, [open]);

  const handleConnexion = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      if (!signIn) {
        setError("Connexion indisponible, réessayez.");
        return;
      }
      const id = email.trim();
      if (!id || !password) {
        setError("Renseignez l’e-mail et le mot de passe.");
        return;
      }
      setLoading(true);
      try {
        // Clerk v6 (future) : mot de passe via signIn.password (pas signIn.create avec password).
        const { error: pwErr } = await signIn.password({ identifier: id, password });
        if (pwErr) {
          setError(clerkErrMessage(pwErr));
          return;
        }
        const { error: finErr } = await signIn.finalize();
        if (finErr) {
          setError(clerkErrMessage(finErr));
        }
      } catch (err) {
        setError(clerkErrMessage(err));
      } finally {
        setLoading(false);
      }
    },
    [signIn, email, password]
  );

  const handleInscription = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      if (!signUp) {
        setError("Inscription indisponible, réessayez.");
        return;
      }
      const em = email.trim();
      if (!em || !password) {
        setError("Renseignez l’e-mail et le mot de passe.");
        return;
      }
      setLoading(true);
      try {
        const { error: suErr } = await signUp.password({ emailAddress: em, password });
        if (suErr) {
          setError(clerkErrMessage(suErr));
          return;
        }
        const { error: finErr } = await signUp.finalize();
        if (finErr) {
          setError(clerkErrMessage(finErr));
        }
      } catch (err) {
        setError(clerkErrMessage(err));
      } finally {
        setLoading(false);
      }
    },
    [signUp, email, password]
  );

  const handleGoogle = useCallback(async () => {
    setError(null);
    if (!signIn) {
      setError("Connexion indisponible, réessayez.");
      return;
    }
    const origin = window.location.origin;
    setOauthLoading(true);
    try {
      const { error: ssoErr } = await signIn.sso({
        strategy: "oauth_google",
        redirectUrl: `${origin}/sso-callback`,
        redirectCallbackUrl: `${origin}/`,
      });
      if (ssoErr) {
        setError(clerkErrMessage(ssoErr));
      }
    } catch (err) {
      setError(clerkErrMessage(err));
    } finally {
      setOauthLoading(false);
    }
  }, [signIn]);

  if (!open) return null;

  const busy = loading || oauthLoading || !isLoaded;
  const tabBtn = (id: Tab, label: string) => (
    <button
      type="button"
      onClick={() => {
        setTab(id);
        setError(null);
      }}
      style={{
        flex: 1,
        padding: "10px 8px",
        border: "none",
        borderBottom: tab === id ? "3px solid var(--accent-yellow, #D4A757)" : "3px solid transparent",
        background: "transparent",
        fontWeight: tab === id ? 700 : 500,
        color: tab === id ? "#1a1a1a" : "#666",
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
      onClick={(e) => e.target === e.currentTarget && !busy && onClose()}
    >
      <div onClick={(e) => e.stopPropagation()} style={PANEL_STYLE}>
        <button
          type="button"
          aria-label="Fermer"
          onClick={() => !busy && onClose()}
          style={{
            position: "absolute",
            top: 12,
            right: 12,
            border: "none",
            background: "transparent",
            fontSize: 22,
            lineHeight: 1,
            cursor: busy ? "not-allowed" : "pointer",
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

        {!isLoaded && <p style={{ color: "#666" }}>Chargement…</p>}

        {isLoaded && tab === "connexion" && (
          <form onSubmit={handleConnexion}>
            <label style={{ display: "block", marginBottom: 8, color: "#333", fontSize: 14 }}>E-mail</label>
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{ ...INPUT_STYLE, marginBottom: 12 }}
              disabled={busy}
            />
            <label style={{ display: "block", marginBottom: 8, color: "#333", fontSize: 14 }}>Mot de passe</label>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ ...INPUT_STYLE, marginBottom: 16 }}
              disabled={busy}
            />
            <button type="submit" style={GOLD_BTN} disabled={busy}>
              {loading ? "Connexion…" : "Se connecter"}
            </button>
          </form>
        )}

        {isLoaded && tab === "inscription" && (
          <form onSubmit={handleInscription}>
            <label style={{ display: "block", marginBottom: 8, color: "#333", fontSize: 14 }}>E-mail</label>
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{ ...INPUT_STYLE, marginBottom: 12 }}
              disabled={busy}
            />
            <label style={{ display: "block", marginBottom: 8, color: "#333", fontSize: 14 }}>Mot de passe</label>
            <input
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ ...INPUT_STYLE, marginBottom: 16 }}
              disabled={busy}
            />
            <button type="submit" style={GOLD_BTN} disabled={busy}>
              {loading ? "Inscription…" : "Créer un compte"}
            </button>
          </form>
        )}

        <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid #eee" }}>
          <button
            type="button"
            onClick={handleGoogle}
            disabled={busy}
            style={{
              ...GOLD_BTN,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
          >
            {oauthLoading ? "Redirection…" : "Continuer avec Google"}
          </button>
        </div>

        {error && (
          <p role="alert" style={{ marginTop: 12, color: "#b00020", fontSize: 14 }}>
            {error}
          </p>
        )}
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
}
