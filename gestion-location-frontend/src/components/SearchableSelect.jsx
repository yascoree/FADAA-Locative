"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./ui.module.css";

function initials(label) {
  const parts = label.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase();
}

/** Champ texte avec suggestions filtrées — pour choisir un élément dans une liste
    (ex: un gestionnaire) en tapant son nom/email plutôt qu'un <select> natif.
    `getMeta` (optionnel) fournit une ligne secondaire (ex: l'email), affichée sous
    le libellé principal dans le menu et incluse dans la recherche. */
export default function SearchableSelect({
  label,
  items,
  getId,
  getLabel,
  getMeta,
  value,
  onSelect,
  placeholder,
  hint,
  id,
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const containerRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filtered = items.filter((item) => {
    const haystack = `${getLabel(item)} ${getMeta ? getMeta(item) : ""}`.toLowerCase();
    return haystack.includes(query.trim().toLowerCase());
  });

  function selectItem(item) {
    onSelect(item);
    setQuery("");
    setOpen(false);
  }

  function handleKeyDown(e) {
    if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      setOpen(true);
      return;
    }
    if (!open || filtered.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlighted((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      selectItem(filtered[highlighted]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  const input = (
    <div className={styles.searchSelectInputWrap}>
      <i className={`bi bi-search ${styles.searchSelectIcon}`} />
      <input
        id={id}
        className={`${styles.fieldInput} ${styles.searchSelectInput}`}
        value={value ? getLabel(value) : query}
        placeholder={placeholder}
        onFocus={() => {
          setOpen(true);
          setHighlighted(0);
        }}
        onKeyDown={handleKeyDown}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setHighlighted(0);
          if (value) onSelect(null);
        }}
      />
      {(value || query) && (
        <button
          type="button"
          className={styles.searchSelectClear}
          onClick={() => {
            onSelect(null);
            setQuery("");
          }}
          aria-label="Effacer"
        >
          <i className="bi bi-x-lg" />
        </button>
      )}
    </div>
  );

  return (
    <div ref={containerRef} className={styles.searchSelectWrap}>
      {label ? (
        <label className={styles.field}>
          {label}
          {input}
          {hint && <span className={styles.fieldHint}>{hint}</span>}
        </label>
      ) : (
        input
      )}
      {open && (
        <div className={styles.searchSelectDropdown}>
          {filtered.length === 0 ? (
            <p className={styles.searchSelectEmpty}>
              <i className="bi bi-search" />
              Aucun résultat{query.trim() ? ` pour « ${query.trim()} »` : ""}
            </p>
          ) : (
            <ul className={styles.searchSelectList}>
              {filtered.map((item, i) => (
                <li key={getId(item)}>
                  <button
                    type="button"
                    className={`${styles.searchSelectOption} ${i === highlighted ? styles.searchSelectOptionActive : ""}`}
                    onMouseEnter={() => setHighlighted(i)}
                    onClick={() => selectItem(item)}
                  >
                    <span className={styles.searchSelectAvatar}>{initials(getLabel(item))}</span>
                    <span className={styles.searchSelectOptionBody}>
                      <span className={styles.searchSelectOptionName}>{getLabel(item)}</span>
                      {getMeta && <span className={styles.searchSelectOptionMeta}>{getMeta(item)}</span>}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
