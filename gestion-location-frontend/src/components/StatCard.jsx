import styles from "./ui.module.css";

const ICON_CLASS = {
  primary: styles.statIconPrimary,
  accent: styles.statIconAccent,
  warning: styles.statIconWarning,
  danger: styles.statIconDanger,
};

/** Carte de statistique (icône + libellé + valeur), utilisée sur les dashboards. */
export default function StatCard({ icon, tone = "primary", label, value }) {
  return (
    <div className={styles.statCard}>
      <span className={`${styles.statIcon} ${ICON_CLASS[tone] || ICON_CLASS.primary}`}>
        <i className={`bi ${icon}`} />
      </span>
      <div className={styles.statBody}>
        <div className={styles.statLabel}>{label}</div>
        <div className={styles.statValue}>{value}</div>
      </div>
    </div>
  );
}
