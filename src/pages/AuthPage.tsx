import { useMemo, useState } from "react";
import { SignIn, SignUp } from "@clerk/react";

export function AuthPage() {
  const [view, setView] = useState<"landing" | "signin" | "signup">("landing");

  const particleSpecs = useMemo(
    () =>
      Array.from({ length: 20 }).map((_, i) => ({
        w: Math.random() * 4 + 2,
        h: Math.random() * 4 + 2,
        left: Math.random() * 100,
        bottom: -Math.random() * 20,
        duration: Math.random() * 10 + 15,
        delay: Math.random() * 15,
        color: ["#FBBF24", "#D4A757", "#F59E0B"][i % 3],
        opacity: Math.random() * 0.25 + 0.15,
      })),
    []
  );

  const appearance = {
    elements: {
      socialButtonsBlockButton: { display: "none" },
      socialButtonsBlockButtonText: { display: "none" },
      dividerRow: { display: "none" },
      dividerText: { display: "none" },
      rootBox: { width: "100%" },
      card: { boxShadow: "none", border: "none", background: "var(--card-color, #1a1a1a)" },
      headerTitle: { color: "var(--text-primary, #ffffff)" },
      headerSubtitle: { color: "var(--text-secondary, #888888)" },
      formFieldLabel: { color: "var(--text-primary, #ffffff)" },
      formFieldInput: {
        background: "var(--input-bg, #2a2a2a)",
        color: "var(--text-primary, #ffffff)",
        borderColor: "var(--border-color, #333333)",
      },
      formButtonPrimary: {
        background: "var(--accent-yellow, #FBBF24)",
        color: "#111827",
      },
      footerActionLink: { color: "var(--accent-yellow, #FBBF24)" },
      footerActionText: { color: "var(--text-secondary, #888888)" },
      footer: { background: "transparent" },
      footerPages: { background: "transparent" },
      footerPagesLink: { color: "var(--text-secondary, #888888)" },
      identityPreview: { background: "var(--card-color, #1a1a1a)" },
      identityPreviewText: { color: "var(--text-primary, #ffffff)" },
      identityPreviewEditButton: { color: "var(--accent-yellow, #FBBF24)" },
      formField: { color: "var(--text-primary, #ffffff)" },
      otpCodeFieldInput: {
        background: "var(--input-bg, #2a2a2a)",
        color: "var(--text-primary, #ffffff)",
        borderColor: "var(--border-color, #333333)",
      },
    },
  } as const;

  return (
    <>
      <style>{`
        @keyframes floatUp {
          0% { transform: translateY(0) translateX(0); opacity: 0; }
          10% { opacity: 0.3; }
          30% { transform: translateY(-33vh) translateX(12px); opacity: 0.3; }
          55% { transform: translateY(-60vh) translateX(-15px); opacity: 0.3; }
          80% { transform: translateY(-90vh) translateX(8px); opacity: 0.3; }
          90% { opacity: 0.3; }
          100% { transform: translateY(-110vh) translateX(20px); opacity: 0; }
        }
      `}</style>

      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 0,
          pointerEvents: "none",
          overflow: "hidden",
        }}
      >
        {particleSpecs.map((p, i) => (
          <span
            key={i}
            style={{
              position: "absolute",
              width: `${p.w}px`,
              height: `${p.h}px`,
              borderRadius: "50%",
              background: p.color,
              opacity: p.opacity,
              left: `${p.left}%`,
              bottom: `${p.bottom}%`,
              animation: `floatUp ${p.duration}s linear infinite`,
              animationDelay: `${p.delay}s`,
            }}
          />
        ))}
      </div>

      <div
        style={{
          position: "relative",
          zIndex: 1,
          minHeight: "100vh",
          background: "var(--bg-app)",
          color: "var(--text-secondary)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
          boxSizing: "border-box",
        }}
      >
        {view !== "landing" && (
          <button
            type="button"
            onClick={() => setView("landing")}
            style={{
              position: "absolute",
              top: "calc(env(safe-area-inset-top, 16px) + 12px)",
              left: 16,
              zIndex: 9999,
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 13,
              color: "var(--text-secondary)",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              padding: "8px 12px",
            }}
          >
            ← Retour
          </button>
        )}

        <div style={{ width: "100%", maxWidth: 360, position: "relative", zIndex: 1 }}>
        {view === "landing" && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
            <img
              src="/images/GIOVANNI.png"
              alt="Giovanni"
              width={120}
              height={120}
              style={{
                width: 120,
                height: 120,
                objectFit: "contain",
                marginBottom: 14,
                border: "none",
                outline: "none",
                boxShadow: "none",
                display: "block",
              }}
            />
            <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: "0.14em", color: "#c91517" }}>
              GIOVANNI TCG
            </div>
            <div style={{ marginTop: 8, marginBottom: 18, fontSize: 13, color: "var(--text-secondary)" }}>
              Gérez votre collection Pokémon scellée
            </div>
          </div>
        )}

        {view === "landing" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <button
              type="button"
              onClick={() => setView("signup")}
              style={{
                width: "100%",
                padding: "14px 16px",
                borderRadius: 9999,
                border: "none",
                background: "var(--accent-yellow, #FBBF24)",
                color: "#111827",
                fontSize: 14,
                fontWeight: 800,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
                cursor: "pointer",
              }}
            >
              S&apos;inscrire
            </button>
            <button
              type="button"
              onClick={() => setView("signin")}
              style={{
                width: "100%",
                padding: "14px 16px",
                borderRadius: 9999,
                border: "1px solid var(--accent-yellow, #FBBF24)",
                background: "transparent",
                color: "var(--accent-yellow, #FBBF24)",
                fontSize: 14,
                fontWeight: 800,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
                cursor: "pointer",
              }}
            >
              Se connecter
            </button>
          </div>
        ) : view === "signup" ? (
          <div style={{ width: "100%" }}>
            <SignUp
              routing="hash"
              signInUrl="#signin"
              appearance={appearance}
            />
          </div>
        ) : (
          <div style={{ width: "100%" }}>
            <SignIn
              routing="hash"
              signUpUrl="#signup"
              appearance={appearance}
            />
          </div>
        )}
        </div>
      </div>
    </>
  );
}

