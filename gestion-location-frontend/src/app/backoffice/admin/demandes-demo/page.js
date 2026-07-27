"use client";

import { useState, useEffect } from "react";
import { extractErrorMessage } from "@/lib/apiClient";
import {
  fetchDemandesDemo,
  updateDemandeDemoStatut,
  DEMANDE_DEMO_STATUS,
  DEMANDE_DEMO_STATUS_LABELS,
} from "@/lib/demandesDemo";
import styles from "../admin.module.css";

function Banner({ banner }) {
  if (!banner) return null;
  return (
    <div className={`${styles.banner} ${banner.type === "success" ? styles.bannerSuccess : styles.bannerError}`}>
      {banner.message}
    </div>
  );
}

function demandeBadgeClass(statut) {
  if (statut === DEMANDE_DEMO_STATUS.CONTACTEE) return styles.badgeActive;
  return styles.badgeSuspended;
}

function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
}

export default function AdminDemandesDemoPage() {
  const [demandes, setDemandes] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const [banner, setBanner] = useState(null);
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    async function init() {
      setIsLoading(true);
      try {
        const data = await fetchDemandesDemo();
        setDemandes(data);
      } catch (err) {
        setLoadError(extractErrorMessage(err));
      } finally {
        setIsLoading(false);
      }
    }
    init();
  }, []);

  async function handleMarkContactee(demande) {
    setBanner(null);
    setBusyId(demande.id);
    try {
      const updated = await updateDemandeDemoStatut(demande.id, DEMANDE_DEMO_STATUS.CONTACTEE);
      setDemandes((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
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
          <i className="bi bi-calendar2-check" style={{ marginRight: "0.5rem", color: "var(--primary)" }} />
          Demandes de démo
        </h2>
        <p className={styles.sectionSubtitle}>
          Demandes soumises depuis la landing page publique. Contactez la personne puis marquez la demande comme
          traitée.
        </p>

        <Banner banner={banner} />

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Nom</th>
                <th>Contact</th>
                <th>Date souhaitée</th>
                <th>Message</th>
                <th>Reçue le</th>
                <th>Statut</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {demandes.length === 0 && (
                <tr>
                  <td colSpan={7} className={styles.empty}>
                    Aucune demande de démo pour le moment.
                  </td>
                </tr>
              )}
              {demandes.map((d) => {
                const busy = busyId === d.id;
                return (
                  <tr key={d.id}>
                    <td>
                      <span className={styles.userName}>{d.nom}</span>
                    </td>
                    <td>
                      <div>{d.email}</div>
                      <div className={styles.tableSubtext}>{d.telephone}</div>
                    </td>
                    <td>{d.date_souhaitee ? formatDate(d.date_souhaitee) : "—"}</td>
                    <td style={{ maxWidth: 280 }}>{d.message || "—"}</td>
                    <td>{formatDate(d.date_creation)}</td>
                    <td>
                      <span className={`${styles.badge} ${demandeBadgeClass(d.statut)}`}>
                        {DEMANDE_DEMO_STATUS_LABELS[d.statut]}
                      </span>
                    </td>
                    <td>
                      {d.statut !== DEMANDE_DEMO_STATUS.CONTACTEE && (
                        <div className={styles.tableActions}>
                          <button
                            type="button"
                            className={styles.iconBtn}
                            onClick={() => handleMarkContactee(d)}
                            disabled={busy}
                            title="Marquer comme contactée"
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
