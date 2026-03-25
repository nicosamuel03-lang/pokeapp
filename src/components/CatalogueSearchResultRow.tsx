import { Link } from "react-router-dom";
import { formatDisplayProductName } from "../utils/formatProduct";
import { getEraNeonBadgeStyle } from "../utils/eraBadge";
import { STAT_CARD_VALUE_CLASS } from "../constants/statCardValueClass";
import { RasterImage } from "./RasterImage";

export type CatalogueSearchResultRowEraBadge = { label: string; bg: string; color: string };

type CatalogueSearchResultRowBase = {
  accentGold: string;
  imageUrl: string | null;
  /** Alt image ; si absent, dérivé du nom + isDisplayOrUpc */
  imageAlt?: string;
  nameForAlt?: string;
  isDisplayOrUpc?: boolean;
  placeholderBg?: string;
  eraBadge: CatalogueSearchResultRowEraBadge | null;
  /** Nom déjà formaté (ex. formatProductNameWithSetCode) */
  title: string;
  showNewBadge?: boolean;
  marketPrice: number;
  retailPrice: number;
  /** Bordure basse entre lignes (séparateur fin) */
  showBottomBorder: boolean;
};

type CatalogueSearchResultRowAsLink = CatalogueSearchResultRowBase & {
  mode: "link";
  to: string;
  onNavigate?: () => void;
};

type CatalogueSearchResultRowAsButton = CatalogueSearchResultRowBase & {
  mode: "button";
  onPress: () => void;
};

export type CatalogueSearchResultRowProps = CatalogueSearchResultRowAsLink | CatalogueSearchResultRowAsButton;

/**
 * Ligne de résultat alignée sur le Catalogue universel (image 48px, badge ère, titre, prix marché + retail).
 */
export function CatalogueSearchResultRow(props: CatalogueSearchResultRowProps) {
  const {
    accentGold,
    imageUrl,
    placeholderBg = "var(--placeholder-bg)",
    eraBadge,
    title,
    showNewBadge,
    marketPrice,
    retailPrice,
    showBottomBorder,
  } = props;

  const alt =
    props.imageAlt ??
    formatDisplayProductName(props.nameForAlt ?? title, props.isDisplayOrUpc ?? false);

  const rowClass = `flex w-full items-center gap-3 px-3 py-2.5 text-left transition ${
    showBottomBorder ? "border-b border-[var(--border-color)]" : ""
  }`;

  const inner = (
    <>
      <div
        className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl"
        style={{ height: "48px", minHeight: "48px", background: "var(--img-container-bg)", boxShadow: "0 1px 4px rgba(0,0,0,0.12)" }}
      >
        {imageUrl ? (
          <RasterImage
            src={imageUrl}
            alt={alt}
            loading="lazy"
            width={48}
            height={48}
            className="h-full w-full object-contain"
            style={{ objectFit: "contain" }}
            onError={(e) => {
              e.currentTarget.style.display = "none";
              const placeholder = e.currentTarget.nextElementSibling as HTMLElement | null;
              if (placeholder) {
                placeholder.style.display = "block";
                placeholder.style.background = placeholderBg;
              }
            }}
          />
        ) : null}
        <div
          className="h-full w-full"
          style={{
            display: imageUrl ? "none" : "block",
            background: placeholderBg,
          }}
          aria-hidden
        />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          {eraBadge ? (
            <span
              className="shrink-0 whitespace-nowrap font-medium"
              style={getEraNeonBadgeStyle(eraBadge.label)}
            >
              {eraBadge.label}
            </span>
          ) : null}
        </div>
        <div className="mt-0.5 flex items-center gap-1.5">
          <p className="app-heading truncate text-[13px]" style={{ color: "var(--text-primary)" }}>
            {title}
          </p>
          {showNewBadge ? (
            <span
              className="rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide"
              style={{ color: "var(--gain-green)", background: "rgba(34,197,94,0.15)" }}
            >
              NEW
            </span>
          ) : null}
        </div>
      </div>
      <div className="shrink-0 text-right">
        <p className={STAT_CARD_VALUE_CLASS} style={{ color: accentGold }}>
          {marketPrice.toLocaleString("fr-FR", {
            style: "currency",
            currency: "EUR",
            maximumFractionDigits: 0,
          })}
        </p>
        <p className="text-[10px]" style={{ color: "var(--text-secondary)" }}>
          Retail <span className={STAT_CARD_VALUE_CLASS}>{retailPrice}€</span>
        </p>
      </div>
    </>
  );

  if (props.mode === "link") {
    return (
      <Link
        to={props.to}
        onClick={props.onNavigate}
        className={`${rowClass} cursor-pointer no-underline`}
        style={{ color: "inherit" }}
      >
        {inner}
      </Link>
    );
  }

  return (
    <button type="button" onClick={props.onPress} className={rowClass}>
      {inner}
    </button>
  );
}
