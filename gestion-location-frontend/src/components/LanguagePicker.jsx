"use client";

import { useLanguage, LANGUAGE_OPTIONS } from "@/context/LanguageContext";
import ls from "./LanguagePicker.module.css";

const BADGE_TONE = {
  fr: ls.badgeFr,
  en: ls.badgeEn,
  ar: ls.badgeAr,
};

/** Carte "Langue" des pages Paramètres — même principe que PasswordChangeCard :
    `styles` est le module CSS de la page appelante (section/card/cardTitle),
    pour rester visuellement cohérent avec le reste du panneau Paramètres, tandis
    que la grille de langues elle-même vit dans son propre module (ls). */
export default function LanguagePicker({ styles }) {
  const { locale, setLocale, t } = useLanguage();

  return (
    <div className={styles.section}>
      <div className={styles.card}>
        <h3 className={styles.cardTitle}>
          <i className="bi bi-translate" style={{ color: "var(--primary)" }} />
          {t("bo.language.title")}
        </h3>
        <p className={styles.sectionSubtitle} style={{ margin: "-0.4rem 0 1rem" }}>
          {t("bo.language.subtitle")}
        </p>

        <div className={ls.grid} role="radiogroup" aria-label={t("bo.language.title")}>
          {LANGUAGE_OPTIONS.map((opt) => {
            const active = opt.value === locale;
            return (
              <button
                key={opt.value}
                type="button"
                role="radio"
                aria-checked={active}
                className={`${ls.option} ${active ? ls.optionActive : ""}`}
                onClick={() => setLocale(opt.value)}
              >
                <span className={`${ls.badge} ${BADGE_TONE[opt.value] || ""}`}>{opt.short}</span>
                <span className={ls.body}>
                  <span className={ls.name}>{opt.label}</span>
                  <span className={ls.code}>{opt.short}</span>
                </span>
                {active && (
                  <span className={ls.check}>
                    <i className="bi bi-check-lg" />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
