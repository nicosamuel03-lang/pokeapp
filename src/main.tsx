import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { ClerkProvider } from "@clerk/react";
import { frFR } from "@clerk/localizations";
import App from "./App";
import "./index.css";
import { CollectionProvider } from "./state/CollectionContext";
import { ProductsProvider } from "./state/ProductsContext";
import { preloadProductImages } from "./utils/preloadImages";

preloadProductImages();

if (typeof window !== "undefined") {
  try {
    window.localStorage.removeItem("pokevault_sales");
    window.localStorage.removeItem("pokevault_sales_history_v1");
  } catch {
    // ignore
  }
}

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
if (!PUBLISHABLE_KEY) {
  throw new Error("Add VITE_CLERK_PUBLISHABLE_KEY to your .env.local file");
}

/** Apparence Clerk en mode clair (non premium / hors thème app). Le thème sombre de l’app est réservé au premium dans ThemeProvider. */
const clerkLightAppearance = {
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

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ClerkProvider
      publishableKey={PUBLISHABLE_KEY}
      localization={frFR}
      afterSignOutUrl="/"
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      appearance={clerkLightAppearance}
    >
      <BrowserRouter>
        <ProductsProvider>
          <CollectionProvider>
            <App />
          </CollectionProvider>
        </ProductsProvider>
      </BrowserRouter>
    </ClerkProvider>
  </React.StrictMode>
);

