import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { SearchCatalogue } from "../components/SearchCatalogue";
import { AjouterPage } from "./AjouterPage";

export const AddProductPage = () => {
  const [searchParams] = useSearchParams();
  const [inlineScanner, setInlineScanner] = useState(false);

  useEffect(() => {
    if (searchParams.get("item")) {
      setInlineScanner(false);
    }
  }, [searchParams]);

  if (inlineScanner) {
    return (
      <div className="space-y-4 -mx-3" style={{ minHeight: "100vh" }}>
        <AjouterPage onScannerClosedByUser={() => setInlineScanner(false)} />
      </div>
    );
  }

  return (
    <div className="space-y-4 -mx-3">
      <div className="space-y-3">
        <h2 className="title-section pl-3" style={{ color: "var(--text-primary)" }}>
          Catalogue universel
        </h2>
        <SearchCatalogue onClosedAddModalFromScannedItem={() => setInlineScanner(true)} />
      </div>
    </div>
  );
};
