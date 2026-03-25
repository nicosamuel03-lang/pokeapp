import { RasterImage } from "./RasterImage";

function getInitials(name: string): string {
  const cleaned = name.replace(/^ETB\s+/i, "").trim();
  const skip = new Set(["et", "des", "de", "du", "en", "la", "le", "les"]);
  const words = cleaned.split(/\s+/).filter((w) => w.length > 0 && !skip.has(w.toLowerCase()));
  if (words.length >= 2) {
    const a = words[0].charAt(0);
    const b = words[1].charAt(0);
    return `${a}${b}`.toUpperCase();
  }
  if (words.length === 1 && words[0].length >= 2) {
    return words[0].slice(0, 2).toUpperCase();
  }
  return cleaned.slice(0, 2).toUpperCase() || "?";
}

interface ItemIconProps {
  imageUrl?: string | null;
  emoji: string;
  name: string;
  size?: number;
  className?: string;
  /** "default": fond sombre + ombre (historique). "none": aucun fond/ombre. */
  frame?: "default" | "none";
  /** Liste / icônes : `lazy` (défaut). Détail produit héro : `eager` + `fetchPriority="high"`. */
  loading?: "lazy" | "eager";
  fetchPriority?: "high" | "low" | "auto";
}

/**
 * Composant d'icône produit : affiche l'image si disponible,
 * sinon placeholder gris avec initiales du nom (ex. ETB) ou emoji 🎴.
 */
export const ItemIcon = ({
  imageUrl,
  emoji,
  name,
  size = 52,
  className = "",
  frame = "default",
}: ItemIconProps) => {
  const hasValidImage = Boolean(imageUrl && String(imageUrl).trim().length > 0);
  const initials = getInitials(name);

  const containerStyle: React.CSSProperties = {
    background: frame === "none" ? "transparent" : "var(--card-color)",
    boxShadow: frame === "none" ? "none" : "0 1px 4px rgba(0,0,0,0.12)",
    width: size,
    height: size,
    minWidth: size,
    minHeight: size,
    aspectRatio: "1 / 1",
  };

  return (
    <div
      className={`flex items-center justify-center overflow-hidden rounded-xl ${className}`}
      style={containerStyle}
    >
      {hasValidImage ? (
        <RasterImage
          src={imageUrl as string}
          alt={name}
          loading={loading}
          {...(fetchPriority != null ? { fetchPriority } : {})}
          draggable={false}
          className="brightness-100 filter-none object-contain"
          onError={(e) => {
            const target = e.currentTarget;
            target.onerror = null;
            target.style.display = "none";
          }}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
            imageRendering: "crisp-edges",
          }}
        />
      ) : (
        <span
          aria-label={name}
          style={{
            fontSize: Math.max(10, size * 0.32),
            fontWeight: 600,
            lineHeight: 1,
            color: "var(--text-secondary)",
            letterSpacing: "-0.02em"
          }}
        >
          {initials}
        </span>
      )}
    </div>
  );
};
