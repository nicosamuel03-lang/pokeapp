import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { ClerkProvider } from "@clerk/react";
import { dark } from "@clerk/themes";
import { frFR } from "@clerk/localizations";
import App from "./App";
import "./index.css";
import { ThemeProvider, useTheme } from "./state/ThemeContext";
import { PremiumProvider } from "./state/PremiumContext";
import { CollectionProvider } from "./state/CollectionContext";
import { ProductsProvider } from "./state/ProductsContext";
import { preloadProductImages } from "./utils/preloadImages";

preloadProductImages();

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
if (!PUBLISHABLE_KEY) {
  throw new Error("Add VITE_CLERK_PUBLISHABLE_KEY to your .env.local file");
}

function ClerkWithTheme({ children }: { children: React.ReactNode }) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const appearance = isDark
    ? {
        baseTheme: dark,
        variables: {
          colorText: "#FFFFFF",
          colorPrimary: "#D4A757",
          colorBackground: "#1A1A1A",
        },
        elements: {
          headerTitle: { color: "#FFFFFF" },
          headerSubtitle: { color: "#FFFFFF", opacity: 0.8 },
          dividerText: { color: "#FFFFFF" },
          formFieldLabel: { color: "#FFFFFF" },
          footerActionText: { color: "#FFFFFF" },
          socialButtonsBlockButtonText: { color: "#FFFFFF" },
          formButtonPrimary: { backgroundColor: "#D4A757", color: "#000000" },
          footerActionLink: { color: "#D4A757" },
          card: { backgroundColor: "#1A1A1A", borderRadius: "24px" },
          modalBackdrop: {
            backgroundColor: "rgba(0,0,0,0.7)",
            backdropFilter: "blur(4px)",
          },
        },
      }
    : {
        variables: {
          colorText: "#000000",
          colorPrimary: "#D4A757",
          colorBackground: "#FFFFFF",
        },
        elements: {
          headerTitle: { color: "#000000" },
          headerSubtitle: { color: "#000000", opacity: 0.8 },
          dividerText: { color: "#000000" },
          formFieldLabel: { color: "#000000" },
          footerActionText: { color: "#000000" },
          socialButtonsBlockButtonText: { color: "#000000" },
          formButtonPrimary: { backgroundColor: "#D4A757", color: "#000000" },
          footerActionLink: { color: "#D4A757" },
          card: { backgroundColor: "#FFFFFF", borderRadius: "24px" },
          modalBackdrop: {
            backgroundColor: "rgba(0,0,0,0.7)",
            backdropFilter: "blur(4px)",
          },
        },
      };
  return (
    <ClerkProvider
      publishableKey={PUBLISHABLE_KEY}
      localization={frFR}
      afterSignOutUrl="/"
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      appearance={appearance}
    >
      {children}
    </ClerkProvider>
  );
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ThemeProvider>
      <ClerkWithTheme>
        <BrowserRouter>
          <PremiumProvider>
            <ProductsProvider>
              <CollectionProvider>
                <App />
              </CollectionProvider>
            </ProductsProvider>
          </PremiumProvider>
        </BrowserRouter>
      </ClerkWithTheme>
    </ThemeProvider>
  </React.StrictMode>
);

