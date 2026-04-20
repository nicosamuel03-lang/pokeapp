import path from "path";

/** Même logique que le renommage sur disque : URL / base de fichier → nom ASCII. */
export function toAsciiImageFilename(filename) {
  const ext = path.extname(filename).toLowerCase();
  let base = path.basename(filename, path.extname(filename));
  base = base
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\u2018\u2019\u201a\u201b]/g, "")
    .replace(/'/g, "")
    .replace(/œ/gi, "oe")
    .replace(/æ/gi, "ae")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return base + ext;
}

/** Réécrit le segment fichier d’une URL locale /images/{displays|etb|upc}/… (espaces OK ; query conservée). */
export function patchLocalImageUrl(url) {
  const q = url.indexOf("?");
  const main = q >= 0 ? url.slice(0, q) : url;
  const query = q >= 0 ? url.slice(q) : "";
  const m = main.match(/^(\/images\/(?:displays|etb|upc)\/)(.+)$/);
  if (!m) return url;
  const ascii = toAsciiImageFilename(m[2]);
  return `${m[1]}${ascii}${query}`;
}

export function patchFileContent(text) {
  return text.replace(
    /\/images\/(displays|etb|upc)\/(.+?)\.(webp|png|jpg|jpeg)(\?[^"'\s]*)?/gi,
    (full, folder, base, ext, query) => {
      const file = `${base}.${ext}`;
      const ascii = toAsciiImageFilename(file);
      return `/images/${folder}/${ascii}${query || ""}`;
    }
  );
}
