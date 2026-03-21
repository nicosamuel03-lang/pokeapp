import { SignIn } from "@clerk/react";

/** Page dédiée connexion (remplace l’ancienne modale). */
export const SignInPage = () => (
  <div
    style={{
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      minHeight: "100vh",
      backgroundColor: "#000",
    }}
  >
    <SignIn
      path="/sign-in"
      routing="path"
      signUpUrl="/sign-up"
      fallbackRedirectUrl="/"
      signUpFallbackRedirectUrl="/"
    />
  </div>
);
