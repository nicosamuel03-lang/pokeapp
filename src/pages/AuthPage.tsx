import { useEffect, useRef, useState } from "react";
import { SignIn, SignUp } from "@clerk/react";
import { dark } from "@clerk/themes";

export function AuthPage() {
  const [view, setView] = useState<"landing" | "signin" | "signup">("landing");
  const [videoReady, setVideoReady] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

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

  const clerkAppearance = {
    baseTheme: dark,
    variables: {
      colorPrimary: '#c91517',
      colorBackground: '#0d0d0d',
      colorText: '#ffffff',
      colorTextSecondary: '#9ca3af',
      colorInputBackground: 'rgba(255,255,255,0.08)',
      colorInputText: '#ffffff',
      borderRadius: '12px',
      fontFamily: 'inherit',
    },
    elements: {
      card: {
        boxShadow: 'none',
        border: '1px solid rgba(255,255,255,0.08)',
        background: 'rgba(13,13,13,0.95)',
      },
      headerTitle: { color: '#ffffff', fontWeight: 800 },
      headerSubtitle: { color: '#9ca3af' },
      formButtonPrimary: {
        borderRadius: '9999px',
        fontWeight: 800,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        background: '#c91517',
      },
      footerActionLink: { color: '#c91517' },
      identityPreviewEditButton: { color: '#c91517' },
      formFieldInput: {
        background: 'rgba(255,255,255,0.08)',
        border: '1px solid #333',
        color: '#ffffff',
      },
      dividerLine: { background: '#333' },
      dividerText: { color: '#9ca3af' },
      socialButtonsIconButton: {
        border: '1px solid #333',
        background: 'rgba(255,255,255,0.05)',
      },
    },
  };

  return (
    <div style={{ position: 'relative', minHeight: '100vh', background: '#000000' }}>
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        preload="auto"
        style={{
          position: 'fixed',
          top: 0, left: 0,
          width: '100%', height: '100%',
          objectFit: 'cover',
          zIndex: 0,
          opacity: videoReady ? 1 : 0,
        }}
        src="/video/video-accueil.mp4"
      />

      <div style={{
        position: 'relative',
        zIndex: 1,
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        boxSizing: 'border-box',
      }}>

        {view === 'landing' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', maxWidth: 360 }}>
            <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: '0.14em', color: '#c91517', marginBottom: 8 }}>
              GIOVANNI TCG
            </div>
            <div style={{ fontSize: 13, color: '#9ca3af', marginBottom: 32 }}>
              Gérez votre collection d&apos;items scellés
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%' }}>
              <button
                type="button"
                onClick={() => setView('signup')}
                style={{
                  width: '100%', padding: '14px 16px',
                  borderRadius: 9999, border: 'none',
                  background: '#FFFFFF', color: '#000000',
                  fontSize: 14, fontWeight: 800,
                  letterSpacing: '0.04em', textTransform: 'uppercase',
                  cursor: 'pointer',
                }}
              >
                S&apos;inscrire
              </button>
              <button
                type="button"
                onClick={() => setView('signin')}
                style={{
                  width: '100%', padding: '14px 16px',
                  borderRadius: 9999, border: '1px solid #FFFFFF',
                  background: 'transparent', color: '#FFFFFF',
                  fontSize: 14, fontWeight: 800,
                  letterSpacing: '0.04em', textTransform: 'uppercase',
                  cursor: 'pointer',
                }}
              >
                Se connecter
              </button>
            </div>
          </div>
        )}

        {view === 'signin' && (
          <div style={{ width: '100%', maxWidth: 360 }}>
            <button
              type="button"
              onClick={() => setView('landing')}
              style={{
                marginBottom: 16, background: 'transparent',
                border: 'none', color: '#9ca3af',
                fontSize: 13, cursor: 'pointer', padding: 0,
              }}
            >
              ← Retour
            </button>
            <SignIn
              appearance={clerkAppearance}
              routing="hash"
              signUpUrl={undefined}
            />
          </div>
        )}

        {view === 'signup' && (
          <div style={{ width: '100%', maxWidth: 360 }}>
            <button
              type="button"
              onClick={() => setView('landing')}
              style={{
                marginBottom: 16, background: 'transparent',
                border: 'none', color: '#9ca3af',
                fontSize: 13, cursor: 'pointer', padding: 0,
              }}
            >
              ← Retour
            </button>
            <SignUp
              appearance={clerkAppearance}
              routing="hash"
              signInUrl={undefined}
            />
          </div>
        )}

      </div>
    </div>
  );
}
