import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { SignIn, SignUp, useAuth } from "@clerk/react";
import type { Appearance, LocalizationResource } from "@clerk/types";
import { frFR } from "@clerk/localizations";
import { useTheme } from "../state/ThemeContext";
import { authModalRouter } from "../utils/authModalRouter";

const SIGN_IN_PATH = import.meta.env.VITE_CLERK_SIGN_IN_URL || "/sign-in";
const SIGN_UP_PATH = import.meta.env.VITE_CLERK_SIGN_UP_URL || "/sign-up";
const AFTER_SIGN_IN = import.meta.env.VITE_CLERK_AFTER_SIGN_IN_URL || "/";
const AFTER_SIGN_UP = import.meta.env.VITE_CLERK_AFTER_SIGN_UP_URL || "/";

const GOLD_LIGHT = "#D4A757";
const GOLD_DARK = "#FBBF24";
const TEXT_LIGHT = "#1a1a1a";
const TEXT_DARK = "#ffffff";
const BG_CARD_LIGHT = "#faf8f4";
const BG_CARD_DARK = "#1a1a1a";
const INPUT_BG_LIGHT = "#ffffff";
const INPUT_BG_DARK = "#111111";

/** Thème Clerk (connexion / inscription) — couleurs inchangées par rapport à l’existant. */
function clerkAuthAppearance(isDark: boolean): Appearance {
  if (isDark) {
    return {
      variables: {
        colorPrimary: GOLD_DARK,
        colorBackground: BG_CARD_DARK,
        colorInputBackground: INPUT_BG_DARK,
        colorText: TEXT_DARK,
        colorTextSecondary: "#888888",
        colorNeutral: "#888888",
        borderRadius: "12px",
      },
      elements: {
        rootBox: { width: "100%" },
        card: {
          backgroundColor: BG_CARD_DARK,
          borderRadius: "16px",
          boxShadow: "0 8px 32px rgba(0,0,0,0.45)",
          border: "1px solid #2a2a2a",
        },
        headerTitle: { color: TEXT_DARK },
        headerSubtitle: { color: "#a3a3a3" },
        socialButtonsIconButton: { color: TEXT_DARK },
        socialButtonsBlockButton: {
          borderColor: "#333333",
          backgroundColor: "#141414",
          color: TEXT_DARK,
        },
        socialButtonsBlockButtonText: { color: TEXT_DARK },
        socialButtonsBlockButtonArrow: { color: TEXT_DARK },
        dividerLine: { backgroundColor: "#333333" },
        dividerText: { color: "#888888" },
        formFieldLabel: { color: "#d4d4d4" },
        formFieldInput: {
          backgroundColor: INPUT_BG_DARK,
          color: TEXT_DARK,
          borderColor: "#333333",
        },
        formFieldInputShowPasswordButton: { color: "#a3a3a3" },
        formButtonPrimary: {
          backgroundColor: GOLD_DARK,
          color: "#000000",
          fontWeight: 600,
        },
        formButtonPrimaryIcon: { color: "#000000" },
        footerActionText: { color: "#a3a3a3" },
        footerActionLink: { color: GOLD_DARK },
        identityPreviewText: { color: TEXT_DARK },
        identityPreviewEditButton: { color: GOLD_DARK },
        formResendCodeLink: { color: GOLD_DARK },
        otpCodeFieldInput: {
          backgroundColor: INPUT_BG_DARK,
          borderColor: "#333333",
          color: TEXT_DARK,
        },
        alertText: { color: "#fecaca" },
        formFieldErrorText: { color: "#fecaca" },
      },
    };
  }

  return {
    variables: {
      colorPrimary: GOLD_LIGHT,
      colorBackground: BG_CARD_LIGHT,
      colorInputBackground: INPUT_BG_LIGHT,
      colorText: TEXT_LIGHT,
      colorTextSecondary: "#444444",
      colorNeutral: "#6b7280",
      borderRadius: "12px",
    },
    elements: {
      rootBox: { width: "100%" },
      card: {
        backgroundColor: BG_CARD_LIGHT,
        borderRadius: "16px",
        boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
        border: "1px solid rgba(0,0,0,0.06)",
      },
      headerTitle: { color: TEXT_LIGHT },
      headerSubtitle: { color: "#444444" },
      socialButtonsBlockButton: {
        borderColor: "rgba(0,0,0,0.12)",
        backgroundColor: "#ffffff",
        color: TEXT_LIGHT,
      },
      socialButtonsBlockButtonText: { color: TEXT_LIGHT },
      dividerLine: { backgroundColor: "rgba(0,0,0,0.08)" },
      dividerText: { color: "#6b7280" },
      formFieldLabel: { color: "#374151" },
      formFieldInput: {
        backgroundColor: INPUT_BG_LIGHT,
        color: TEXT_LIGHT,
        borderColor: "#e5e7eb",
      },
      formButtonPrimary: {
        backgroundColor: GOLD_LIGHT,
        color: TEXT_LIGHT,
        fontWeight: 600,
      },
      formButtonPrimaryIcon: { color: TEXT_LIGHT },
      footerActionText: { color: "#444444" },
      footerActionLink: { color: "#8B6914" },
      identityPreviewEditButton: { color: GOLD_LIGHT },
      formResendCodeLink: { color: "#8B6914" },
    },
  };
}

/** Mise en page inscription : réseaux sociaux en deux colonnes, logo Clerk masqué (nom app au-dessus). */
function clerkSignUpAppearance(isDark: boolean): Appearance {
  const base = clerkAuthAppearance(isDark);
  const blockBtn = base.elements?.socialButtonsBlockButton;
  return {
    ...base,
    elements: {
      ...base.elements,
      logoBox: { display: "none" },
      logoImage: { display: "none" },
      socialButtons: {
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: "10px",
        width: "100%",
      },
      socialButtonsBlockButton: {
        ...(typeof blockBtn === "object" && blockBtn !== null ? blockBtn : {}),
        width: "100%",
        minHeight: "44px",
      },
    },
  };
}

/** Masque le pied d’action Clerk : le lien « S’inscrire » ne déclenche pas routerPush en routing virtual. */
function clerkSignInAppearanceNoFooterLink(isDark: boolean): Appearance {
  const base = clerkAuthAppearance(isDark);
  return {
    ...base,
    elements: {
      ...base.elements,
      footerAction: { display: "none" },
    },
  };
}

const signUpModalLocalization: LocalizationResource = {
  ...frFR,
  signUp: {
    ...frFR.signUp,
    start: {
      ...frFR.signUp.start,
      title: "Créer un compte",
      subtitle: "Rejoignez PokéVault pour suivre votre collection et les prix du marché.",
      actionText: "Vous avez déjà un compte ?",
      actionLink: "Se connecter",
    },
  },
};

const OVERLAY_STYLE: CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 9999,
  overflowY: "auto",
  overflowX: "hidden",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  paddingTop: "env(safe-area-inset-top)",
  paddingBottom: "env(safe-area-inset-bottom)",
  paddingLeft: "env(safe-area-inset-left)",
  paddingRight: "env(safe-area-inset-right)",
  background: "rgba(0, 0, 0, 0.55)",
  WebkitOverflowScrolling: "touch",
};

const PANEL_WRAPPER_STYLE: CSSProperties = {
  position: "relative",
  width: "min(100%, 420px)",
  maxWidth: "100%",
  margin: "16px",
  alignSelf: "center",
  zIndex: 1,
};

function AuthModalBranding({ isDark }: { isDark: boolean }) {
  const color = isDark ? "#f5f5f5" : "#1a1a1a";
  return (
    <div style={{ textAlign: "center", marginBottom: 16, paddingTop: 4 }}>
      <div
        style={{
          fontFamily: "system-ui, ui-sans-serif, sans-serif",
          fontWeight: 800,
          fontSize: "1.35rem",
          letterSpacing: "0.025em",
          color,
        }}
      >
        PokéVault
      </div>
    </div>
  );
}

/**
 * Lien inscription sous le formulaire Clerk : bascule `mode` → `signup` sans navigation.
 * Texte affiché : « Vous n'avez pas encore de compte ? » + bouton « S'inscrire ».
 */
function AuthModalSignUpLinkFooter({ isDark, onGoSignUp }: { isDark: boolean; onGoSignUp: () => void }) {
  const textMuted = isDark ? "#a3a3a3" : "#444444";
  const linkColor = isDark ? GOLD_DARK : "#8B6914";
  const borderTop = isDark ? "1px solid #333333" : "1px solid rgba(0,0,0,0.08)";

  return (
    <div
      style={{
        marginTop: 16,
        paddingTop: 16,
        borderTop,
        textAlign: "center",
        fontSize: 14,
        lineHeight: 1.5,
        color: textMuted,
      }}
    >
      <span>Vous n&apos;avez pas encore de compte ? </span>
      <button
        type="button"
        onClick={onGoSignUp}
        style={{
          background: "none",
          border: "none",
          padding: 0,
          cursor: "pointer",
          font: "inherit",
          fontWeight: 600,
          color: linkColor,
          textDecoration: "underline",
          textUnderlineOffset: 2,
        }}
      >
        S&apos;inscrire
      </button>
    </div>
  );
}

type Props = {
  open: boolean;
  onClose: () => void;
};

export type AuthModalMode = "signin" | "signup";

/**
 * Modale auth : `<SignIn />` ou `<SignUp />` (routing virtual, OAuth en popup),
 * thème aligné sur l’app. Bascule via `mode` sans quitter l’app.
 */
export function ClerkSignInModal({ open, onClose }: Props) {
  const { isSignedIn } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [mode, setMode] = useState<AuthModalMode>("signin");

  const appearanceSignIn = useMemo(() => clerkSignInAppearanceNoFooterLink(isDark), [isDark]);
  const appearanceSignUp = useMemo(() => clerkSignUpAppearance(isDark), [isDark]);

  const goSignUp = useCallback(() => setMode("signup"), []);

  useEffect(() => {
    if (isSignedIn) onClose();
  }, [isSignedIn, onClose]);

  useEffect(() => {
    if (!open) return;
    setMode("signin");
  }, [open]);

  useEffect(() => {
    if (!open) return;
    authModalRouter.intercept = true;
    authModalRouter.onNavigateToSignIn = () => setMode("signin");
    authModalRouter.onNavigateToSignUp = () => setMode("signup");
    return () => {
      authModalRouter.intercept = false;
      authModalRouter.onNavigateToSignIn = null;
      authModalRouter.onNavigateToSignUp = null;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const handleOverlayPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget) onClose();
    },
    [onClose]
  );

  if (!open) return null;

  const a11yTitle = mode === "signin" ? "Connexion à PokéVault" : "Créer un compte sur PokéVault";

  const overlay = (
    <div role="presentation" style={OVERLAY_STYLE} onPointerDown={handleOverlayPointerDown}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="clerk-auth-modal-title"
        style={PANEL_WRAPPER_STYLE}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          aria-label="Fermer"
          onClick={onClose}
          style={{
            position: "absolute",
            top: 8,
            right: 8,
            zIndex: 10,
            width: 36,
            height: 36,
            border: "none",
            borderRadius: "10px",
            background: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
            color: isDark ? "#e5e5e5" : "#444444",
            fontSize: 22,
            lineHeight: 1,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          ×
        </button>
        <span
          id="clerk-auth-modal-title"
          style={{
            position: "absolute",
            width: 1,
            height: 1,
            padding: 0,
            margin: -1,
            overflow: "hidden",
            clip: "rect(0,0,0,0)",
            whiteSpace: "nowrap",
            border: 0,
          }}
        >
          {a11yTitle}
        </span>

        <AuthModalBranding isDark={isDark} />

        {mode === "signin" ? (
          <>
            <SignIn
              routing="virtual"
              oauthFlow="popup"
              appearance={appearanceSignIn}
              signUpUrl={SIGN_UP_PATH}
              fallbackRedirectUrl={AFTER_SIGN_IN}
              signUpFallbackRedirectUrl={AFTER_SIGN_UP}
            />
            <AuthModalSignUpLinkFooter isDark={isDark} onGoSignUp={goSignUp} />
          </>
        ) : (
          <SignUp
            routing="virtual"
            oauthFlow="popup"
            appearance={appearanceSignUp}
            localization={signUpModalLocalization}
            signInUrl={SIGN_IN_PATH}
            fallbackRedirectUrl={AFTER_SIGN_UP}
            signInFallbackRedirectUrl={AFTER_SIGN_IN}
          />
        )}
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
}
