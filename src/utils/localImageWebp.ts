/**
 * Pour les fichiers servis depuis `/images/...`, le script `npm run optimize:images`
 * peut générer un `.webp` à côté du PNG/JPEG. On tente ce WebP en premier pour
 * réduire le poids (et donc la bande passante Vercel).
 */
export function getLocalWebpCandidate(url: string): string | null {
  const trimmed = String(url).trim();
  if (!trimmed.startsWith("/images/")) return null;
  const q = trimmed.indexOf("?");
  const path = q >= 0 ? trimmed.slice(0, q) : trimmed;
  const query = q >= 0 ? trimmed.slice(q + 1) : null;
  if (!/\.(png|jpe?g)$/i.test(path)) return null;
  const webpPath = path.replace(/\.(png|jpe?g)$/i, ".webp");
  return query != null && query.length > 0 ? `${webpPath}?${query}` : webpPath;
}
