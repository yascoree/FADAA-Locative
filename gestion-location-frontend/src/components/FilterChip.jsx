import styles from "./ui.module.css";

/** Filtre booléen sous forme de puce ("Ce mois uniquement", "En retard", ...),
 * remplace un simple checkbox + label par un composant visuellement plus riche. */
export default function FilterChip({ checked, onChange, children }) {
  return (
    <label className={`${styles.filterChip} ${checked ? styles.filterChipActive : ""}`}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className={styles.filterChipDot}>
        <i className="bi bi-check-lg" />
      </span>
      {children}
    </label>
  );
}
