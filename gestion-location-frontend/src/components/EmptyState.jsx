import styles from "./ui.module.css";

/** État "rien à afficher" générique — remplace ComingSoon pour les listes vides
    et les sections pas encore construites. */
export default function EmptyState({
  icon = "bi-inbox",
  title = "Aucune donnée",
  description,
  actionLabel,
  onAction,
}) {
  return (
    <div className={styles.stateWrap}>
      <i className={`bi ${icon} ${styles.stateIcon}`} />
      <p className={styles.stateTitle}>{title}</p>
      {description && <p className={styles.stateDescription}>{description}</p>}
      {actionLabel && onAction && (
        <button type="button" className={styles.btn} onClick={onAction} style={{ marginTop: "0.6rem" }}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}
