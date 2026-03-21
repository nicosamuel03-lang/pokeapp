import { useRef } from "react";

type CatalogueStyleSearchBarProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** id pour accessibilité / tests */
  id?: string;
};

/**
 * Barre de recherche visuellement alignée sur le Catalogue universel
 * (fond carte, icône loupe, champ transparent, bouton effacer).
 */
export function CatalogueStyleSearchBar({ value, onChange, placeholder, id }: CatalogueStyleSearchBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div
      className="flex items-center gap-2 rounded-2xl px-3 py-2.5 transition-all"
      style={{ background: "var(--card-color)", boxShadow: "0 1px 4px rgba(0,0,0,0.12)" }}
    >
      <svg
        className="h-4 w-4 shrink-0"
        style={{ color: "var(--text-secondary)" }}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
        aria-hidden
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"
        />
      </svg>
      <input
        ref={inputRef}
        id={id}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? "Rechercher un item (ex: ETB 151, Display EV, Coffret 151…)"}
        className="flex-1 bg-transparent text-sm focus:outline-none"
        style={{ color: "var(--text-primary)" }}
        autoComplete="off"
      />
      {value ? (
        <button
          type="button"
          onClick={() => {
            onChange("");
            inputRef.current?.focus();
          }}
          className="shrink-0 hover:opacity-80"
          style={{ color: "var(--text-secondary)" }}
          aria-label="Effacer la recherche"
        >
          ✕
        </button>
      ) : null}
    </div>
  );
}
