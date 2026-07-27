"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./ui.module.css";

/** Champ texte avec suggestions filtrées — pour choisir un élément dans une liste
    (ex: un gestionnaire) en tapant son nom/email plutôt qu'un <select> natif. */
export default function SearchableSelect({ label, items, getId, getLabel, value, onSelect, placeholder, hint, id }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filtered = items.filter((item) => getLabel(item).toLowerCase().includes(query.trim().toLowerCase()));

  const input = (
    <input
      id={id}
      className={styles.fieldInput}
      value={value ? getLabel(value) : query}
      placeholder={placeholder}
      onFocus={() => setOpen(true)}
      onChange={(e) => {
        setQuery(e.target.value);
        setOpen(true);
        if (value) onSelect(null);
      }}
    />
  );

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      {label ? (
        <label className={styles.field}>
          {label}
          {input}
          {hint && <span className={styles.fieldHint}>{hint}</span>}
        </label>
      ) : (
        input
      )}
      {open && filtered.length > 0 && (
        <ul
          style={{
            position: "absolute",
            zIndex: 10,
            top: "100%",
            left: 0,
            right: 0,
            background: "var(--brand-surface)",
            border: "1px solid var(--brand-border)",
            borderRadius: "var(--brand-radius-field)",
            maxHeight: "220px",
            overflowY: "auto",
            margin: "0.25rem 0 0",
            padding: "0.3rem",
            listStyle: "none",
            boxShadow: "0 8px 24px rgba(0, 0, 0, 0.12)",
          }}
        >
          {filtered.map((item) => (
            <li key={getId(item)}>
              <button
                type="button"
                onClick={() => {
                  onSelect(item);
                  setQuery("");
                  setOpen(false);
                }}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  padding: "0.5rem 0.6rem",
                  border: "none",
                  background: "none",
                  borderRadius: "calc(var(--brand-radius-field) - 2px)",
                  cursor: "pointer",
                  color: "inherit",
                }}
              >
                {getLabel(item)}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
