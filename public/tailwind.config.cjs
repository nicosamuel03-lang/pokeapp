/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{ts,tsx,jsx,js}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        primary: "#2d2d2d",
        accent: "#FFD700",
        premium: {
          bg: "#121212",
          card: "#1e1e1e",
          border: "#2d2d2d",
          nav: "#121212",
          title: "#FFFFFF",
          muted: "#94a3b8",
          gold: "#FFD700",
          green: "#22c55e",
        },
      },
      fontFamily: {
        sans: ["system-ui", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      boxShadow: {
        "premium": "0 4px 24px rgba(0,0,0,0.25)",
      },
    },
  },
  plugins: [],
};

