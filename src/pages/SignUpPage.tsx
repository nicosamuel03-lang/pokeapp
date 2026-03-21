import { SignUp } from "@clerk/react";

/** Dedicated sign-up page. Standard Clerk layout. */
export const SignUpPage = () => (
  <div
    style={{
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      minHeight: "100vh",
    }}
  >
    <SignUp
      signInUrl="/sign-in"
      fallbackRedirectUrl="/"
      signInFallbackRedirectUrl="/"
      routing="hash"
    />
  </div>
);
