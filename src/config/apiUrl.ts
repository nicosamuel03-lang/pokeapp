/**
 * URL de base du backend Express (Railway en production, localhost en dev).
 *
 * - Développement : `VITE_API_URL` depuis `.env.development` ou défaut `http://localhost:4000` (port du serveur dans `server/index.js`).
 * - Production : `VITE_API_URL` au build (ex. variable Vercel) ou défaut Railway ci-dessous.
 */
const RAILWAY_PRODUCTION_API =
  "https://pokeapp-production-52e4.up.railway.app";
const DEV_DEFAULT_PORT = 4000;

function trimTrailingSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

/**
 * URL racine du backend, sans slash final.
 */
export function getApiBaseUrl(): string {
  const fromEnv = import.meta.env.VITE_API_URL?.trim();
  if (fromEnv) return trimTrailingSlash(fromEnv);
  if (import.meta.env.DEV) {
    return `http://localhost:${DEV_DEFAULT_PORT}`;
  }
  return RAILWAY_PRODUCTION_API;
}

/**
 * URL absolue vers un chemin API (ex. `apiUrl("/api/checkout")`).
 */
export function apiUrl(path: string): string {
  const base = getApiBaseUrl();
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}${p}`;
}
