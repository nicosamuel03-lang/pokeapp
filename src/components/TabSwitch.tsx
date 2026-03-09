import { useLocation, Navigate } from "react-router-dom";
import { HomePage } from "../pages/HomePage";
import { CollectionPage } from "../pages/CollectionPage";
import { AddProductPage } from "../pages/AddProductPage";
import { MarketPage } from "../pages/MarketPage";
import { HistoriquePage } from "../pages/HistoriquePage";

const TAB_PATHS = ["/", "/collection", "/ajouter", "/marche", "/historique"] as const;

/**
 * Affiche les 5 onglets principaux en les gardant montés (display:none quand inactif).
 * Évite le rechargement des images et le flash blanc lors du changement d'onglet.
 */
export const TabSwitch = () => {
  const { pathname } = useLocation();

  if (!TAB_PATHS.includes(pathname as (typeof TAB_PATHS)[number])) {
    return <Navigate to="/" replace />;
  }

  return (
    <>
      <div style={{ display: pathname === "/" ? "block" : "none", minHeight: "100vh", width: "100%" }}>
        <HomePage />
      </div>
      <div style={{ display: pathname === "/collection" ? "block" : "none", minHeight: "100vh", width: "100%" }}>
        <CollectionPage />
      </div>
      <div style={{ display: pathname === "/ajouter" ? "block" : "none", minHeight: "100vh", width: "100%" }}>
        <AddProductPage />
      </div>
      <div style={{ display: pathname === "/marche" ? "block" : "none", minHeight: "100vh", width: "100%" }}>
        <MarketPage />
      </div>
      <div style={{ display: pathname === "/historique" ? "block" : "none", minHeight: "100vh", width: "100%", touchAction: "pan-y" }}>
        <HistoriquePage />
      </div>
    </>
  );
};
