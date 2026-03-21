import { memo, useRef, type RefObject } from "react";

type BaseProps = {
  placeholder?: string;
  /** id pour accessibilité / tests */
  id?: string;
  /** Clé stable pour l’input (évite un remontage inutile côté React / claviers mobiles). */
  inputKey?: string;
};

/** Mode contrôlé (valeur dans le state React). */
type ControlledProps = BaseProps & {
  uncontrolled?: false;
  value: string;
  onChange: (value: string) => void;
};

/** Mode non contrôlé : valeur uniquement dans le DOM — pour stabilité clavier iOS / PWA. */
type UncontrolledProps = BaseProps & {
  uncontrolled: true;
  inputRef: RefObject<HTMLInputElement | null>;
  onInputChange: (value: string) => void;
  /** Afficher le bouton effacer (dérivé du texte saisi, géré par le parent). */
  showClearButton: boolean;
  onClear: () => void;
};

export type CatalogueStyleSearchBarProps = ControlledProps | UncontrolledProps;

const inputClassName = "flex-1 bg-transparent text-sm focus:outline-none";

/**
 * Barre de recherche visuellement alignée sur le Catalogue universel
 * (fond carte, icône loupe, champ transparent, bouton effacer).
 * Toujours montée : la zone du bouton effacer garde une largeur fixe pour limiter les sauts de layout.
 */
export const CatalogueStyleSearchBar = memo(function CatalogueStyleSearchBar(props: CatalogueStyleSearchBarProps) {
  const internalRef = useRef<HTMLInputElement>(null);
  const inputKey = props.inputKey ?? "catalogue-style-search-input";

  if (props.uncontrolled === true) {
    const { inputRef, onInputChange, showClearButton, onClear, placeholder, id } = props;
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
          key={inputKey}
          ref={inputRef}
          id={id}
          type="text"
          inputMode="search"
          enterKeyHint="search"
          defaultValue=""
          onChange={(e) => onInputChange(e.target.value)}
          placeholder={placeholder ?? "Rechercher un item (ex: ETB 151, Display EV, Coffret 151…)"}
          className={inputClassName}
          style={{ color: "var(--text-primary)" }}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="none"
          spellCheck={false}
        />
        <div className="flex h-6 w-6 shrink-0 items-center justify-center" aria-hidden={!showClearButton}>
          <button
            type="button"
            tabIndex={showClearButton ? 0 : -1}
            onClick={onClear}
            className={`flex h-6 w-6 shrink-0 items-center justify-center hover:opacity-80 ${
              showClearButton ? "" : "pointer-events-none invisible"
            }`}
            style={{ color: "var(--text-secondary)" }}
            aria-label="Effacer la recherche"
            aria-hidden={!showClearButton}
          >
            ✕
          </button>
        </div>
      </div>
    );
  }

  const { value, onChange, placeholder, id } = props;
  const inputRef = internalRef;
  const hasValue = value.length > 0;

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
        key={inputKey}
        ref={inputRef}
        id={id}
        type="text"
        inputMode="search"
        enterKeyHint="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? "Rechercher un item (ex: ETB 151, Display EV, Coffret 151…)"}
        className={inputClassName}
        style={{ color: "var(--text-primary)" }}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="none"
        spellCheck={false}
      />
      <div className="flex h-6 w-6 shrink-0 items-center justify-center" aria-hidden={!hasValue}>
        <button
          type="button"
          tabIndex={hasValue ? 0 : -1}
          onClick={() => {
            onChange("");
            inputRef.current?.focus();
          }}
          className={`flex h-6 w-6 shrink-0 items-center justify-center hover:opacity-80 ${
            hasValue ? "" : "pointer-events-none invisible"
          }`}
          style={{ color: "var(--text-secondary)" }}
          aria-label="Effacer la recherche"
          aria-hidden={!hasValue}
        >
          ✕
        </button>
      </div>
    </div>
  );
});
