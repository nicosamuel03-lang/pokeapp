import { SignUp } from "@clerk/react";

/** Dedicated sign-up page. Standard Clerk layout. */
export const SignUpPage = () => (
  <SignUp fallbackRedirectUrl="/" signInUrl="/sign-in" />
);
