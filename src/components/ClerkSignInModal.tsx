import { useEffect } from "react";
import { createPortal } from "react-dom";
import { SignIn, useAuth } from "@clerk/react";

const OVERLAY_STYLE: React.CSSProperties = {
  position: "fixed",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  width: "100vw",
  height: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "rgba(0,0,0,0.5)",
  zIndex: 9999,
};

type Props = {
  open: boolean;
  onClose: () => void;
};

/** Sign-in modal rendered in a portal as direct child of body to avoid max-width/offset from app layout. */
export function ClerkSignInModal({ open, onClose }: Props) {
  const { isSignedIn } = useAuth();

  useEffect(() => {
    if (isSignedIn) onClose();
  }, [isSignedIn, onClose]);

  if (!open) return null;

  const overlay = (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Connexion"
      style={OVERLAY_STYLE}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ position: "relative", display: "inline-block", alignSelf: "center" }}
      >
        <SignIn fallbackRedirectUrl="/" signUpUrl="/sign-up" />
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
}
