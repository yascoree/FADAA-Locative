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
  error = null,
}) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <p>{message}</p>
      {error && (
        <p
          style={{
            background: "var(--brand-danger-soft, rgba(181, 83, 62, 0.12))",
            color: "var(--brand-danger, #b5533e)",
            borderRadius: "8px",
            padding: "0.65rem 0.85rem",
            fontSize: "0.85rem",
            fontWeight: 600,
          }}
        >
          <i className="bi bi-exclamation-triangle-fill" style={{ marginRight: "0.4rem" }} />
          {error}
        </p>
      )}
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
