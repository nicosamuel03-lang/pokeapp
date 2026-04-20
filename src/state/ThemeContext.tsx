import { createContext, useContext, useEffect, useMemo, useState } from "react";

export type Theme = "dark" | "light";

/** Clé principale (historique) + alias `theme` demandé pour init synchrone dans index.html. */
const STORAGE_KEY = "pokevault-theme";
const THEME_ALIAS_KEY = "theme";

export function getStoredTheme(): Theme {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === "dark") return "dark";
    if (raw === "light") return "light";
    const alias = localStorage.getItem(THEME_ALIAS_KEY);
    if (alias === "dark" || alias === "light") return alias;
  } catch {
    /* ignore */
  }
  return "light";
}

function persistThemePreference(value: Theme) {
  try {
    localStorage.setItem(STORAGE_KEY, value);
    localStorage.setItem(THEME_ALIAS_KEY, value);
  } catch {
    /* ignore */
  }
}

interface ThemeContextValue {
  /** Thème effectivement appliqué (clair si l’utilisateur n’est pas premium). */
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({
  children,
  isPremium,
  /** Tant que true, on n’impose pas le clair : on suit le dernier thème stocké (évite flash avant résolution Supabase). */
  subscriptionLoading = false,
}: {
  children: React.ReactNode;
  /** Mode sombre réservé aux comptes Boss Access (premium). */
  isPremium: boolean;
  subscriptionLoading?: boolean;
}) {
  const [preference, setPreference] = useState<Theme>(getStoredTheme);

  const theme: Theme = useMemo(() => {
    if (isPremium) return preference;
    if (subscriptionLoading) return getStoredTheme();
    return "light";
  }, [isPremium, subscriptionLoading, preference]);

  useEffect(() => {
    const isDark = theme === "dark";
    const el = document.documentElement;
    el.classList.remove("light", "dark");
    el.classList.add(theme);
    /* Mode sombre : pas de fond opaque sur html/body en JS — le noir plein vient uniquement de #root (index.css), pour que le backdrop-filter de la nav voie les cartes qui défilent. Mode clair : fond blanc inchangé. */
    if (isDark) {
      el.style.backgroundColor = "transparent";
      if (document.body) document.body.style.backgroundColor = "transparent";
    } else {
      el.style.backgroundColor = "#ffffff";
      if (document.body) document.body.style.backgroundColor = "#ffffff";
    }
    const metaThemeColor = document.querySelectorAll('meta[name="theme-color"]');
    metaThemeColor.forEach((meta) => meta.setAttribute("content", isDark ? "#0a0a0a" : "#ffffff"));

    if (subscriptionLoading) return;

    if (isPremium) {
      persistThemePreference(preference);
    } else {
      persistThemePreference("light");
    }
  }, [theme, preference, isPremium, subscriptionLoading]);

  const toggleTheme = () => {
    if (!isPremium) return;
    setPreference((prev) => (prev === "dark" ? "light" : "dark"));
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
