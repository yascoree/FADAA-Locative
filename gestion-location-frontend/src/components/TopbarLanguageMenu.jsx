"use client";

import { useEffect, useRef, useState } from "react";
import { useLanguage, LANGUAGE_OPTIONS } from "@/context/LanguageContext";
import styles from "./ui.module.css";

/** Sélecteur de langue compact du topbar (à côté de NotificationBell) — même
    contexte/état que LanguageSwitcher (landing) et LanguagePicker (Paramètres) :
    change `locale` dans LanguageContext, qui persiste en localStorage et
    s'applique donc identiquement partout dans l'app. */
export default function TopbarLanguageMenu() {
  const { locale, setLocale } = useLanguage();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const current = LANGUAGE_OPTIONS.find((o) => o.value === locale) || LANGUAGE_OPTIONS[0];

  useEffect(() => {
    function handleClickOutside(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className={styles.langMenuWrap} ref={wrapRef}>
      <button
        type="button"
        className={styles.langMenuButton}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        title={current.label}
      >
        <i className="bi bi-translate" />
        {current.short}
        <i className={`bi bi-chevron-down ${styles.langMenuChevron} ${open ? styles.langMenuChevronOpen : ""}`} />
      </button>
      {open && (
        <ul className={styles.langMenuList} role="listbox">
          {LANGUAGE_OPTIONS.map((opt) => (
            <li key={opt.value} role="presentation">
              <button
                type="button"
                role="option"
                aria-selected={opt.value === locale}
                className={`${styles.langMenuOption} ${opt.value === locale ? styles.langMenuOptionActive : ""}`}
                onClick={() => {
                  setLocale(opt.value);
                  setOpen(false);
                }}
              >
                <span>{opt.label}</span>
                {opt.value === locale && <i className="bi bi-check-lg" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
