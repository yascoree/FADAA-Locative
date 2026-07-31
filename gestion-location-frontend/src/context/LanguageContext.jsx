"use client";

import { createContext, useContext, useEffect, useState } from "react";
import fr from "@/locales/fr";
import en from "@/locales/en";
import ar from "@/locales/ar";

const DICTIONARIES = { fr, en, ar };
const RTL_LOCALES = new Set(["ar"]);
export const LANGUAGE_OPTIONS = [
  { value: "fr", label: "Français", short: "FR" },
  { value: "en", label: "English", short: "EN" },
  { value: "ar", label: "العربية", short: "AR" },
];

const LanguageContext = createContext(null);
const STORAGE_KEY = "fadaa-locale";

function readStoredLocale() {
  if (typeof window === "undefined") return "fr";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return DICTIONARIES[stored] ? stored : "fr";
}

function getByPath(obj, path) {
  return path.split(".").reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : undefined), obj);
}

// Ne s'applique qu'à la landing page publique et à l'écran de connexion pour
// l'instant (voir NavBar/Footer/ChatBot/login) — le backoffice reste en
// français, mais le contexte est disponible partout pour être étendu plus tard.
export function LanguageProvider({ children }) {
  const [locale, setLocaleState] = useState(readStoredLocale);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = RTL_LOCALES.has(locale) ? "rtl" : "ltr";
    window.localStorage.setItem(STORAGE_KEY, locale);
  }, [locale]);

  function setLocale(next) {
    if (DICTIONARIES[next]) setLocaleState(next);
  }

  // t("hero.title") lit dans le dictionnaire de la langue active ; si la clé
  // manque (traduction pas encore faite), on retombe sur le français plutôt
  // que d'afficher la clé brute à l'utilisateur.
  function t(key, vars) {
    let value = getByPath(DICTIONARIES[locale], key);
    if (value === undefined) value = getByPath(DICTIONARIES.fr, key);
    if (value === undefined) return key;
    if (vars) {
      return Object.entries(vars).reduce(
        (str, [k, v]) => (typeof str === "string" ? str.split(`{${k}}`).join(v) : str),
        value
      );
    }
    return value;
  }

  return (
    <LanguageContext.Provider value={{ locale, setLocale, t, isRtl: RTL_LOCALES.has(locale) }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within a LanguageProvider");
  return ctx;
}
