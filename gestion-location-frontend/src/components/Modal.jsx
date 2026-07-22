"use client";

import { useEffect } from "react";
import styles from "./ui.module.css";

/** Fenêtre modale générique (overlay + fermeture Échap/clic sur le fond). */
export default function Modal({ isOpen, onClose, title, children }) {
  useEffect(() => {
    if (!isOpen) return undefined;
    function handleKeyDown(e) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        {title && (
          <div className={styles.modalHeader}>
            <h2 className={styles.modalTitle}>{title}</h2>
            <button type="button" className={styles.modalClose} onClick={onClose} aria-label="Fermer">
              <i className="bi bi-x-lg" />
            </button>
          </div>
        )}
        <div className={styles.modalBody}>{children}</div>
      </div>
    </div>
  );
}
