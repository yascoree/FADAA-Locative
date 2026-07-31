"use client";

import { useTheme } from "@/context/ThemeContext";
import styles from "./ThemeToggle.module.css";

/** Bascule clair/sombre — s'appuie sur les variables --primary/--border/...
    déjà aliasées par le .shell de l'espace backoffice qui l'entoure (voir
    ThemeContext.jsx et globals.css), donc s'intègre correctement dans les 4
    espaces (admin, propriétaire, agence, locataire) sans configuration. */
export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <div className={styles.toggle} role="radiogroup" aria-label="Thème de l'interface">
      <button
        type="button"
        role="radio"
        aria-checked={theme === "light"}
        className={`${styles.option} ${theme === "light" ? styles.optionActive : ""}`}
        onClick={() => setTheme("light")}
      >
        <i className="bi bi-sun-fill" />
        Clair
      </button>
      <button
        type="button"
        role="radio"
        aria-checked={theme === "dark"}
        className={`${styles.option} ${theme === "dark" ? styles.optionActive : ""}`}
        onClick={() => setTheme("dark")}
      >
        <i className="bi bi-moon-stars-fill" />
        Sombre
      </button>
    </div>
  );
}
