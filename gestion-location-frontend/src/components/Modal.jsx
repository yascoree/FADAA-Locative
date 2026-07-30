"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import styles from "./ui.module.css";

/** Fenêtre modale générique (overlay + fermeture Échap/clic sur le fond).
    `size="lg"` élargit la modale — pour les contenus riches (galerie photo,
    carte...) à l'étroit dans la largeur par défaut.

    Rendue via un portail dans #portal-root (un div que chaque layout backoffice
    place juste à côté de .shell, voir proprietaire/layout.js) plutôt que dans le
    flux normal de la page : les pages backoffice enveloppent leur contenu dans
    PageTransition (animation d'opacity) et d'autres wrappers qui, selon la page,
    peuvent créer un contexte d'empilement — un overlay position:fixed resterait
    alors piégé dedans et pourrait se retrouver sous le header du dashboard malgré
    son z-index. #portal-root est un enfant direct de .shell : il hérite donc les
    variables CSS --primary/--text/... propres à l'espace (contrairement à un
    portail dans document.body, hors de .shell, où ces variables n'existeraient
    plus). Fallback sur document.body pour les pages hors layout backoffice
    (ex: /front/login) où #portal-root n'existe pas. */
export default function Modal({ isOpen, onClose, title, children, bodyRef, size }) {
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
    <div className={styles.overlay} onClick={onClose}>
      <div
        className={`${styles.modal} ${size === "lg" ? styles.modalLg : ""}`}
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <div className={styles.modalHeader}>
            <h2 className={styles.modalTitle}>{title}</h2>
            <button type="button" className={styles.modalClose} onClick={onClose} aria-label="Fermer">
              <i className="bi bi-x-lg" />
            </button>
          </div>
        )}
        <div className={styles.modalBody} ref={bodyRef}>
          {children}
        </div>
      </div>
    </div>,
    document.getElementById("portal-root") || document.body
  );
}
