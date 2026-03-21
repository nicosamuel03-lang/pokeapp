import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { ClerkProvider } from "@clerk/react";
import { frFR } from "@clerk/localizations";

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

/** Optionnel : URL du script `clerk.js` (ex. frontend API iOS PWA / session par URL). Voir `.env.example`. */
const clerkJsUrl =
  (import.meta.env.VITE_CLERK_JS_URL as string | undefined)?.trim() || undefined;

/** URLs alignées sur le routeur SPA ; surcharge possibles via .env (voir .env.example). */
const signInUrl = import.meta.env.VITE_CLERK_SIGN_IN_URL || "/sign-in";
const signUpUrl = import.meta.env.VITE_CLERK_SIGN_UP_URL || "/sign-up";
/** Équivalent `afterSignInUrl` / `afterSignUpUrl` (Clerk v6 : `fallbackRedirectUrl`). */
const afterSignInUrl = import.meta.env.VITE_CLERK_AFTER_SIGN_IN_URL || "/";
const afterSignUpUrl = import.meta.env.VITE_CLERK_AFTER_SIGN_UP_URL || "/";

/** Apparence Clerk en mode clair (non premium / hors thème app). */
const clerkLightAppearance = {
  variables: {
    colorText: "#000000",
    colorPrimary: "#D4A757",
    colorBackground: "#FFFFFF",
  },
  elements: {
    headerTitle: { color: "#000000" },
    headerSubtitle: { color: "#000000", opacity: 0.8 },
    dividerText: { color: "#000000" },
    formFieldLabel: { color: "#000000" },
    footerActionText: { color: "#000000" },
    socialButtonsBlockButtonText: { color: "#000000" },
    formButtonPrimary: { backgroundColor: "#D4A757", color: "#000000" },
    footerActionLink: { color: "#D4A757" },
    card: { backgroundColor: "#FFFFFF", borderRadius: "24px" },
    modalBackdrop: {
      backgroundColor: "rgba(0,0,0,0.7)",
      backdropFilter: "blur(4px)",
    },
  },
};

type Props = { children: ReactNode };

/**
 * Clerk doit être **sous** `BrowserRouter` pour recevoir `routerPush` / `routerReplace`
 * (navigation SPA vers `/sign-up`, `/sign-in`, etc. — sinon le lien « S'inscrire » peut mal se comporter).
 *
 * `standardBrowser={false}` : mode sans cookies tiers (Safari iOS PWA, `needs_client_trust`) —
 * combiner avec **Sessions → URL-based session syncing** dans le dashboard Clerk si besoin.
 * `tokenCache="memory"` n’est pas exposé dans les types @clerk/react v6 ; la synchro par URL se fait côté dashboard.
 */
export function ClerkProviderWithRouter({ children }: Props) {
  const navigate = useNavigate();

  if (!PUBLISHABLE_KEY) {
    throw new Error("Add VITE_CLERK_PUBLISHABLE_KEY to your .env.local file");
  }

  return (
    <ClerkProvider
      publishableKey={PUBLISHABLE_KEY}
      standardBrowser={false}
      localization={frFR}
      afterSignOutUrl="/"
      signInUrl={signInUrl}
      signUpUrl={signUpUrl}
      fallbackRedirectUrl={afterSignInUrl}
      signUpFallbackRedirectUrl={afterSignUpUrl}
      appearance={clerkLightAppearance}
      routerPush={(to) => void navigate(to)}
      routerReplace={(to) => void navigate(to, { replace: true })}
      {...(clerkJsUrl ? { __internal_clerkJSUrl: clerkJsUrl } : {})}
    >
      {children}
    </ClerkProvider>
  );
}
