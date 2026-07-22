import styles from "./ui.module.css";

/** État d'erreur générique avec action "Réessayer" optionnelle. */
export default function ErrorState({ message = "Une erreur est survenue.", onRetry }) {
  return (
    <div className={styles.stateWrap}>
      <i className={`bi bi-exclamation-triangle ${styles.stateIcon} ${styles.stateIconError}`} />
      <p className={styles.stateTitle}>Impossible de charger les données</p>
      <p className={styles.stateDescription}>{message}</p>
      {onRetry && (
        <button type="button" className={styles.btnOutline} onClick={onRetry} style={{ marginTop: "0.6rem" }}>
          <i className="bi bi-arrow-clockwise" />
          Réessayer
        </button>
      )}
    </div>
  );
}
