import { SignIn } from "@clerk/react";

/** Dedicated sign-in page (e.g. from email link). Standard Clerk layout. */
export const SignInPage = () => (
  <SignIn fallbackRedirectUrl="/" signUpUrl="/sign-up" />
);
