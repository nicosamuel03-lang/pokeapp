import { useState } from "react";
import { SignIn, SignUp } from "@clerk/react";

export function AuthPage() {
  const [view, setView] = useState<"landing" | "signin" | "signup">("landing");

  const appearance = {
    elements: {
      socialButtonsBlockButton: { display: "none" },
      socialButtonsBlockButtonText: { display: "none" },
      dividerRow: { display: "none" },
      dividerText: { display: "none" },
      rootBox: { width: "100%" },
      card: { boxShadow: "none", border: "none", background: "transparent" },
    },
  } as const;

  return (
    <div
      style={{
        position: "relative",
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

      <div style={{ width: "100%", maxWidth: 360 }}>
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
  );
}

