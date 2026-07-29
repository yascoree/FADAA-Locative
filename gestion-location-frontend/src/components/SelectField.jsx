import styles from "./ui.module.css";

/** Sélecteur avec libellé et erreur — options: [{ value, label }]. */
export default function SelectField({ label, error, hint, id, options, ...selectProps }) {
  const fieldId = id || selectProps.name;
  return (
    <label className={styles.field} htmlFor={fieldId}>
      {label}
      <select id={fieldId} className={`${styles.fieldSelect} ${error ? styles.fieldInputError : ""}`} {...selectProps}>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} disabled={opt.disabled}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && <span className={styles.fieldError}>{error}</span>}
      {!error && hint && <span className={styles.fieldHint}>{hint}</span>}
    </label>
  );
}
