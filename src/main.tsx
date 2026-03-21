import "./themeHydration";
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css";
import { CollectionProvider } from "./state/CollectionContext";
import { ProductsProvider } from "./state/ProductsContext";
import { ClerkProviderWithRouter } from "./components/ClerkProviderWithRouter";
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

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <BrowserRouter>
      <ClerkProviderWithRouter>
        <ProductsProvider>
          <CollectionProvider>
            <App />
          </CollectionProvider>
        </ProductsProvider>
      </ClerkProviderWithRouter>
    </BrowserRouter>
  </React.StrictMode>
);

