"use client";

import { useMemo, useState, useEffect } from "react";
import { extractErrorMessage } from "@/lib/apiClient";
import {
  fetchBiens,
  fetchQuittances,
  downloadQuittance,
  annulerQuittance,
  QUITTANCE_STATUS,
  QUITTANCE_STATUS_LABELS,
} from "@/lib/properties";
import { fetchGestionnairePermissionIndex } from "@/lib/mandates";
import StatCard from "@/components/StatCard";
import ConfirmationDialog from "@/components/ConfirmationDialog";
import styles from "../agence.module.css";

function Banner({ banner }) {
  if (!banner) return null;
  return (
    <div className={`${styles.banner} ${banner.type === "success" ? styles.bannerSuccess : styles.bannerError}`}>
      {banner.message}
    </div>
  );
}

function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

function formatCurrency(value) {
  if (value === null || value === undefined || value === "") return "—";
  return `${Number(value).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} MAD`;
}

const PAGE_SIZE = 10;

export default function AgenceQuittancesPage() {
  const [quittances, setQuittances] = useState([]);
  const [biens, setBiens] = useState([]);
  const [permIndex, setPermIndex] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const [search, setSearch] = useState("");
  const [monthOnly, setMonthOnly] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const [downloadingId, setDownloadingId] = useState(null);
  const [downloadError, setDownloadError] = useState(null);

  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelBusy, setCancelBusy] = useState(false);
  const [cancelError, setCancelError] = useState(null);

  useEffect(() => {
    async function init() {
      setIsLoading(true);
      try {
        const [quittancesList, biensList, permissionIndex] = await Promise.all([
          fetchQuittances(),
          fetchBiens(),
          fetchGestionnairePermissionIndex(),
        ]);
        setQuittances(quittancesList);
        setBiens(biensList);
        setPermIndex(permissionIndex);
      } catch (err) {
        setLoadError(extractErrorMessage(err));
      } finally {
        setIsLoading(false);
      }
    }
    init();
  }, []);

  const stats = useMemo(() => {
    const now = new Date();
    const total = quittances.reduce((sum, q) => sum + Number(q.paiement?.montant || 0), 0);
    const moisCourant = quittances
      .filter((q) => {
        const d = new Date(q.date_generation);
        return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
      })
      .reduce((sum, q) => sum + Number(q.paiement?.montant || 0), 0);
    return { count: quittances.length, total, moisCourant };
  }, [quittances]);

  function bienLotLabel(quittance) {
    const bail = quittance.paiement?.echeance?.bail;
    if (!bail) return "—";
    const bien = biens.find((b) => b.id === bail.lot?.bien_id);
    const bienName = bien?.designation || `Bien #${bail.lot?.bien_id}`;
    return `${bienName} — ${bail.lot?.reference || `Lot #${bail.lot_id}`}`;
  }

  const filteredQuittances = useMemo(() => {
    const term = search.trim().toLowerCase();
    const now = new Date();
    return quittances.filter((q) => {
      if (term) {
        const locataire = q.paiement?.echeance?.bail?.locataire;
        const name = `${locataire?.prenom || ""} ${locataire?.nom || ""} ${locataire?.email || ""}`.toLowerCase();
        if (!name.includes(term)) return false;
      }
      if (monthOnly) {
        const d = new Date(q.date_generation);
        if (d.getFullYear() !== now.getFullYear() || d.getMonth() !== now.getMonth()) return false;
      }
      return true;
    });
  }, [quittances, search, monthOnly]);

  const totalPages = Math.max(1, Math.ceil(filteredQuittances.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedQuittances = filteredQuittances.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  async function handleDownload(quittance) {
    setDownloadingId(quittance.id);
    setDownloadError(null);
    try {
      await downloadQuittance(quittance.id);
    } catch (err) {
      setDownloadError(extractErrorMessage(err));
    } finally {
      setDownloadingId(null);
    }
  }

  function canCancelQuittance(quittance) {
    if (!permIndex) return false;
    const bienId = quittance.paiement?.echeance?.bail?.lot?.bien_id;
    const bien = biens.find((b) => b.id === bienId);
    if (!bien) return false;
    return permIndex.hasForBien(bienId, bien.proprietaire_id, "UPDATE_PAYMENT");
  }

  async function handleConfirmCancel() {
    if (!cancelTarget) return;
    setCancelBusy(true);
    setCancelError(null);
    try {
      const updated = await annulerQuittance(cancelTarget.id);
      setQuittances((prev) => prev.map((q) => (q.id === updated.id ? { ...q, ...updated } : q)));
      setCancelTarget(null);
    } catch (err) {
      setCancelError(extractErrorMessage(err));
    } finally {
      setCancelBusy(false);
    }
  }

  if (isLoading) {
    return <p>Chargement...</p>;
  }

  return (
    <div>
      <Banner banner={loadError ? { type: "error", message: loadError } : null} />
      <Banner banner={downloadError ? { type: "error", message: downloadError } : null} />

      {/* ---- Stats ---- */}
      <div className={styles.section}>
        <div className={styles.statsGrid}>
          <StatCard icon="bi-file-earmark-pdf-fill" tone="primary" label="Quittances" value={stats.count} />
          <StatCard icon="bi-cash-stack" tone="accent" label="Montant total" value={formatCurrency(stats.total)} />
          <StatCard icon="bi-calendar-check-fill" tone="primary" label="Générées ce mois" value={formatCurrency(stats.moisCourant)} />
        </div>
      </div>

      {/* ---- Table ---- */}
      <div className={styles.section} style={{ marginBottom: 0 }}>
        <h2 className={styles.sectionTitle}>
          <i className="bi bi-table" style={{ marginRight: "0.5rem", color: "var(--primary)" }} />
          Quittances
        </h2>
        <p className={styles.sectionSubtitle}>
          {filteredQuittances.length} quittance(s) affichée(s) sur {quittances.length}, tous propriétaires confondus.
          Générées automatiquement à chaque paiement enregistré.
        </p>

        <div className={styles.filtersRow}>
          <input
            type="text"
            placeholder="Rechercher par locataire..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCurrentPage(1);
            }}
          />
          <label className={styles.checkFilter}>
            <input
              type="checkbox"
              checked={monthOnly}
              onChange={(e) => {
                setMonthOnly(e.target.checked);
                setCurrentPage(1);
              }}
            />
            Ce mois uniquement
          </label>
        </div>

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Locataire</th>
                <th>Bien / Lot</th>
                <th>Montant</th>
                <th>Date de paiement</th>
                <th>Générée le</th>
                <th>Statut</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredQuittances.length === 0 && (
                <tr>
                  <td colSpan={7} className={styles.empty}>
                    Aucune quittance ne correspond à ces critères.
                  </td>
                </tr>
              )}
              {paginatedQuittances.map((q) => {
                const locataire = q.paiement?.echeance?.bail?.locataire;
                return (
                  <tr key={q.id}>
                    <td>
                      {locataire ? (
                        <div>
                          <div className={styles.userName}>
                            {locataire.prenom} {locataire.nom}
                          </div>
                          <div className={styles.recentEmail}>{locataire.email}</div>
                        </div>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>{bienLotLabel(q)}</td>
                    <td>{formatCurrency(q.paiement?.montant)}</td>
                    <td>{formatDate(q.paiement?.date_paiement)}</td>
                    <td>{formatDate(q.date_generation)}</td>
                    <td>
                      <span className={`${styles.badge} ${q.statut === QUITTANCE_STATUS.ANNULEE ? styles.badgeDanger : styles.badgeActive}`}>
                        {QUITTANCE_STATUS_LABELS[q.statut] || "—"}
                      </span>
                    </td>
                    <td>
                      <div className={styles.tableActions}>
                        <button
                          type="button"
                          className={styles.btnOutline}
                          onClick={() => handleDownload(q)}
                          disabled={downloadingId === q.id}
                        >
                          <i className="bi bi-download" />
                          {downloadingId === q.id ? "..." : "PDF"}
                        </button>
                        {q.statut !== QUITTANCE_STATUS.ANNULEE && canCancelQuittance(q) && (
                          <button
                            type="button"
                            className={`${styles.iconBtn} ${styles.iconBtnDanger}`}
                            onClick={() => {
                              setCancelTarget(q);
                              setCancelError(null);
                            }}
                            title="Annuler cette quittance"
                          >
                            <i className="bi bi-x-circle" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {filteredQuittances.length > 0 && (
            <div className={styles.paginationRow}>
              <span>
                Page {safePage} / {totalPages} · {filteredQuittances.length} quittance(s)
              </span>
              <div className={styles.paginationButtons}>
                <button
                  type="button"
                  className={styles.btnOutline}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={safePage <= 1}
                >
                  <i className="bi bi-chevron-left" />
                  Précédent
                </button>
                <button
                  type="button"
                  className={styles.btnOutline}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={safePage >= totalPages}
                >
                  Suivant
                  <i className="bi bi-chevron-right" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <ConfirmationDialog
        isOpen={!!cancelTarget}
        onClose={() => {
          setCancelTarget(null);
          setCancelError(null);
        }}
        onConfirm={handleConfirmCancel}
        title="Annuler la quittance"
        message={
          cancelTarget
            ? `Annuler cette quittance de ${formatCurrency(cancelTarget.paiement?.montant)} ? Elle reste consultable dans l'historique avec le statut "Annulée".`
            : ""
        }
        confirmLabel="Annuler la quittance"
        danger
        isBusy={cancelBusy}
        error={cancelError}
      />
    </div>
  );
}
