import styles from "./ui.module.css";
import CalendarInput from "./CalendarInput";

/** Champ texte/nombre/date avec libellé, erreur et indice — building block des
    formulaires métier (Biens, Lots, Baux...). Un `type="date"` bascule sur le
    calendrier déroulant maison (CalendarInput) plutôt que le picker natif du
    navigateur, dont le rendu est incohérent selon OS/navigateur. */
export default function TextField({ label, error, hint, id, as = "input", ...inputProps }) {
  const fieldId = id || inputProps.name;
  const Tag = as === "textarea" ? "textarea" : "input";
  const { type, ...restProps } = inputProps;
  return (
    <label className={styles.field} htmlFor={fieldId}>
      {label}
      {type === "date" ? (
        <CalendarInput id={fieldId} {...restProps} />
      ) : (
        <Tag id={fieldId} type={type} className={`${styles.fieldInput} ${error ? styles.fieldInputError : ""}`} {...restProps} />
      )}
      {error && <span className={styles.fieldError}>{error}</span>}
      {!error && hint && <span className={styles.fieldHint}>{hint}</span>}
    </label>
  );
}
