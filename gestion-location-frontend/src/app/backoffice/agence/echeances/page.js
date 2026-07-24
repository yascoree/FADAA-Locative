"use client";

import { useEffect, useMemo, useState } from "react";
import { extractErrorMessage } from "@/lib/apiClient";
import {
  fetchBiens,
  fetchBaux,
  fetchEcheances,
  updateEcheance,
  deleteEcheance,
  ECHEANCE_STATUS,
  ECHEANCE_STATUS_LABELS,
} from "@/lib/properties";
import StatCard from "@/components/StatCard";
import Modal from "@/components/Modal";
import ConfirmationDialog from "@/components/ConfirmationDialog";
import TextField from "@/components/TextField";
import SelectField from "@/components/SelectField";
import { fetchGestionnairePermissionIndex } from "@/lib/mandates";
import styles from "../agence.module.css";

function Banner({ banner }) {
  if (!banner) return null;
  return (
    <div className={`${styles.banner} ${banner.type === "success" ? styles.bannerSuccess : styles.bannerError}`}>
      {banner.message}
    </div>
  );
}

function badgeClass(statut) {
  if (statut === ECHEANCE_STATUS.PAYE) return styles.badgeActive;
  if (statut === ECHEANCE_STATUS.PARTIEL) return styles.badgeWarning;
  return styles.badgeDanger;
}

function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

function formatCurrency(value) {
  if (value === null || value === undefined || value === "") return "—";
  return `${Number(value).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} MAD`;
}

function isOverdue(echeance) {
  if (echeance.statut === ECHEANCE_STATUS.PAYE || !echeance.date_echeance) return false;
  return new Date(echeance.date_echeance) < new Date(new Date().toDateString());
}

const STATUS_OPTIONS = Object.entries(ECHEANCE_STATUS_LABELS).map(([value, label]) => ({ value, label }));
const PAGE_SIZE = 10;

export default function AgenceEcheancesPage() {
  const [echeances, setEcheances] = useState([]);
  const [baux, setBaux] = useState([]);
  const [biens, setBiens] = useState([]);
  const [permIndex, setPermIndex] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const [search, setSearch] = useState("");
  const [bailFilter, setBailFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const [editTarget, setEditTarget] = useState(null);
  const [editDraft, setEditDraft] = useState(null);
  const [editBusy, setEditBusy] = useState(false);
  const [editBanner, setEditBanner] = useState(null);

  const [rowBusyId, setRowBusyId] = useState(null);
  const [rowBanner, setRowBanner] = useState(null);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  useEffect(() => {
    async function init() {
      setIsLoading(true);
      try {
        const [echeancesList, bauxList, biensList, permissionIndex] = await Promise.all([
          fetchEcheances(),
          fetchBaux(),
          fetchBiens(),
          fetchGestionnairePermissionIndex(),
        ]);
        setEcheances(echeancesList);
        setBaux(bauxList);
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
    return {
      total: echeances.length,
      payees: echeances.filter((e) => e.statut === ECHEANCE_STATUS.PAYE).length,
      partielles: echeances.filter((e) => e.statut === ECHEANCE_STATUS.PARTIEL).length,
      impayees: echeances.filter((e) => e.statut === ECHEANCE_STATUS.IMPAYE).length,
    };
  }, [echeances]);

  function bailLabel(bail) {
    if (!bail) return "—";
    const bien = biens.find((b) => b.id === bail.lot?.bien_id);
    const bienName = bien?.designation || `Bien #${bail.lot?.bien_id}`;
    const lotRef = bail.lot?.reference || `Lot #${bail.lot_id}`;
    const locataire = bail.locataire ? `${bail.locataire.prenom} ${bail.locataire.nom}` : "";
    return `${bienName} — ${lotRef}${locataire ? ` · ${locataire}` : ""}`;
  }

  const filteredEcheances = useMemo(() => {
    const term = search.trim().toLowerCase();
    return echeances.filter((e) => {
      if (term) {
        const name = `${e.bail?.locataire?.prenom || ""} ${e.bail?.locataire?.nom || ""} ${e.bail?.locataire?.email || ""}`.toLowerCase();
        if (!name.includes(term)) return false;
      }
      if (bailFilter && String(e.bail_id) !== bailFilter) return false;
      if (statusFilter && String(e.statut) !== statusFilter) return false;
      if (overdueOnly && !isOverdue(e)) return false;
      return true;
    });
  }, [echeances, search, bailFilter, statusFilter, overdueOnly]);

  const totalPages = Math.max(1, Math.ceil(filteredEcheances.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedEcheances = filteredEcheances.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  function openEdit(echeance) {
    setEditTarget(echeance);
    setEditDraft({
      date_echeance: echeance.date_echeance || "",
      montant_du: echeance.montant_du ?? "",
      statut: String(echeance.statut),
    });
    setEditBanner(null);
  }

  function closeEdit() {
    if (editBusy) return;
    setEditTarget(null);
    setEditDraft(null);
  }

  async function handleSubmitEdit(e) {
    e.preventDefault();
    if (!editTarget) return;
    setEditBusy(true);
    setEditBanner(null);
    try {
      const updated = await updateEcheance(editTarget.id, {
        date_echeance: editDraft.date_echeance || null,
        montant_du: editDraft.montant_du === "" ? null : Number(editDraft.montant_du),
        statut: Number(editDraft.statut),
      });
      setEcheances((prev) => prev.map((e) => (e.id === updated.id ? { ...e, ...updated } : e)));
      setEditTarget(null);
      setEditDraft(null);
    } catch (err) {
      setEditBanner({ type: "error", message: extractErrorMessage(err) });
    } finally {
      setEditBusy(false);
    }
  }

  async function handleMarkPaid(echeance) {
    setRowBusyId(echeance.id);
    setRowBanner(null);
    try {
      const updated = await updateEcheance(echeance.id, { statut: ECHEANCE_STATUS.PAYE });
      setEcheances((prev) => prev.map((e) => (e.id === updated.id ? { ...e, ...updated } : e)));
    } catch (err) {
      setRowBanner({ type: "error", message: extractErrorMessage(err) });
    } finally {
      setRowBusyId(null);
    }
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    setDeleteBusy(true);
    try {
      await deleteEcheance(deleteTarget.id);
      setEcheances((prev) => prev.filter((e) => e.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err) {
      setRowBanner({ type: "error", message: extractErrorMessage(err) });
      setDeleteTarget(null);
    } finally {
      setDeleteBusy(false);
    }
  }

  if (isLoading) {
    return <p>Chargement...</p>;
  }

  return (
    <div>
      <Banner banner={loadError ? { type: "error", message: loadError } : null} />

      {/* ---- Stats ---- */}
      <div className={styles.section}>
        <div className={styles.statsGrid}>
          <StatCard icon="bi-calendar-check-fill" tone="primary" label="Échéances" value={stats.total} />
          <StatCard icon="bi-check-circle-fill" tone="accent" label="Payées" value={stats.payees} />
          <StatCard icon="bi-hourglass-split" tone="warning" label="Partielles" value={stats.partielles} />
          <StatCard icon="bi-exclamation-octagon-fill" tone="danger" label="Impayées" value={stats.impayees} />
        </div>
      </div>

      {/* ---- Table ---- */}
      <div className={styles.section} style={{ marginBottom: 0 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem" }}>
          <div>
            <h2 className={styles.sectionTitle}>
              <i className="bi bi-table" style={{ marginRight: "0.5rem", color: "var(--primary)" }} />
              Échéances
            </h2>
            <p className={styles.sectionSubtitle}>
              {filteredEcheances.length} échéance(s) affichée(s) sur {echeances.length}, tous propriétaires confondus.
              Générées automatiquement à la création de chaque bail.
            </p>
          </div>
        </div>

        <Banner banner={rowBanner} />

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
          <select
            value={bailFilter}
            onChange={(e) => {
              setBailFilter(e.target.value);
              setCurrentPage(1);
            }}
          >
            <option value="">Tous les baux</option>
            {baux.map((b) => (
              <option key={b.id} value={b.id}>
                {bailLabel(b)}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setCurrentPage(1);
            }}
          >
            <option value="">Tous les statuts</option>
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <label className={styles.checkFilter}>
            <input
              type="checkbox"
              checked={overdueOnly}
              onChange={(e) => {
                setOverdueOnly(e.target.checked);
                setCurrentPage(1);
              }}
            />
            En retard uniquement
          </label>
        </div>

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Locataire</th>
                <th>Bien / Lot</th>
                <th>Date d&apos;échéance</th>
                <th>Montant dû</th>
                <th>Statut</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredEcheances.length === 0 && (
                <tr>
                  <td colSpan={6} className={styles.empty}>
                    Aucune échéance ne correspond à ces critères.
                  </td>
                </tr>
              )}
              {paginatedEcheances.map((e) => {
                const overdue = isOverdue(e);
                const isPaid = e.statut === ECHEANCE_STATUS.PAYE;
                return (
                  <tr key={e.id}>
                    <td>
                      {e.bail?.locataire ? (
                        <div>
                          <div className={styles.userName}>
                            {e.bail.locataire.prenom} {e.bail.locataire.nom}
                          </div>
                          <div className={styles.recentEmail}>{e.bail.locataire.email}</div>
                        </div>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>{bailLabel(e.bail)}</td>
                    <td>
                      {formatDate(e.date_echeance)}
                      {overdue && (
                        <span className={styles.badge} style={{ marginLeft: "0.5rem", background: "var(--danger-soft)", color: "var(--danger)" }}>
                          En retard
                        </span>
                      )}
                    </td>
                    <td>{formatCurrency(e.montant_du)}</td>
                    <td>
                      <span className={`${styles.badge} ${badgeClass(e.statut)}`}>
                        {ECHEANCE_STATUS_LABELS[e.statut] || "—"}
                      </span>
                    </td>
                    <td>
                      {(() => {
                        const bienId = e.bail?.lot?.bien_id;
                        const proprietaireId = biens.find((b) => b.id === bienId)?.proprietaire_id;
                        const canUpdate = permIndex?.hasForBien(bienId, proprietaireId, "UPDATE_DUE_DATE");
                        const canDelete = permIndex?.hasForBien(bienId, proprietaireId, "DELETE_DUE_DATE");
                        if (!canUpdate && !canDelete) return <span className={styles.empty}>—</span>;
                        return (
                          <div className={styles.tableActions}>
                            {!isPaid && canUpdate && (
                              <button
                                type="button"
                                className={styles.iconBtn}
                                onClick={() => handleMarkPaid(e)}
                                disabled={rowBusyId === e.id}
                                title="Marquer comme payée"
                              >
                                <i className="bi bi-check-lg" />
                              </button>
                            )}
                            {canUpdate && (
                              <button type="button" className={styles.iconBtn} onClick={() => openEdit(e)} title="Modifier">
                                <i className="bi bi-pencil" />
                              </button>
                            )}
                            {canDelete && (
                              <button
                                type="button"
                                className={`${styles.iconBtn} ${styles.iconBtnDanger}`}
                                onClick={() => setDeleteTarget(e)}
                                title="Supprimer"
                              >
                                <i className="bi bi-trash" />
                              </button>
                            )}
                          </div>
                        );
                      })()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {filteredEcheances.length > 0 && (
            <div className={styles.paginationRow}>
              <span>
                Page {safePage} / {totalPages} · {filteredEcheances.length} échéance(s)
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

      {/* ---- Modifier une échéance ---- */}
      <Modal isOpen={!!editTarget} onClose={closeEdit} title="Modifier l'échéance">
        {editTarget && editDraft && (
          <form onSubmit={handleSubmitEdit}>
            <Banner banner={editBanner} />
            <p className={styles.sectionSubtitle} style={{ marginBottom: "1rem" }}>
              {bailLabel(editTarget.bail)}
            </p>
            <TextField
              label="Date d'échéance"
              name="date_echeance"
              type="date"
              value={editDraft.date_echeance}
              onChange={(e) => setEditDraft((d) => ({ ...d, date_echeance: e.target.value }))}
            />
            <TextField
              label="Montant dû (MAD)"
              name="montant_du"
              type="number"
              step="0.01"
              min="0"
              value={editDraft.montant_du}
              onChange={(e) => setEditDraft((d) => ({ ...d, montant_du: e.target.value }))}
            />
            <SelectField
              label="Statut"
              name="statut"
              options={STATUS_OPTIONS}
              value={editDraft.statut}
              onChange={(e) => setEditDraft((d) => ({ ...d, statut: e.target.value }))}
            />

            <div className={styles.editActions} style={{ marginTop: "1.2rem" }}>
              <button type="submit" className={styles.btn} disabled={editBusy}>
                <i className="bi bi-check-lg" />
                {editBusy ? "Enregistrement..." : "Enregistrer"}
              </button>
              <button type="button" className={styles.btnOutline} onClick={closeEdit} disabled={editBusy}>
                <i className="bi bi-x-lg" />
                Annuler
              </button>
            </div>
          </form>
        )}
      </Modal>

      <ConfirmationDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        title="Supprimer l'échéance"
        message={
          deleteTarget
            ? `Supprimer définitivement cette échéance du ${formatDate(deleteTarget.date_echeance)} ? Les paiements déjà enregistrés dessus ne seront pas supprimés. Cette action est irréversible.`
            : ""
        }
        confirmLabel="Supprimer"
        danger
        isBusy={deleteBusy}
      />
    </div>
  );
}
