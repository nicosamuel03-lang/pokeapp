import { useRef, useCallback, useState, useEffect } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth, useClerk, useUser } from "@clerk/react";
import { Home, Plus, LineChart, History, Settings } from "lucide-react";
import { ClerkSignInModal } from "./ClerkSignInModal";
import { PremiumBanner } from "./PremiumBanner";
import { useTheme } from "../state/ThemeContext";
import { useSubscription } from "../state/SubscriptionContext";

const SWIPE_MIN_DISTANCE = 90;
const SWIPE_MIN_VELOCITY = 0.4; // px/ms — évite les glissements lents

const NAV_HEIGHT = 78;
const MAIN_PADDING_BOTTOM = NAV_HEIGHT + 16;
const ICON_SIZE = 12;
const ICON_PLUS_SIZE = 14;
const FONT_HEADING = "system-ui, ui-sans-serif, sans-serif";
const LETTER_SPACING = "0.025em";

/** Onglets visibles dans la barre du bas (la collection est accessible via la carte portefeuille sur l’accueil). */
const BOTTOM_NAV_PATHS = ["/", "/ajouter", "/marche", "/historique"] as const;

const navItems: { to: string; label: string; Icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>; iconSize: number }[] = [
  { to: "/", label: "Accueil", Icon: Home, iconSize: ICON_SIZE },
  { to: "/ajouter", label: "Ajouter", Icon: Plus, iconSize: ICON_PLUS_SIZE },
  { to: "/marche", label: "Marché", Icon: LineChart, iconSize: ICON_SIZE },
  { to: "/historique", label: "Historique", Icon: History, iconSize: ICON_SIZE },
];

export const BottomNavLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { isSignedIn, isLoaded: isAuthLoaded } = useAuth();
  const { signOut } = useClerk();
  const { user } = useUser();
  const { theme } = useTheme();
  const { isPremium, isLoading } = useSubscription();
  console.log("[RENDER] BottomNavLayout", "isPremium:", isPremium, "isLoading:", isLoading, new Date().toISOString());
  const [showSignInModal, setShowSignInModal] = useState(false);
  const [clickedTab, setClickedTab] = useState<string | null>(null);
  const touchStart = useRef<{ x: number; y: number; time: number } | null>(null);

  // Header dès que Clerk est prêt (Connexion / avatar / réglages). Ne pas attendre l’abonnement Supabase — sinon le header reste vide trop longtemps.
  const headerLoading = !isAuthLoaded;

  const isLight = theme === "light";
  const badgeBorder = isLight ? "#B8860B" : "rgba(212, 167, 87, 0.6)";
  const badgeTextColor = isLight ? "#8B6914" : "#FBBF24";
  const badgeBgTint = isLight ? "rgba(184, 134, 11, 0.12)" : "rgba(212, 167, 87, 0.18)";
  const badgeShadow = isLight ? "0 0 0 1px rgba(139, 105, 20, 0.25)" : "0 0 0 1px rgba(0,0,0,0.4)";
  const ballTopHalf = isLight ? "#ffffff" : "#1a1a1a";
  const ballGold = badgeTextColor;
  const ballGoldGlow = isLight ? "0 0 4px rgba(139, 105, 20, 0.5)" : "0 0 4px rgba(251, 191, 36, 0.5)";

  const isOnTabRoute =
    BOTTOM_NAV_PATHS.some((p) =>
      p === "/" ? location.pathname === "/" : location.pathname === p
    ) || location.pathname === "/collection";

  const goToTab = useCallback(
    (direction: "prev" | "next") => {
      const idx = BOTTOM_NAV_PATHS.findIndex((p) =>
        p === "/" ? location.pathname === "/" : location.pathname === p
      );
      if (idx < 0) return;
      const nextIdx = direction === "next" ? idx + 1 : idx - 1;
      if (nextIdx >= 0 && nextIdx < BOTTOM_NAV_PATHS.length) {
        navigate(BOTTOM_NAV_PATHS[nextIdx]);
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

  useEffect(() => {
    if (!clickedTab) return;
    const id = setTimeout(() => setClickedTab(null), 1000);
    return () => clearTimeout(id);
  }, [clickedTab]);

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
              minHeight: 44,
            }}
          >
            {headerLoading ? (
              <div style={{ width: "100%", height: 44 }} aria-hidden />
            ) : (
              <>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    flexShrink: 0,
                  }}
                >
                  {isPremium ? (
                    <button
                      type="button"
                      onClick={() => navigate("/mon-abonnement")}
                      style={{
                        border: `1px solid ${badgeBorder}`,
                        borderRadius: 9999,
                        padding: "6px 10px",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        background: `radial-gradient(circle at 0 0, ${badgeBgTint}, transparent 55%), var(--card-color)`,
                        boxShadow: badgeShadow,
                        cursor: "pointer",
                      }}
                    >
                      <span
                        style={{
                          display: "inline-block",
                          width: 16,
                          height: 16,
                          borderRadius: "50%",
                          overflow: "hidden",
                          flexShrink: 0,
                          border: `1.5px solid ${ballGold}`,
                          boxShadow: ballGoldGlow,
                          backgroundImage: `
                            radial-gradient(circle at 50% 50%, ${ballGold} 0%, ${ballGold} 1.5px, transparent 1.5px),
                            linear-gradient(180deg, transparent 49%, ${ballGold} 49%, ${ballGold} 51%, transparent 51%),
                            linear-gradient(180deg, ${ballTopHalf} 0%, ${ballTopHalf} 50%, transparent 50%),
                            linear-gradient(180deg, transparent 50%, ${ballGold} 50%, ${ballGold} 100%)
                          `,
                          backgroundSize: "100% 100%, 100% 100%, 100% 100%, 100% 100%",
                          backgroundPosition: "0 0, 0 0, 0 0, 0 0",
                          backgroundRepeat: "no-repeat",
                        }}
                        aria-hidden
                      />
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          letterSpacing: "0.12em",
                          textTransform: "uppercase",
                          color: badgeTextColor,
                          whiteSpace: "nowrap",
                        }}
                      >
                        Boss Access
                      </span>
                    </button>
                  ) : null}
                </div>
                <div style={{ flex: 1, minWidth: 0 }} aria-hidden />
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0, minHeight: 36 }}>
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
                      {(() => {
                        const clerkImageUrl = (user as { imageUrl?: string })?.imageUrl;
                        const avatarSrc = typeof clerkImageUrl === "string" && clerkImageUrl ? clerkImageUrl : "";
                        if (avatarSrc) {
                          return (
                            <img
                              src={avatarSrc}
                              alt=""
                              style={{ width: 36, height: 36, borderRadius: "50%", objectFit: "cover", cursor: "pointer" }}
                            />
                          );
                        }
                        return (
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
                            {(user as { firstName?: string; emailAddresses?: { emailAddress?: string }[] })?.firstName?.[0] ??
                              (user as { emailAddresses?: { emailAddress?: string }[] })?.emailAddresses?.[0]?.emailAddress?.[0] ??
                              "?"}
                          </span>
                        );
                      })()}
                    </button>
                  ) : (
                    <>
                  <button
                    type="button"
                    className="transition-opacity hover:opacity-90"
                    style={{
                      padding: "6px 12px",
                      borderRadius: "9999px",
                      /* Toujours style « mode clair » : le thème sombre n’est pas actif sans premium */
                      background: "#D4A757",
                      color: "#111827",
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
              <button
                type="button"
                onClick={() => navigate("/settings")}
                aria-label="Paramètres"
                title="Paramètres"
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
                  cursor: "pointer",
                  padding: 0,
                }}
              >
                <Settings size={18} strokeWidth={2} />
              </button>
            </div>
              </>
            )}
          </header>
          {/* Alignement horizontal avec les pages (-mx-3) ex. carte Portefeuille global */}
          {location.pathname !== "/premium" &&
            location.pathname !== "/success" && (
              <div className="-mx-3">
                <PremiumBanner />
              </div>
            )}
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
            position: "relative",
            display: "flex",
            justifyContent: "space-around",
            alignItems: "center",
            width: "100%",
            maxWidth: 480,
            padding: "0 8px",
            paddingTop: 0,
            marginTop: -8,
          }}
        >
          {navItems.map((item) => {
            const isActive =
              item.to === "/"
                ? location.pathname === "/"
                : location.pathname.startsWith(item.to);
            const color = isActive ? "var(--text-primary)" : "var(--text-secondary)";
            const isJustClicked = clickedTab === item.to;

            return (
              <button
                key={item.to}
                type="button"
                onClick={() => {
                  navigate(item.to);
                  setClickedTab(null);
                  requestAnimationFrame(() => setClickedTab(item.to));
                }}
                aria-current={isActive ? "page" : undefined}
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 3,
                  paddingTop: 1,
                  paddingBottom: 4,
                  paddingLeft: 10,
                  paddingRight: 10,
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
                <span
                  className={isJustClicked ? "nav-icon-pop" : undefined}
                  style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3 }}
                >
                  <item.Icon size={item.iconSize} color={color} strokeWidth={2} />
                  <span style={{ color }}>
                    {item.label}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};