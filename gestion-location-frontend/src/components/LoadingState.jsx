import styles from "./ui.module.css";

/** Indicateur de chargement générique, centré, avec libellé optionnel. */
export default function LoadingState({ label = "Chargement..." }) {
  return (
    <div className={styles.stateWrap}>
      <div className={styles.spinner} />
      {label && <p className={styles.stateDescription}>{label}</p>}
    </div>
  );
}
