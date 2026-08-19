"use client";

import { useCallback, useRef, useState } from "react";
import styles from "./Toast.module.css";

let idCounter = 0;

/**
 * Floating, auto-dismissing confirmations (saved/published/deleted...) — unlike
 * an inline Banner, these don't shift the page layout and stay visible no matter
 * how far down the page the user has scrolled.
 */
export function useToast() {
  const [toasts, setToasts] = useState([]);
  const timers = useRef({});

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    clearTimeout(timers.current[id]);
    delete timers.current[id];
  }, []);

  const showToast = useCallback(
    (message, type = "success", duration = 4000) => {
      const id = ++idCounter;
      setToasts((prev) => [...prev, { id, message, type }]);
      timers.current[id] = setTimeout(() => dismissToast(id), duration);
      return id;
    },
    [dismissToast]
  );

  return { toasts, showToast, dismissToast };
}

export function ToastStack({ toasts, onDismiss }) {
  if (!toasts.length) return null;
  return (
    <div className={styles.stack}>
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`${styles.toast} ${t.type === "error" ? styles.toastError : styles.toastSuccess}`}
          role="status"
        >
          <i className={`bi ${t.type === "error" ? "bi-exclamation-triangle-fill" : "bi-check-circle-fill"}`} />
          <span className={styles.toastMessage}>{t.message}</span>
          <button type="button" className={styles.toastClose} onClick={() => onDismiss(t.id)} aria-label="Fermer">
            <i className="bi bi-x" />
          </button>
        </div>
      ))}
    </div>
  );
}
