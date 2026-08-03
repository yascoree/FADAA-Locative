"use client";

import { useEffect, useRef, useState } from "react";
import { useLanguage, LANGUAGE_OPTIONS } from "@/context/LanguageContext";
import styles from "@/app/landing.module.css";

export default function LanguageSwitcher() {
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
    <div className={styles.langSwitchWrap} ref={wrapRef}>
      <button
        type="button"
        className={styles.langSwitch}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {current.short} <i className={`bi bi-chevron-down ${open ? styles.langSwitchChevronOpen : ""}`} />
      </button>
      {open && (
        <ul className={styles.langSwitchMenu} role="listbox">
          {LANGUAGE_OPTIONS.map((opt) => (
            <li key={opt.value} role="presentation">
              <button
                type="button"
                role="option"
                aria-selected={opt.value === locale}
                className={`${styles.langSwitchOption} ${opt.value === locale ? styles.langSwitchOptionActive : ""}`}
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
