import { useEffect } from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import { ProductDetailPage } from "./pages/ProductDetailPage";
import { PremiumPage } from "./pages/PremiumPage";
import { SignInPage } from "./pages/SignInPage";
import { SignUpPage } from "./pages/SignUpPage";
import { BottomNavLayout } from "./components/BottomNavLayout";
import { TabSwitch } from "./components/TabSwitch";

/** Remet le scroll en haut de page à chaque changement de route (ex. ouverture détail produit). */
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

const App = () => {
  return (
    <div className="min-h-screen" style={{ background: "var(--bg-app)", color: "var(--text-secondary)" }}>
      <ScrollToTop />
      <Routes>
        <Route path="/sign-in" element={<SignInPage />} />
        <Route path="/sign-up" element={<SignUpPage />} />
        <Route element={<BottomNavLayout />}>
          <Route path="/produit/:id" element={<ProductDetailPage />} />
          <Route path="/premium" element={<PremiumPage />} />
          <Route path="*" element={<TabSwitch />} />
        </Route>
      </Routes>
    </div>
  );
};

export default App;

