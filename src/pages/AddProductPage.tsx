import { SearchCatalogue } from "../components/SearchCatalogue";

export const AddProductPage = () => {
  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <h2 className="title-section" style={{ color: "var(--text-primary)" }}>
          Catalogue universel
        </h2>
        <p className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
          98 items FR référencés · Prix Cardmarket Fév 2026
        </p>
        <SearchCatalogue />
      </div>
    </div>
  );
};
