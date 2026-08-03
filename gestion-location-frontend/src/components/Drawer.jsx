"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import styles from "./ui.module.css";

/** Panneau de détail qui glisse depuis le bord droit de l'écran (overlay +
    fermeture Échap/clic sur le fond), rendu via portail dans #portal-root
    (voir Modal.jsx pour le pourquoi — même mécanisme et même raison). Contrairement
    à un panneau affiché en ligne dans la page, il reste visible immédiatement peu
    importe où l'utilisateur a scrollé dans une longue liste, et laisse la liste
    derrière consultable plutôt que de bloquer tout l'écran comme un Modal centré.
    `title` accepte n'importe quel contenu (ex: un en-tête d'identité riche avec
    avatar). */
export default function Drawer({ isOpen, onClose, title, children, wide = false }) {
  useEffect(() => {
    if (!isOpen) return undefined;
    function handleKeyDown(e) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div className={styles.drawerOverlay} onClick={onClose}>
      <div
        className={`${styles.drawerPanel} ${wide ? styles.drawerPanelWide : ""}`}
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.drawerHeader}>
          {title}
          <button type="button" className={styles.drawerClose} onClick={onClose} aria-label="Fermer">
            <i className="bi bi-x-lg" />
          </button>
        </div>
        <div className={styles.drawerBody}>{children}</div>
      </div>
    </div>,
    document.getElementById("portal-root") || document.body
  );
}
