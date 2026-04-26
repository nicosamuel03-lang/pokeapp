import { useEffect, useRef, useState } from "react";
import { useSignIn, useSignUp } from "@clerk/react";

export function AuthPage() {
  const [view, setView] = useState<"landing" | "signin" | "signup">("landing");
  const [videoReady, setVideoReady] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'form' | 'verify'>('form');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const { signIn, setActive: setSignInActive } = useSignIn() as any;
  const { signUp, setActive: setSignUpActive } = useSignUp() as any;

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    
    if (video.readyState >= 3) {
      video.play().catch(() => {});
      setVideoReady(true);
    } else {
      const handleCanPlay = () => {
        video.play().catch(() => {});
        setVideoReady(true);
      };
      video.addEventListener('canplaythrough', handleCanPlay);
      return () => video.removeEventListener('canplaythrough', handleCanPlay);
    }
  }, []);

  const handleSignUp = async () => {
    if (!signUp) return;
    setLoading(true);
    setError('');
    try {
      await (signUp as any).create({ emailAddress: email, password });
      await (signUp as any).prepareEmailAddressVerification({ strategy: 'email_code' });
      setStep('verify');
    } catch (err: any) {
      setError(err.errors?.[0]?.message || 'Erreur lors de l\'inscription');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifySignUp = async () => {
    if (!signUp) return;
    setLoading(true);
    setError('');
    try {
      const result = await (signUp as any).attemptEmailAddressVerification({ code });
      if (result.status === 'complete' && setSignUpActive) {
        await setSignUpActive({ session: result.createdSessionId });
      }
    } catch (err: any) {
      setError(err.errors?.[0]?.message || 'Code invalide');
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = async () => {
    if (!signIn) return;
    setLoading(true);
    setError('');
    try {
      const result = await (signIn as any).create({ identifier: email, password });
      if (result.status === 'complete' && setSignInActive) {
        await setSignInActive({ session: result.createdSessionId });
      }
    } catch (err: any) {
      setError(err.errors?.[0]?.message || 'Email ou mot de passe incorrect');
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    width: '100%',
    padding: '14px 16px',
    borderRadius: 12,
    border: '1px solid #333',
    background: 'rgba(255,255,255,0.08)',
    color: '#ffffff',
    fontSize: 14,
    outline: 'none',
    boxSizing: 'border-box' as const,
  };

  return (
      <div
        style={{
          position: "relative",
          zIndex: 1,
          minHeight: "100vh",
          background: videoReady ? 'transparent' : '#000000',
          color: "var(--text-secondary)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
          boxSizing: "border-box",
        }}
      >
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          preload="auto"
          onError={(e) => console.error('Video error:', e)}
          onLoadedData={() => console.log('Video loaded successfully')}
          onCanPlayThrough={() => setVideoReady(true)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            zIndex: 0,
          }}
          src="/video/video-accueil.mp4"
        />

        {view !== "landing" && (
          <button
            type="button"
            onClick={() => {
              if (view === "signup" && step === "verify") {
                setStep("form");
                setCode("");
                setError("");
                return;
              }
              setView("landing");
              setError("");
              setLoading(false);
              setStep("form");
              setCode("");
            }}
            style={{
              position: "absolute",
              top: "calc(env(safe-area-inset-top, 16px) + 12px)",
              left: 16,
              zIndex: 4,
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

        <div style={{ width: "100%", maxWidth: 360, position: "relative", zIndex: 3 }}>
        {view === "landing" && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
            <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: "0.14em", color: "#c91517" }}>
              GIOVANNI TCG
            </div>
            <div style={{ marginTop: 8, marginBottom: 18, fontSize: 13, color: "var(--text-secondary)" }}>
              Gérez votre collection d&apos;items scellés
            </div>
          </div>
        )}

        {view === "landing" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <button
              type="button"
              onClick={() => {
                setView("signup");
                setStep("form");
                setError("");
                setCode("");
              }}
              style={{
                width: "100%",
                padding: "14px 16px",
                borderRadius: 9999,
                border: "none",
                background: "#FFFFFF",
                color: "#000000",
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
              onClick={() => {
                setView("signin");
                setError("");
              }}
              style={{
                width: "100%",
                padding: "14px 16px",
                borderRadius: 9999,
                border: "1px solid #FFFFFF",
                background: "transparent",
                color: "#FFFFFF",
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
        ) : view === "signin" ? (
          <div style={{ width: "100%" }}>
            <div style={{ textAlign: "center", color: "#ffffff", fontSize: 22, fontWeight: 800, marginBottom: 16 }}>
              Se connecter
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                placeholder="Email"
                autoComplete="email"
                style={inputStyle}
              />
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                placeholder="Mot de passe"
                autoComplete="current-password"
                style={inputStyle}
              />
              {error && <div style={{ color: "#ef4444", fontSize: 13 }}>{error}</div>}
              <button
                type="button"
                onClick={handleSignIn}
                disabled={loading}
                style={{
                  width: "100%",
                  padding: "14px 16px",
                  borderRadius: 9999,
                  border: "none",
                  background: "#FFFFFF",
                  color: "#000000",
                  fontSize: 14,
                  fontWeight: 800,
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                  cursor: loading ? "not-allowed" : "pointer",
                  opacity: loading ? 0.8 : 1,
                }}
              >
                CONTINUER
              </button>
            </div>
          </div>
        ) : view === "signup" && step === "form" ? (
          <div style={{ width: "100%" }}>
            <div style={{ textAlign: "center", color: "#ffffff", fontSize: 22, fontWeight: 800, marginBottom: 16 }}>
              Créer un compte
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                placeholder="Email"
                autoComplete="email"
                style={inputStyle}
              />
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                placeholder="Minimum 8 caractères"
                autoComplete="new-password"
                style={inputStyle}
              />
              {error && <div style={{ color: "#ef4444", fontSize: 13 }}>{error}</div>}
              <button
                type="button"
                onClick={handleSignUp}
                disabled={loading}
                style={{
                  width: "100%",
                  padding: "14px 16px",
                  borderRadius: 9999,
                  border: "none",
                  background: "#FFFFFF",
                  color: "#000000",
                  fontSize: 14,
                  fontWeight: 800,
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                  cursor: loading ? "not-allowed" : "pointer",
                  opacity: loading ? 0.8 : 1,
                }}
              >
                CONTINUER
              </button>
            </div>
          </div>
        ) : (
          <div style={{ width: "100%" }}>
            <div style={{ textAlign: "center", color: "#ffffff", fontSize: 22, fontWeight: 800, marginBottom: 8 }}>
              Vérification
            </div>
            <div style={{ textAlign: "center", color: "#9ca3af", fontSize: 13, marginBottom: 16 }}>
              Entrez le code envoyé à {email}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                type="text"
                inputMode="numeric"
                placeholder="------"
                style={{
                  ...inputStyle,
                  textAlign: "center",
                  letterSpacing: 8,
                  fontSize: 24,
                }}
              />
              {error && <div style={{ color: "#ef4444", fontSize: 13 }}>{error}</div>}
              <button
                type="button"
                onClick={handleVerifySignUp}
                disabled={loading}
                style={{
                  width: "100%",
                  padding: "14px 16px",
                  borderRadius: 9999,
                  border: "none",
                  background: "#FFFFFF",
                  color: "#000000",
                  fontSize: 14,
                  fontWeight: 800,
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                  cursor: loading ? "not-allowed" : "pointer",
                  opacity: loading ? 0.8 : 1,
                }}
              >
                VÉRIFIER
              </button>
            </div>
          </div>
        )}
        </div>
      </div>
  );
}

