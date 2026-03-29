/**
 * URL de base du backend Express (Railway en production si non fourni au build).
 *
 * Source unique côté client : `import.meta.env.VITE_API_URL` (fichiers `.env*` Vite).
 * En développement sans variable : chaîne vide — définir `VITE_API_URL` (ex. `.env.development`).
 */
const RAILWAY_PRODUCTION_API =
  "https://pokeapp-production-52e4.up.railway.app";

function trimTrailingSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

/**
 * URL racine du backend, sans slash final.
 */
export function getApiBaseUrl(): string {
  const fromEnv = import.meta.env.VITE_API_URL?.trim();
  if (fromEnv) return trimTrailingSlash(fromEnv);
  if (import.meta.env.PROD) {
    return RAILWAY_PRODUCTION_API;
  }
  return "";
}

/**
 * URL absolue vers un chemin API (ex. `apiUrl("/api/checkout")`).
 */
export function apiUrl(path: string): string {
  const base = getApiBaseUrl();
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}${p}`;
}
