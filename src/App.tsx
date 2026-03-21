import { useCallback, useEffect, useState } from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import { useAuth, useUser } from "@clerk/react";
import { ProductDetailPage } from "./pages/ProductDetailPage";
import { PremiumPage } from "./pages/PremiumPage";
import { SuccessPage } from "./pages/SuccessPage";
import { SubscriptionPage } from "./pages/SubscriptionPage";
import { SettingsPage } from "./pages/SettingsPage";
import { CGUPage } from "./pages/CGUPage";
import { PrivacyPage } from "./pages/PrivacyPage";
import { SignInPage } from "./pages/SignInPage";
import { SignUpPage } from "./pages/SignUpPage";
import { BottomNavLayout } from "./components/BottomNavLayout";
import { TabSwitch } from "./components/TabSwitch";
import { SubscriptionProvider, type AuthState } from "./state/SubscriptionContext";
import { ThemeProvider } from "./state/ThemeContext";
import { supabase } from "./lib/supabase";

/** Remet le scroll en haut de page à chaque changement de route (ex. ouverture détail produit). */
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

/**
 * Lit toujours `users.is_premium` depuis Supabase (pas de cache localStorage / pas de fallback API).
 * Log explicite pour debug après webhook Stripe.
 */
async function fetchIsPremiumFromSupabase(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("users")
    .select("is_premium")
    .eq("id", userId)
    .maybeSingle();

  const rawPremium = data != null ? (data as { is_premium?: boolean | null }).is_premium : null;
  console.log(
    "[subscription] Fresh Supabase fetch — user id:",
    userId,
    "| users.is_premium:",
    rawPremium,
    "| error:",
    error?.message ?? null
  );

  if (error || !data) {
    const code = (error as { code?: string } | null)?.code;
    if (code === "PGRST116" || (!data && !error)) {
      try {
        await supabase.from("users").insert({ id: userId, is_premium: false });
      } catch {
        /* ignore */
      }
    }
    return false;
  }

  return rawPremium === true;
}

const App = () => {
  const { pathname } = useLocation();
  const { isLoaded, isSignedIn } = useAuth();
  const { user } = useUser();
  // Incrémenté à chaque navigation ou retour sur l’onglet → nouveau fetch Supabase (évite l’état free obsolète après paiement).
  const [premiumFetchNonce, setPremiumFetchNonce] = useState(0);
  const refreshSubscription = useCallback(() => {
    setPremiumFetchNonce((n) => n + 1);
  }, []);

  // En cas de non-auth (Clerk user null/undefined), on se comporte comme free immédiatement.
  const [authState, setAuthState] = useState<AuthState>(() => (isSignedIn === true ? "loading" : "free"));

  // Retour sur l’onglet après Stripe (ou autre) : refetch même si l’URL n’a pas changé.
  useEffect(() => {
    let wasHidden = document.visibilityState === "hidden";
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        wasHidden = true;
        return;
      }
      if (document.visibilityState === "visible" && wasHidden) {
        wasHidden = false;
        setPremiumFetchNonce((n) => n + 1);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!isLoaded) return;

    if (!isSignedIn) {
      setAuthState("free");
      return;
    }

    const userId = user?.id;
    if (!userId) {
      setAuthState("free");
      return;
    }

    setAuthState("loading");
    fetchIsPremiumFromSupabase(userId)
      .then((premium) => {
        if (cancelled) return;
        setAuthState(premium ? "premium" : "free");
      })
      .catch(() => {
        if (cancelled) return;
        setAuthState("free");
      });

    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, user?.id, pathname, premiumFetchNonce]);

  useEffect(() => {
    console.log("[AUTH] authState changed:", authState, new Date().toISOString());
  }, [authState]);

  const isPremium = authState === "premium";
  const isLoading = authState === "loading";

  return (
    <SubscriptionProvider value={{ authState, isPremium, isLoading, refreshSubscription }}>
      <ThemeProvider isPremium={isPremium} subscriptionLoading={isLoading}>
        <div className="min-h-screen" style={{ background: "var(--bg-app)", color: "var(--text-secondary)" }}>
          <ScrollToTop />
          <Routes>
            <Route path="/sign-in" element={<SignInPage />} />
            <Route path="/sign-up" element={<SignUpPage />} />
            <Route element={<BottomNavLayout />}>
              <Route path="/produit/:id" element={<ProductDetailPage />} />
              <Route path="/premium" element={<PremiumPage />} />
              <Route path="/success" element={<SuccessPage />} />
              <Route path="/mon-abonnement" element={<SubscriptionPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/cgu" element={<CGUPage />} />
              <Route path="/privacy" element={<PrivacyPage />} />
              <Route path="*" element={<TabSwitch />} />
            </Route>
          </Routes>
        </div>
      </ThemeProvider>
    </SubscriptionProvider>
  );
};

export default App;

