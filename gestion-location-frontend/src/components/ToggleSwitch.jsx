import styles from "./ui.module.css";

/** Switch on/off avec libellé, utilisé pour basculer entre deux vues (ex: actives/masquées). */
export default function ToggleSwitch({ checked, onChange, label }) {
  return (
    <label className={styles.switchRow}>
      {label && <span className={styles.switchLabel}>{label}</span>}
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        className={`${styles.switch} ${checked ? styles.switchOn : ""}`}
        onClick={() => onChange(!checked)}
      />
    </label>
  );
}
