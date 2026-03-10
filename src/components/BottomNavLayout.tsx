import { useRef, useCallback, useState, useEffect } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth, useClerk, useUser } from "@clerk/react";
import { Home, Layers, Plus, LineChart, History, Sun, Moon } from "lucide-react";
import { useTheme } from "../state/ThemeContext";
import { ClerkSignInModal } from "./ClerkSignInModal";
import { PremiumBanner } from "./PremiumBanner";
import { usePremium } from "../hooks/usePremium";

const SWIPE_MIN_DISTANCE = 90;
const SWIPE_MIN_VELOCITY = 0.4; // px/ms — évite les glissements lents

const NAV_HEIGHT = 78;
const MAIN_PADDING_BOTTOM = NAV_HEIGHT + 16;
const ICON_SIZE = 12;
const ICON_PLUS_SIZE = 14;
const FONT_HEADING = "system-ui, ui-sans-serif, sans-serif";
const LETTER_SPACING = "0.025em";

const navItems: { to: string; label: string; Icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>; iconSize: number }[] = [
  { to: "/", label: "Accueil", Icon: Home, iconSize: ICON_SIZE },
  { to: "/collection", label: "Collection", Icon: Layers, iconSize: ICON_SIZE },
  { to: "/ajouter", label: "Ajouter", Icon: Plus, iconSize: ICON_PLUS_SIZE },
  { to: "/marche", label: "Marché", Icon: LineChart, iconSize: ICON_SIZE },
  { to: "/historique", label: "Historique", Icon: History, iconSize: ICON_SIZE },
];

const TAB_PATHS = ["/", "/collection", "/ajouter", "/marche", "/historique"] as const;

export const BottomNavLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const { isSignedIn } = useAuth();
  const { signOut } = useClerk();
  const { user } = useUser();
  const { isPremium } = usePremium();
  const [showSignInModal, setShowSignInModal] = useState(false);
  const touchStart = useRef<{ x: number; y: number; time: number } | null>(null);

  // Free users : forcer le mode clair, Premium : libre de changer.
  useEffect(() => {
    if (!isPremium && theme === "dark") {
      toggleTheme();
    }
  }, [isPremium, theme, toggleTheme]);

  const isOnTabRoute = TAB_PATHS.some(
    (p) => p === "/" ? location.pathname === "/" : location.pathname === p
  );

  const goToTab = useCallback(
    (direction: "prev" | "next") => {
      const idx = TAB_PATHS.findIndex(
        (p) => p === "/" ? location.pathname === "/" : location.pathname === p
      );
      if (idx < 0) return;
      const nextIdx = direction === "next" ? idx + 1 : idx - 1;
      if (nextIdx >= 0 && nextIdx < TAB_PATHS.length) {
        navigate(TAB_PATHS[nextIdx]);
      }
    },
    [location.pathname, navigate]
  );

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (!isOnTabRoute) return;
    const t = e.touches[0];
    if (t) {
      touchStart.current = { x: t.clientX, y: t.clientY, time: Date.now() };
    }
  }, [isOnTabRoute]);

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (!isOnTabRoute || touchStart.current === null) return;
      const end = e.changedTouches[0];
      if (!end) {
        touchStart.current = null;
        return;
      }
      const { x: startX, y: startY, time: startTime } = touchStart.current;
      const deltaX = end.clientX - startX;
      const deltaY = end.clientY - startY;
      const deltaTime = Date.now() - startTime;
      touchStart.current = null;

      // Direction lock : mouvement initial plus vertical que horizontal → annuler
      if (Math.abs(deltaY) > Math.abs(deltaX)) return;

      // Horizontal doit être au moins 2× le vertical
      if (Math.abs(deltaX) < Math.abs(deltaY) * 2) return;

      // Distance horizontale minimale
      if (Math.abs(deltaX) < SWIPE_MIN_DISTANCE) return;

      // Vitesse minimale : évite les glissements lents
      const velocity = Math.abs(deltaX) / Math.max(deltaTime, 1);
      if (velocity < SWIPE_MIN_VELOCITY) return;

      if (deltaX < 0) goToTab("next");
      else goToTab("prev");
    },
    [isOnTabRoute, goToTab]
  );

  return (
    <div style={{ position: "relative", minHeight: "100vh", background: "var(--bg-app)", color: "var(--text-secondary)" }}>
      <main
        style={{
          minHeight: "100vh",
          width: "100%",
          paddingBottom: `${MAIN_PADDING_BOTTOM}px`,
          touchAction: "pan-y",
          overflowY: "auto",
          WebkitOverflowScrolling: "touch",
        }}
        onTouchStartCapture={handleTouchStart}
        onTouchEndCapture={handleTouchEnd}
      >
        <div style={{ maxWidth: "480px", margin: "0 auto", padding: "16px 16px 8px 16px" }}>
          <header
            style={{
              position: "sticky",
              top: 0,
              zIndex: 10,
              marginBottom: "16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
              background: "var(--bg-app)",
              paddingBottom: 4,
            }}
          >
            <h1 className="app-heading" style={{ fontSize: "18px", color: "var(--text-primary)", flexShrink: 0 }}>
              PokéVault
            </h1>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
              {isSignedIn ? (
                <button
                  type="button"
                  onClick={() => signOut()}
                  aria-label="Déconnexion"
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: "50%",
                    padding: 0,
                    border: "none",
                    cursor: "pointer",
                    background: "transparent",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    overflow: "hidden",
                  }}
                >
                  {user?.imageUrl ? (
                    <img
                      src={user.imageUrl}
                      alt=""
                      style={{ width: 36, height: 36, borderRadius: "50%", objectFit: "cover", cursor: "pointer" }}
                    />
                  ) : (
                    <span
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: "50%",
                        background: "var(--bg-card)",
                        color: "var(--text-secondary)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 14,
                        fontWeight: 600,
                      }}
                    >
                      {user?.firstName?.[0] ?? user?.emailAddresses?.[0]?.emailAddress?.[0] ?? "?"}
                    </span>
                  )}
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    className="transition-opacity hover:opacity-90"
                    style={{
                      padding: "6px 12px",
                      borderRadius: "9999px",
                      background: "#D4A757",
                      color: "#000",
                      border: "none",
                      cursor: "pointer",
                      fontSize: 12,
                      fontWeight: 600,
                    }}
                    onClick={() => setShowSignInModal(true)}
                  >
                    Connexion
                  </button>
                  <ClerkSignInModal open={showSignInModal} onClose={() => setShowSignInModal(false)} />
                </>
              )}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
                title={
                  isPremium
                    ? theme === "dark"
                      ? "Passer en mode clair"
                      : "Passer en mode sombre"
                    : "Fonctionnalité réservée aux membres Boss Access"
                }
              >
                <button
                  type="button"
                  onClick={isPremium ? toggleTheme : undefined}
                  aria-label={
                    theme === "dark" ? "Passer en mode clair" : "Passer en mode sombre"
                  }
                  disabled={!isPremium}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 36,
                    height: 36,
                    borderRadius: "50%",
                    background: "var(--bg-card)",
                    color: "var(--text-secondary)",
                    border: "none",
                    cursor: isPremium ? "pointer" : "not-allowed",
                    padding: 0,
                    opacity: isPremium ? 1 : 0.5,
                  }}
                >
                  {theme === "dark" ? <Sun size={18} strokeWidth={2} /> : <Moon size={18} strokeWidth={2} />}
                </button>
                {!isPremium && (
                  <span style={{ display: "inline-flex", alignItems: "center", color: "var(--text-secondary)" }} aria-hidden>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                  </span>
                )}
              </div>
              <span style={{ borderRadius: "9999px", background: "var(--bg-card)", padding: "2px 12px", fontSize: "11px", color: "var(--text-secondary)" }}>
                Beta
              </span>
            </div>
          </header>
          {location.pathname !== "/premium" &&
            location.pathname !== "/success" && <PremiumBanner />}
          <Outlet />
        </div>
      </main>

      {/* Bottom bar: stealth, fixed, no transparency/shadow, same font as PORTEFEUILLE GLOBAL */}
      <div
        id="app-bottom-nav"
        role="navigation"
        aria-label="Navigation principale"
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 9999,
          height: `${NAV_HEIGHT}px`,
          minHeight: `${NAV_HEIGHT}px`,
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          width: "100%",
          maxWidth: "100%",
          margin: 0,
          background: "var(--bg-nav)",
          backgroundColor: "var(--bg-nav)",
          borderTop: "none",
          borderLeft: "none",
          borderRight: "none",
          borderBottom: "none",
          boxShadow: "none",
          outline: "none",
          opacity: 1,
          fontFamily: FONT_HEADING,
          fontWeight: 700,
          letterSpacing: LETTER_SPACING,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-around",
            alignItems: "center",
            width: "100%",
            maxWidth: 480,
            padding: "0 8px",
          }}
        >
          {navItems.map((item) => {
            const isActive =
              item.to === "/"
                ? location.pathname === "/"
                : location.pathname.startsWith(item.to);
            const color = isActive ? "var(--text-primary)" : "var(--text-secondary)";

            return (
              <button
                key={item.to}
                type="button"
                onClick={() => navigate(item.to)}
                aria-current={isActive ? "page" : undefined}
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 3,
                  padding: "8px 10px",
                  minHeight: 40,
                  minWidth: 56,
                  color,
                  background: "transparent",
                  border: "none",
                  outline: "none",
                  cursor: "pointer",
                  fontFamily: FONT_HEADING,
                  fontWeight: 700,
                  fontSize: 9,
                  letterSpacing: LETTER_SPACING,
                  textTransform: "uppercase",
                  transition: "color 120ms ease",
                }}
              >
                <item.Icon size={item.iconSize} color={color} strokeWidth={2} />
                <span style={{ color }}>
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};