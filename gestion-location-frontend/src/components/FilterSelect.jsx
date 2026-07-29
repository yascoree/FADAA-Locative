"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./ui.module.css";

/** Liste déroulante stylée pour remplacer les <select> natifs des barres de filtres
    (rendu du menu géré en CSS plutôt que par l'OS). Même API qu'un select contrôlé :
    `value`/`onChange(newValue)` et `options`: [{ value, label }] (inclure l'option
    "Tous les X" comme un item normal avec value=""). */
export default function FilterSelect({ value, onChange, options, id, className = "", disabled = false }) {
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const containerRef = useRef(null);
  const triggerRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedIndex = Math.max(
    0,
    options.findIndex((o) => String(o.value) === String(value))
  );
  const selected = options[selectedIndex];

  function selectOption(opt) {
    onChange(String(opt.value));
    setOpen(false);
    triggerRef.current?.focus();
  }

  function handleKeyDown(e) {
    if (!open && ["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
      e.preventDefault();
      setOpen(true);
      setHighlighted(selectedIndex);
      return;
    }
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlighted((i) => Math.min(i + 1, options.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      selectOption(options[highlighted]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    } else if (e.key === "Tab") {
      setOpen(false);
    }
  }

  return (
    <div ref={containerRef} className={`${styles.filterSelectWrap} ${className}`}>
      <button
        id={id}
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`${styles.filterSelectTrigger} ${open ? styles.filterSelectTriggerOpen : ""}`}
        onClick={() => {
          setOpen((o) => !o);
          setHighlighted(selectedIndex);
        }}
        onKeyDown={handleKeyDown}
      >
        <span className={styles.filterSelectValue}>{selected?.label}</span>
        <i className={`bi bi-chevron-down ${styles.filterSelectChevron}`} />
      </button>
      {open && (
        <ul role="listbox" className={styles.filterSelectDropdown}>
          {options.map((opt, i) => (
            <li key={opt.value} role="presentation">
              <button
                type="button"
                role="option"
                aria-selected={i === selectedIndex}
                className={`${styles.filterSelectOption} ${i === highlighted ? styles.filterSelectOptionActive : ""} ${
                  i === selectedIndex ? styles.filterSelectOptionSelected : ""
                }`}
                onMouseEnter={() => setHighlighted(i)}
                onClick={() => selectOption(opt)}
              >
                <span>{opt.label}</span>
                {i === selectedIndex && <i className="bi bi-check-lg" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
