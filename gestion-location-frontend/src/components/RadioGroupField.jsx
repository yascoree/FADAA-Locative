import styles from "./ui.module.css";

/** Groupe de boutons radio avec libellé — options: [{ value, label }]. */
export default function RadioGroupField({ label, name, options, value, onChange, hint }) {
  return (
    <label className={styles.field}>
      {label}
      <div className={styles.radioGroup}>
        {options.map((opt) => (
          <label key={opt.value} className={styles.radioOption}>
            <input
              type="radio"
              name={name}
              value={opt.value}
              checked={String(value) === String(opt.value)}
              onChange={onChange}
            />
            {opt.label}
          </label>
        ))}
      </div>
      {hint && <span className={styles.fieldHint}>{hint}</span>}
    </label>
  );
}
