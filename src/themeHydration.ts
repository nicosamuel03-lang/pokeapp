/**
 * Aligné sur index.html : uniquement `pokevault-theme === 'dark'` → classe dark, sinon light.
 */
function hydrateThemeFromStorage() {
  if (typeof document === "undefined") return;
  try {
    const theme = localStorage.getItem("pokevault-theme");
    const isDark = theme === "dark";
    const el = document.documentElement;
    el.classList.remove("light", "dark");
    el.classList.add(isDark ? "dark" : "light");
    el.style.backgroundColor = isDark ? "#0a0a0a" : "#ffffff";
    if (document.body) document.body.style.backgroundColor = isDark ? "#0a0a0a" : "#ffffff";
    document.querySelectorAll('meta[name="theme-color"]').forEach((m) => {
      m.setAttribute("content", isDark ? "#0a0a0a" : "#ffffff");
    });
  } catch {
    /* ignore */
  }
}

hydrateThemeFromStorage();
