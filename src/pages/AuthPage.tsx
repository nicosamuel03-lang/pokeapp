import { useEffect, useRef, useState } from "react";
import { SignIn, SignUp } from "@clerk/react";

export function AuthPage() {
  const [view, setView] = useState<"landing" | "signin" | "signup">("landing");
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const particles: {
      x: number;
      y: number;
      size: number;
      speedY: number;
      speedX: number;
      opacity: number;
      color: string;
    }[] = [];
    const colors = ["#FBBF24", "#D4A757", "#F59E0B", "#c91517"];

    for (let i = 0; i < 30; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        size: Math.random() * 3 + 1,
        speedY: -(Math.random() * 0.5 + 0.1),
        speedX: (Math.random() - 0.5) * 0.3,
        opacity: Math.random() * 0.3 + 0.1,
        color: colors[Math.floor(Math.random() * colors.length)],
      });
    }

    let animationId: number;

    function animate() {
      ctx!.clearRect(0, 0, canvas!.width, canvas!.height);
      particles.forEach((p) => {
        ctx!.beginPath();
        ctx!.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx!.fillStyle = p.color;
        ctx!.globalAlpha = p.opacity;
        ctx!.fill();
        p.y += p.speedY;
        p.x += p.speedX;
        if (p.y < -10) {
          p.y = canvas!.height + 10;
          p.x = Math.random() * canvas!.width;
        }
        if (p.x < 0) p.x = canvas!.width;
        if (p.x > canvas!.width) p.x = 0;
      });
      ctx!.globalAlpha = 1;
      animationId = requestAnimationFrame(animate);
    }

    animate();

    const handleResize = () => {
      canvas!.width = window.innerWidth;
      canvas!.height = window.innerHeight;
    };
    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

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
        <canvas
          ref={canvasRef}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            zIndex: 0,
            pointerEvents: "none",
          }}
        />
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
  );
}

