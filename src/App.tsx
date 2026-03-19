import { useEffect, useState } from "react";
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

async function checkSubscription(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("users")
    .select("is_premium")
    .eq("id", userId)
    .maybeSingle();

  if (error || !data) {
    // PGRST116 = no rows found; on crée une ligne par défaut.
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

  const isPremiumDb = (data as { is_premium?: boolean | null }).is_premium === true;
  if (isPremiumDb) return true;

  // If Supabase says not premium, verify with backend (webhook sync can lag)
  try {
    const API_BASE = import.meta.env.VITE_API_URL || "https://pokeapp-production-52e4.up.railway.app";
    const response = await fetch(`${API_BASE}/api/check-subscription`, {
      headers: { userId },
    });
    if (!response.ok) return false;
    const json = (await response.json()) as { isPremium?: boolean };
    return json?.isPremium === true;
  } catch {
    return false;
  }
}

const App = () => {
  const { isLoaded, isSignedIn } = useAuth();
  const { user } = useUser();
  // En cas de non-auth (Clerk user null/undefined), on se comporte comme free immédiatement.
  // On évite de laisser un état "loading" afficher du contenu premium tant que l'utilisateur n'est pas confirmé.
  const [authState, setAuthState] = useState<AuthState>(() => (isSignedIn === true ? "loading" : "free"));

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

    // Only set loading if we don't already have a resolved state
    setAuthState((current) => (current === "loading" ? "loading" : current));
    checkSubscription(userId)
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
  }, [isLoaded, isSignedIn, user?.id]);

  useEffect(() => {
    console.log("[AUTH] authState changed:", authState, new Date().toISOString());
  }, [authState]);

  const isPremium = authState === "premium";
  const isLoading = authState === "loading";

  return (
    <SubscriptionProvider value={{ authState, isPremium, isLoading }}>
      <ThemeProvider isPremium={isPremium}>
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

