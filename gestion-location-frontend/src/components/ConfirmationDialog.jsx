"use client";

import Modal from "./Modal";
import styles from "./ui.module.css";

/**
 * Boîte de confirmation générique — pour toute action destructive (ex: suppression
 * douce d'un bien/lot/bail). N'exécute jamais l'action elle-même : se contente
 * d'appeler onConfirm, à charge de l'appelant d'invoquer le bon endpoint DELETE.
 */
export default function ConfirmationDialog({
  isOpen,
  onClose,
  onConfirm,
  title = "Confirmer l'action",
  message,
  confirmLabel = "Confirmer",
  cancelLabel = "Annuler",
  danger = false,
  isBusy = false,
}) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <p>{message}</p>
      <div className={styles.modalActions}>
        <button type="button" className={styles.btnOutline} onClick={onClose} disabled={isBusy}>
          {cancelLabel}
        </button>
        <button
          type="button"
          className={`${styles.btn} ${danger ? styles.btnDanger : ""}`}
          onClick={onConfirm}
          disabled={isBusy}
        >
          {isBusy ? "..." : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
