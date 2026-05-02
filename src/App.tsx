import { useCallback, useEffect, useRef, useState } from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
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
import { SsoCallbackPage } from "./pages/SsoCallbackPage";
import { AuthPage } from "./pages/AuthPage";
import { BottomNavLayout } from "./components/BottomNavLayout";
import { TabSwitch } from "./components/TabSwitch";
import { SubscriptionProvider, type AuthState } from "./state/SubscriptionContext";
import { ThemeProvider, useTheme } from "./state/ThemeContext";
import { supabase } from "./lib/supabase";
import { registerPushNotifications } from "./services/pushNotifications";
import { initRevenueCat } from "./services/revenueCat";
import { isNativeIOS } from "./services/revenueCat";

/** Sous ThemeProvider : fond app opaque en clair, transparent en sombre (verre sur la barre du bas). */
function AppThemedLayout({ children }: { children: React.ReactNode }) {
  const { theme } = useTheme();
  const isLight = theme === "light";
  return (
    <div
      className="min-h-screen"
      style={{
        background: isLight ? "var(--bg-app)" : "transparent",
        color: "var(--text-secondary)",
      }}
    >
      {children}
    </div>
  );
}

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
  const previousSignedInRef = useRef<boolean | undefined>(undefined);
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
    try {
      if (window.localStorage.getItem("pushNotificationsEnabled") === "true") {
        void registerPushNotifications();
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (isNativeIOS()) {
      void initRevenueCat(user?.id);
    }
  }, [user?.id]);

  useEffect(() => {
    if (!isLoaded) return;
    const prev = previousSignedInRef.current;
    previousSignedInRef.current = isSignedIn;
    if (pathname === "/" && isSignedIn === true && prev !== true) {
      window.scrollTo(0, 0);
    }
  }, [isLoaded, isSignedIn, pathname]);

  useEffect(() => {
    if (isLoaded) return;
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'video';
    link.href = '/video/video-accueil.mp4';
    document.head.appendChild(link);
    
    // Also create a hidden video element to force browser to download and buffer it
    const preloadVideo = document.createElement('video');
    preloadVideo.src = '/video/video-accueil.mp4';
    preloadVideo.muted = true;
    preloadVideo.preload = 'auto';
    preloadVideo.load();
    
    return () => {
      document.head.removeChild(link);
    };
  }, [isLoaded]);

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
    // Pas de `pathname` dans les deps : évite un fetch Supabase à chaque changement de route.
    // Après paiement : SuccessPage + retour d’onglet incrémentent `premiumFetchNonce` / `refreshSubscription`.
    fetchIsPremiumFromSupabase(userId)
      .then((premium) => {
        if (cancelled) return;
        setAuthState(premium ? "premium" : "free");

        // Auto-register push token
        const pushToken = localStorage.getItem('pushDeviceToken');
        if (pushToken && user?.id) {
          import('./config/apiUrl').then(({ apiUrl }) => {
            fetch(apiUrl('/api/device-tokens'), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ userId: user.id, token: pushToken, platform: 'ios' })
            })
            .then(res => console.log('Push token registered:', res.ok))
            .catch(err => console.error('Push token registration failed:', err));
          });
        }
      })
      .catch(() => {
        if (cancelled) return;
        setAuthState("free");
      });

    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, user?.id, premiumFetchNonce]);

  useEffect(() => {
    console.log("[AUTH] authState changed:", authState, new Date().toISOString());
  }, [authState]);

  const isPremium = authState === "premium";
  const isLoading = authState === "loading";

  if (!isLoaded) {
    return (
      <div style={{
        minHeight: '100vh',
        background: '#000000',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        paddingBottom: '15vh',
      }}>
        <img
          src="/images/GIOVANNI.png"
          alt="Giovanni TCG"
          style={{
            width: 100,
            height: 100,
            objectFit: 'contain',
          }}
        />
        <div style={{
          fontSize: 18,
          fontWeight: 800,
          letterSpacing: '0.14em',
          color: '#c91517',
        }}>
          GIOVANNI TCG
        </div>
      </div>
    );
  }

  if (isSignedIn === false) {
    return <AuthPage />;
  }

  return (
    <SubscriptionProvider value={{ authState, isPremium, isLoading, refreshSubscription }}>
      <ThemeProvider isPremium={isPremium} subscriptionLoading={isLoading}>
        <AppThemedLayout>
          <ScrollToTop />
          <Routes>
            <Route path="/sign-in" element={<SignInPage />} />
            <Route path="/sign-in/*" element={<SignInPage />} />
            <Route path="/sign-up" element={<SignUpPage />} />
            <Route path="/sign-up/*" element={<SignUpPage />} />
            <Route path="/sso-callback" element={<SsoCallbackPage />} />
            <Route path="/sso-callback/*" element={<SsoCallbackPage />} />
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
        </AppThemedLayout>
      </ThemeProvider>
    </SubscriptionProvider>
  );
};

export default App;

