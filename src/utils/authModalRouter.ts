/**
 * Interception des `routerPush` / `routerReplace` Clerk quand la modale auth est ouverte :
 * les liens « S'inscrire » / « Se connecter » restent dans l'app au lieu de changer de route SPA.
 */
export const authModalRouter = {
  intercept: false,
  onNavigateToSignIn: null as null | (() => void),
  onNavigateToSignUp: null as null | (() => void),
};

function normalizePath(path: string): string {
  let p = path.split("?")[0] ?? path;
  try {
    if (/^https?:\/\//i.test(p)) {
      const u = new URL(p);
      p = u.pathname;
    }
  } catch {
    /* garder p tel quel */
  }
  if (!p || p === "") return "/";
  return p.replace(/\/$/, "") || "/";
}

export function authModalTargetForPath(
  to: string,
  signInUrl: string,
  signUpUrl: string
): "signIn" | "signUp" | null {
  const norm = normalizePath(to);
  const si = normalizePath(signInUrl);
  const su = normalizePath(signUpUrl);
  if (norm === si || norm.startsWith(`${si}/`)) return "signIn";
  if (norm === su || norm.startsWith(`${su}/`)) return "signUp";
  return null;
}
