import { HandleSSOCallback } from "@clerk/react";
import { useNavigate } from "react-router-dom";

/** Retour OAuth (Google) : finalise la session Clerk puis renvoie vers l’app. */
export function SsoCallbackPage() {
  const navigate = useNavigate();

  return (
    <HandleSSOCallback
      navigateToApp={({ decorateUrl }) => {
        const destination = decorateUrl("/");
        if (destination.startsWith("http")) {
          window.location.href = destination;
          return;
        }
        navigate(destination);
      }}
      navigateToSignIn={() => navigate("/sign-in")}
      navigateToSignUp={() => navigate("/sign-up")}
    />
  );
}
