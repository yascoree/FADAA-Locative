"use client";

import { useState, useEffect } from "react";
import { extractErrorMessage } from "@/lib/apiClient";
import { fetchAvis, updateAvisStatut, deleteAvis, AVIS_STATUS, AVIS_STATUS_LABELS } from "@/lib/avis";
import ConfirmationDialog from "@/components/ConfirmationDialog";
import styles from "../admin.module.css";

function Banner({ banner }) {
  if (!banner) return null;
  return (
    <div className={`${styles.banner} ${banner.type === "success" ? styles.bannerSuccess : styles.bannerError}`}>
      {banner.message}
    </div>
  );
}

function Stars({ note }) {
  return (
    <span className={styles.starRow}>
      {[1, 2, 3, 4, 5].map((n) => (
        <i key={n} className={`bi ${n <= note ? "bi-star-fill" : "bi-star"}`} />
      ))}
    </span>
  );
}

function avisBadgeClass(statut) {
  if (statut === AVIS_STATUS.PUBLIE) return styles.badgeActive;
  if (statut === AVIS_STATUS.REJETE) return styles.badgeExpired;
  return styles.badgeSuspended;
}

function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
}

export default function AdminAvisPage() {
  const [avisList, setAvisList] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const [avisBanner, setAvisBanner] = useState(null);
  const [avisBusyId, setAvisBusyId] = useState(null);
  const [avisDeleteTarget, setAvisDeleteTarget] = useState(null);
  const [avisDeleteBusy, setAvisDeleteBusy] = useState(false);

  useEffect(() => {
    async function init() {
      setIsLoading(true);
      try {
        const avisData = await fetchAvis();
        setAvisList(avisData);
      } catch (err) {
        setLoadError(extractErrorMessage(err));
      } finally {
        setIsLoading(false);
      }
    }
    init();
  }, []);

  async function handleAvisStatut(avis, statut) {
    setAvisBanner(null);
    setAvisBusyId(avis.id);
    try {
      const updated = await updateAvisStatut(avis.id, statut);
      setAvisList((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
    } catch (err) {
      setAvisBanner({ type: "error", message: extractErrorMessage(err) });
    } finally {
      setAvisBusyId(null);
    }
  }

  async function handleConfirmDeleteAvis() {
    if (!avisDeleteTarget) return;
    setAvisDeleteBusy(true);
    try {
      await deleteAvis(avisDeleteTarget.id);
      setAvisList((prev) => prev.filter((a) => a.id !== avisDeleteTarget.id));
      setAvisDeleteTarget(null);
    } catch (err) {
      setAvisBanner({ type: "error", message: extractErrorMessage(err) });
    } finally {
      setAvisDeleteBusy(false);
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
          <i className="bi bi-chat-square-quote" style={{ marginRight: "0.5rem", color: "var(--primary)" }} />
          Modération des avis
        </h2>
        <p className={styles.sectionSubtitle}>
          Approuvez les avis pour les afficher publiquement, rejetez ceux qui ne doivent pas apparaître, ou
          supprimez-les définitivement.
        </p>

        <Banner banner={avisBanner} />

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Auteur</th>
                <th>Note</th>
                <th>Commentaire</th>
                <th>Date</th>
                <th>Statut</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {avisList.length === 0 && (
                <tr>
                  <td colSpan={6} className={styles.empty}>
                    Aucun avis pour le moment.
                  </td>
                </tr>
              )}
              {avisList.map((avis) => {
                const busy = avisBusyId === avis.id;
                return (
                  <tr key={avis.id}>
                    <td>
                      <span className={styles.userName}>
                        {avis.user ? `${avis.user.prenom} ${avis.user.nom}` : `Utilisateur #${avis.user_id}`}
                      </span>
                      {avis.user?.email && <div className={styles.tableSubtext}>{avis.user.email}</div>}
                    </td>
                    <td>
                      <Stars note={avis.note} />
                    </td>
                    <td style={{ maxWidth: 320 }}>{avis.commentaire || "—"}</td>
                    <td>{formatDate(avis.date_creation)}</td>
                    <td>
                      <span className={`${styles.badge} ${avisBadgeClass(avis.statut)}`}>
                        {AVIS_STATUS_LABELS[avis.statut]}
                      </span>
                    </td>
                    <td>
                      <div className={styles.tableActions}>
                        {avis.statut !== AVIS_STATUS.PUBLIE && (
                          <button
                            type="button"
                            className={styles.iconBtn}
                            onClick={() => handleAvisStatut(avis, AVIS_STATUS.PUBLIE)}
                            disabled={busy}
                            title="Approuver (afficher publiquement)"
                          >
                            <i className="bi bi-check-lg" />
                          </button>
                        )}
                        {avis.statut !== AVIS_STATUS.REJETE && (
                          <button
                            type="button"
                            className={styles.iconBtn}
                            onClick={() => handleAvisStatut(avis, AVIS_STATUS.REJETE)}
                            disabled={busy}
                            title="Rejeter (masquer)"
                          >
                            <i className="bi bi-eye-slash" />
                          </button>
                        )}
                        <button
                          type="button"
                          className={styles.iconBtn}
                          onClick={() => setAvisDeleteTarget(avis)}
                          title="Supprimer définitivement"
                        >
                          <i className="bi bi-trash" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <ConfirmationDialog
        isOpen={!!avisDeleteTarget}
        onClose={() => setAvisDeleteTarget(null)}
        onConfirm={handleConfirmDeleteAvis}
        title="Supprimer l'avis"
        message="Supprimer définitivement cet avis ? Cette action est irréversible."
        confirmLabel="Supprimer"
        danger
        isBusy={avisDeleteBusy}
      />
    </div>
  );
}
