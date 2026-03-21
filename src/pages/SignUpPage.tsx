import { SignUp } from "@clerk/react";

/** Page dédiée inscription. */
export const SignUpPage = () => (
  <div
    style={{
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      minHeight: "100vh",
      backgroundColor: "#000",
    }}
  >
    <SignUp
      path="/sign-up"
      routing="path"
      signInUrl="/sign-in"
      fallbackRedirectUrl="/"
      signInFallbackRedirectUrl="/"
    />
  </div>
);
