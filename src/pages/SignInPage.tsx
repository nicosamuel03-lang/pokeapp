import { SignIn } from "@clerk/react";

/** Dedicated sign-in page (e.g. from email link). Standard Clerk layout. */
export const SignInPage = () => (
  <div
    style={{
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      minHeight: "100vh",
    }}
  >
    <SignIn
      signUpUrl="/sign-up"
      fallbackRedirectUrl="/"
      signUpFallbackRedirectUrl="/"
      routing="hash"
    />
  </div>
);
