import { createContext, useContext, useEffect, useState } from "react";

export type Theme = "dark" | "light";

const STORAGE_KEY = "pokevault-theme";

function getStoredTheme(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark") return stored;
  } catch {
    /* ignore */
  }
  return "light";
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
}: {
  children: React.ReactNode;
  /** Mode sombre réservé aux comptes Boss Access (premium). */
  isPremium: boolean;
}) {
  const [preference, setPreference] = useState<Theme>(getStoredTheme);
  const theme: Theme = isPremium ? preference : "light";

  useEffect(() => {
    const isDark = theme === "dark";
    document.documentElement.classList.remove("light", "dark");
    document.documentElement.classList.add(theme);
    document.documentElement.style.backgroundColor = isDark ? "#0a0a0a" : "#ffffff";
    const metaThemeColor = document.querySelectorAll('meta[name="theme-color"]');
    metaThemeColor.forEach((meta) => meta.setAttribute("content", isDark ? "#0a0a0a" : "#ffffff"));
    if (document.body) document.body.style.backgroundColor = isDark ? "#0a0a0a" : "#ffffff";
    try {
      if (isPremium) {
        localStorage.setItem(STORAGE_KEY, preference);
      }
    } catch {
      /* ignore */
    }
  }, [theme, preference, isPremium]);

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
