import styles from "./ui.module.css";

const TONE_CLASS = {
  success: styles.badgeSuccess,
  warning: styles.badgeWarning,
  danger: styles.badgeDanger,
  info: styles.badgeInfo,
  neutral: styles.badgeNeutral,
};

/** Pastille de statut générique (ex: Actif/Suspendu/Expiré, Payé/En retard...). */
export default function StatusBadge({ tone = "neutral", children }) {
  return <span className={`${styles.badge} ${TONE_CLASS[tone] || styles.badgeNeutral}`}>{children}</span>;
}
