import { SearchCatalogue } from "../components/SearchCatalogue";

export const AddProductPage = () => {
  return (
    <div className="space-y-4 -mx-3">
      <div className="space-y-3">
        <h2 className="title-section pl-3" style={{ color: "var(--text-primary)" }}>
          Catalogue universel
        </h2>
        <SearchCatalogue historyBackOnAddModalClose />
      </div>
    </div>
  );
};
