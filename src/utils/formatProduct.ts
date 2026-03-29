/** Supprime les répétitions consécutives identiques en fin de nom, ex. "(EB07) (EB07)" → "(EB07)". */
function dedupeTrailingDuplicateParentheses(s: string): string {
  let out = s.trim();
  const re = /\s*\(([^)]+)\)\s*\(\1\)\s*$/i;
  while (re.test(out)) {
    out = out.replace(re, " ($1)");
  }
  return out;
}

/** True si le nom se termine déjà par ce code entre parenthèses (insensible à la casse). */
function alreadyEndsWithSetCodeInParens(base: string, setCode: string): boolean {
  if (!setCode) return false;
  const esc = setCode.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\(${esc}\\)\\s*$`, "i").test(base.trim());
}

/** True si le nom se termine déjà par un code set catalogue (ME01, EB07, SL10.5, etc.) — pas le même que product.id. */
function alreadyEndsWithAnyCatalogSetCode(base: string): boolean {
  return /\((?:SL|EV|ME|EB)\d{1,2}(?:\.\d+)?\)\s*$/i.test(base.trim());
}

/** Retire le code set (EB06, EV02, ME01, etc.) et le suffixe FR du nom Display. */
export function formatDisplayProductName(name: string | undefined, isDisplay: boolean): string {
    let s = (name ?? "").replace(/ FR$/, "");
    if (isDisplay) {
      s = s.replace(/\b(?:EB|EV|ME)\d{2}(?:\.\d)?\s*/gi, "").replace(/\s{2,}/g, " ").trim();
    }
    return s;
  }
  
  /** Extrait le code set (EB01, EV02, etc.) depuis product.id ou product.etbId. */
  export function getSetCodeFromProduct(product: {
    id?: string;
    etbId?: string;
    category?: string;
  }): string | null {
    if (!product) return null;
    const raw = product.etbId ?? product.id ?? "";
    if (!raw) return null;
  const code = raw.replace(/^(?:display-|etb-|upc-)/i, "").trim();
  if (/^(?:EB|EV|ME)\d{2}(?:\.\d)?$/i.test(code)) return code.toUpperCase();
  if (/^UPC\d{2}$/i.test(code)) return code.toUpperCase();
  return null;
  }
  
  /**
   * Formate le nom produit avec le code set entre parenthèses.
   * Ex: "ETB Clash des Rebelles (EB02)", "Display Épée et Bouclier (EB01)"
   */
  export function formatProductNameWithSetCode(
    name: string | undefined,
    setCode: string | null,
    category: "ETB" | "Displays" | "UPC"
  ): string {
    let base = formatDisplayProductName(name, category === "Displays");
    if (category === "ETB") base = base.replace(/^ETB\s+/i, "");
    if (category === "UPC") base = base.replace(/^UPC\s+/i, "");
    if (category === "Displays") {
      base = base.replace(/^Display\s+/i, "").replace(/^ETB\s+/i, "").replace(/^UPC\s+/i, "");
    }
    base = dedupeTrailingDuplicateParentheses(base);
    const prefix = category === "ETB" ? "ETB " : category === "UPC" ? "UPC " : "Display ";
    // UPC : pas de suffixe (UPCxx)
    if (category === "UPC") return `${prefix}${base}`;
    // Code déjà présent en fin de nom (ex. Lucario (ME01) alors que id = ME02) : ne pas ajouter (ME02)
    if (category !== "UPC" && alreadyEndsWithAnyCatalogSetCode(base)) {
      return `${prefix}${base}`;
    }
    if (setCode && !alreadyEndsWithSetCodeInParens(base, setCode)) {
      return `${prefix}${base} (${setCode})`;
    }
    return `${prefix}${base}`;
  }
  
  /**
   * Formate la date de sortie pour affichage DD/MM/YYYY.
   * - Entrée "DD/MM/YYYY" (ETB) → retourne tel quel
   * - Entrée "YYYY-MM" (Display) → convertit en "01/MM/YYYY"
   */
  export function formatReleaseDate(dateSortie: string | undefined): string {
    if (!dateSortie || typeof dateSortie !== "string") return "—";
    const s = dateSortie.trim();
    if (/^\d{4}-\d{2}/.test(s)) {
      const [y, m] = s.split("-");
      return `01/${(m ?? "01").padStart(2, "0")}/${(y ?? "").slice(0, 4)}`;
    }
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s)) return s;
    return s;
  }
  