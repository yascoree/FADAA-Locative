"use client";

import { useState, useEffect } from "react";
import { extractErrorMessage } from "@/lib/apiClient";
import {
  fetchContactMessages,
  updateContactMessageStatut,
  CONTACT_MESSAGE_STATUS,
  CONTACT_MESSAGE_STATUS_LABELS,
} from "@/lib/contactMessages";
import styles from "../admin.module.css";

function Banner({ banner }) {
  if (!banner) return null;
  return (
    <div className={`${styles.banner} ${banner.type === "success" ? styles.bannerSuccess : styles.bannerError}`}>
      {banner.message}
    </div>
  );
}

function messageBadgeClass(statut) {
  if (statut === CONTACT_MESSAGE_STATUS.TRAITE) return styles.badgeActive;
  return styles.badgeSuspended;
}

function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
}

export default function AdminMessagesContactPage() {
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const [banner, setBanner] = useState(null);
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    async function init() {
      setIsLoading(true);
      try {
        const data = await fetchContactMessages();
        setMessages(data);
      } catch (err) {
        setLoadError(extractErrorMessage(err));
      } finally {
        setIsLoading(false);
      }
    }
    init();
  }, []);

  async function handleMarkTraite(message) {
    setBanner(null);
    setBusyId(message.id);
    try {
      const updated = await updateContactMessageStatut(message.id, CONTACT_MESSAGE_STATUS.TRAITE);
      setMessages((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
    } catch (err) {
      setBanner({ type: "error", message: extractErrorMessage(err) });
    } finally {
      setBusyId(null);
    }
  }

  if (isLoading) {
    return <p>Chargement...</p>;
  }

  return (
    <div>
      <Banner banner={loadError ? { type: "error", message: loadError } : null} />

      <div className={styles.section} style={{ marginBottom: 0 }}>
        <h2 className={styles.sectionTitle}>
          <i className="bi bi-envelope-paper" style={{ marginRight: "0.5rem", color: "var(--primary)" }} />
          Messages de contact
        </h2>
        <p className={styles.sectionSubtitle}>
          Messages soumis depuis le formulaire de contact public. Répondez par e-mail ou téléphone puis marquez le
          message comme traité.
        </p>

        <Banner banner={banner} />

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Nom</th>
                <th>Contact</th>
                <th>Sujet</th>
                <th>Message</th>
                <th>Reçu le</th>
                <th>Statut</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {messages.length === 0 && (
                <tr>
                  <td colSpan={7} className={styles.empty}>
                    Aucun message de contact pour le moment.
                  </td>
                </tr>
              )}
              {messages.map((m) => {
                const busy = busyId === m.id;
                return (
                  <tr key={m.id}>
                    <td>
                      <span className={styles.userName}>
                        {m.prenom} {m.nom}
                      </span>
                    </td>
                    <td>
                      <div>{m.email}</div>
                      {m.telephone && <div className={styles.tableSubtext}>{m.telephone}</div>}
                    </td>
                    <td>{m.sujet}</td>
                    <td style={{ maxWidth: 280 }}>{m.message}</td>
                    <td>{formatDate(m.date_creation)}</td>
                    <td>
                      <span className={`${styles.badge} ${messageBadgeClass(m.statut)}`}>
                        {CONTACT_MESSAGE_STATUS_LABELS[m.statut]}
                      </span>
                    </td>
                    <td>
                      {m.statut !== CONTACT_MESSAGE_STATUS.TRAITE && (
                        <div className={styles.tableActions}>
                          <button
                            type="button"
                            className={styles.iconBtn}
                            onClick={() => handleMarkTraite(m)}
                            disabled={busy}
                            title="Marquer comme traité"
                          >
                            <i className="bi bi-check-lg" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
