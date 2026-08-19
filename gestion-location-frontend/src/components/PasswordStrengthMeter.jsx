"use client";

import { useLanguage } from "@/context/LanguageContext";
import styles from "@/app/front/login/login.module.css";

export function getPasswordStrength(pw) {
  if (!pw) return 0;
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (score <= 1) return 1;
  if (score <= 3) return 2;
  return 3;
}

const STRENGTH_BAR_CLASS = [null, "pwStrengthBarWeak", "pwStrengthBarMedium", "pwStrengthBarStrong"];
const STRENGTH_LABEL_CLASS = [null, "pwStrengthLabelWeak", "pwStrengthLabelMedium", "pwStrengthLabelStrong"];
const STRENGTH_LABEL_KEY = [null, "login.pwStrengthWeak", "login.pwStrengthMedium", "login.pwStrengthStrong"];

export default function PasswordStrengthMeter({ password }) {
  const { t } = useLanguage();
  const strength = getPasswordStrength(password);
  const hasLength = password.length >= 8;
  const hasUpper = /[A-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);

  return (
    <div>
      <div className={styles.pwStrengthMeter}>
        {[1, 2, 3].map((bar) => (
          <span
            key={bar}
            className={`${styles.pwStrengthBar} ${bar <= strength ? styles[STRENGTH_BAR_CLASS[strength]] : ""}`}
          />
        ))}
      </div>
      {password.length > 0 && (
        <p className={`${styles.pwStrengthLabel} ${styles[STRENGTH_LABEL_CLASS[strength]]}`}>
          {t("login.pwStrengthLabel")} : {t(STRENGTH_LABEL_KEY[strength])}
        </p>
      )}
      <ul className={styles.pwChecklist}>
        <li className={`${styles.pwChecklistItem} ${hasLength ? styles.pwChecklistItemMet : ""}`}>
          <span className={styles.pwChecklistDot}>{hasLength && <i className="bi bi-check" />}</span>
          {t("login.pwReqLength")}
        </li>
        <li className={`${styles.pwChecklistItem} ${hasUpper ? styles.pwChecklistItemMet : ""}`}>
          <span className={styles.pwChecklistDot}>{hasUpper && <i className="bi bi-check" />}</span>
          {t("login.pwReqUpper")}
        </li>
        <li className={`${styles.pwChecklistItem} ${hasNumber ? styles.pwChecklistItemMet : ""}`}>
          <span className={styles.pwChecklistDot}>{hasNumber && <i className="bi bi-check" />}</span>
          {t("login.pwReqNumber")}
        </li>
      </ul>
    </div>
  );
}
