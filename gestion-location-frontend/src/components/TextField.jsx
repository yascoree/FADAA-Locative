import styles from "./ui.module.css";

/** Champ texte/nombre/date avec libellé, erreur et indice — building block des
    formulaires métier (Biens, Lots, Baux...). */
export default function TextField({ label, error, hint, id, ...inputProps }) {
  const fieldId = id || inputProps.name;
  return (
    <label className={styles.field} htmlFor={fieldId}>
      {label}
      <input id={fieldId} className={`${styles.fieldInput} ${error ? styles.fieldInputError : ""}`} {...inputProps} />
      {error && <span className={styles.fieldError}>{error}</span>}
      {!error && hint && <span className={styles.fieldHint}>{hint}</span>}
    </label>
  );
}
