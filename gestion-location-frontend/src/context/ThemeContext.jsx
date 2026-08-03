"use client";

import { createContext, useContext, useEffect, useState } from "react";

const ThemeContext = createContext(null);
const STORAGE_KEY = "fadaa-theme";

function readStoredTheme() {
  if (typeof window === "undefined") return "light";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === "dark" ? "dark" : "light";
}

// Ne s'applique qu'aux interfaces applicatives (backoffice) : la landing page
// et l'écran de connexion utilisent une identité de marque fixe et ignorent
// l'attribut data-theme (voir leurs .module.css — couleurs codées en dur, pas
// d'alias vers les tokens --brand-* redéfinis ici).
export function ThemeProvider({ children }) {
  // Lu directement dans l'état initial (plutôt que via un effet) : ThemeToggle
  // ne rend jamais rien côté serveur (il vit sous des layouts backoffice qui
  // n'affichent que "Chargement..." tant que l'auth n'est pas résolue), donc
  // pas de risque de désynchronisation avec le rendu serveur ici.
  const [theme, setThemeState] = useState(readStoredTheme);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    window.localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  function setTheme(next) {
    setThemeState(next);
  }

  function toggleTheme() {
    setThemeState((t) => (t === "dark" ? "light" : "dark"));
  }

  return <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within a ThemeProvider");
  return ctx;
}
