"use client";

import { useEffect, useMemo, useState } from "react";
import { extractErrorMessage } from "@/lib/apiClient";
import {
  fetchBiens,
  fetchBaux,
  fetchEcheances,
  fetchPaiements,
  createPaiement,
  updateEcheance,
  deleteEcheance,
  ECHEANCE_STATUS,
  ECHEANCE_STATUS_LABELS,
  PAIEMENT_STATUS,
  MODE_PAIEMENT,
  MODE_PAIEMENT_LABELS,
} from "@/lib/properties";
import StatCard from "@/components/StatCard";
import Modal from "@/components/Modal";
import ConfirmationDialog from "@/components/ConfirmationDialog";
import TextField from "@/components/TextField";
import SelectField from "@/components/SelectField";
import FilterChip from "@/components/FilterChip";
import FilterSelect from "@/components/FilterSelect";
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
const MODE_OPTIONS = Object.entries(MODE_PAIEMENT_LABELS).map(([value, label]) => ({ value, label }));
const PAGE_SIZE = 10;

export default function AgenceEcheancesPage() {
  const [echeances, setEcheances] = useState([]);
  const [baux, setBaux] = useState([]);
  const [biens, setBiens] = useState([]);
  const [paiements, setPaiements] = useState([]);
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

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  const [payTarget, setPayTarget] = useState(null);
  const [payDraft, setPayDraft] = useState(null);
  const [payBusy, setPayBusy] = useState(false);
  const [payBanner, setPayBanner] = useState(null);

  useEffect(() => {
    async function init() {
      setIsLoading(true);
      try {
        const [echeancesList, bauxList, biensList, paiementsList, permissionIndex] = await Promise.all([
          fetchEcheances(),
          fetchBaux(),
          fetchBiens(),
          fetchPaiements(),
          fetchGestionnairePermissionIndex(),
        ]);
        setEcheances(echeancesList);
        setBaux(bauxList);
        setBiens(biensList);
        setPaiements(paiementsList);
        setPermIndex(permissionIndex);
      } catch (err) {
        setLoadError(extractErrorMessage(err));
      } finally {
        setIsLoading(false);
      }
    }
    init();
  }, []);

  function paidSoFar(echeanceId) {
    return paiements
      .filter((p) => p.echeance_id === echeanceId && p.statut !== PAIEMENT_STATUS.ANNULE)
      .reduce((sum, p) => sum + Number(p.montant || 0), 0);
  }

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
        const haystack = [
          e.reference,
          e.bail?.locataire?.prenom,
          e.bail?.locataire?.nom,
          e.bail?.locataire?.email,
          biens.find((b) => b.id === e.bail?.lot?.bien_id)?.designation,
          e.bail?.lot?.reference,
          e.montant_du,
          formatDate(e.date_echeance),
          ECHEANCE_STATUS_LABELS[e.statut],
        ]
          .filter((v) => v !== null && v !== undefined && v !== "")
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      if (bailFilter && String(e.bail_id) !== bailFilter) return false;
      if (statusFilter && String(e.statut) !== statusFilter) return false;
      if (overdueOnly && !isOverdue(e)) return false;
      return true;
    });
  }, [echeances, search, bailFilter, statusFilter, overdueOnly, biens]);

  const totalPages = Math.max(1, Math.ceil(filteredEcheances.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedEcheances = filteredEcheances.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  function openEdit(echeance) {
    setEditTarget(echeance);
    setEditDraft({
      date_echeance: echeance.date_echeance || "",
      montant_du: echeance.montant_du ?? "",
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

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      await deleteEcheance(deleteTarget.id);
      setEcheances((prev) => prev.filter((e) => e.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err) {
      setDeleteError(extractErrorMessage(err));
    } finally {
      setDeleteBusy(false);
    }
  }

  // Le statut réel est recalculé et persisté côté serveur dès la création du
  // paiement (voir sync_echeance_statut) — on se contente ici de refléter la
  // même valeur localement, sans appel réseau supplémentaire.
  function reconcileEcheanceLocal(echeanceId, extraMontant) {
    const echeance = echeances.find((e) => e.id === echeanceId);
    if (!echeance || echeance.montant_du === null || echeance.montant_du === undefined) return;
    const paidTotal = paidSoFar(echeanceId) + Number(extraMontant || 0);
    const newStatus =
      paidTotal >= Number(echeance.montant_du)
        ? ECHEANCE_STATUS.PAYE
        : paidTotal > 0
          ? ECHEANCE_STATUS.PARTIEL
          : ECHEANCE_STATUS.IMPAYE;
    if (newStatus === echeance.statut) return;
    setEcheances((prev) => prev.map((e) => (e.id === echeanceId ? { ...e, statut: newStatus } : e)));
  }

  function openPay(echeance) {
    const reste = Number(echeance.montant_du || 0) - paidSoFar(echeance.id);
    setPayTarget(echeance);
    setPayDraft({
      montant: reste > 0 ? String(reste) : "",
      mode_paiement: String(MODE_PAIEMENT.VIREMENT),
    });
    setPayBanner(null);
  }

  function closePay() {
    if (payBusy) return;
    setPayTarget(null);
    setPayDraft(null);
  }

  async function handleSubmitPay(e) {
    e.preventDefault();
    if (!payTarget) return;
    setPayBusy(true);
    setPayBanner(null);
    try {
      const created = await createPaiement({
        echeanceId: payTarget.id,
        montant: payDraft.montant,
        modePaiement: Number(payDraft.mode_paiement),
      });
      setPaiements((prev) => [...prev, created]);
      reconcileEcheanceLocal(payTarget.id, payDraft.montant);
      setPayTarget(null);
      setPayDraft(null);
    } catch (err) {
      setPayBanner({ type: "error", message: extractErrorMessage(err) });
    } finally {
      setPayBusy(false);
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

        <div className={styles.filtersRow}>
          <input
            type="text"
            placeholder="Rechercher (référence, locataire, bien, montant, date...)"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCurrentPage(1);
            }}
          />
          <FilterSelect
            value={bailFilter}
            onChange={(v) => {
              setBailFilter(v);
              setCurrentPage(1);
            }}
            options={[{ value: "", label: "Tous les baux" }, ...baux.map((b) => ({ value: b.id, label: bailLabel(b) }))]}
          />
          <FilterSelect
            value={statusFilter}
            onChange={(v) => {
              setStatusFilter(v);
              setCurrentPage(1);
            }}
            options={[{ value: "", label: "Tous les statuts" }, ...STATUS_OPTIONS]}
          />
          <FilterChip
            checked={overdueOnly}
            onChange={(checked) => {
              setOverdueOnly(checked);
              setCurrentPage(1);
            }}
          >
            En retard uniquement
          </FilterChip>
        </div>

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Référence</th>
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
                  <td colSpan={7} className={styles.empty}>
                    Aucune échéance ne correspond à ces critères.
                  </td>
                </tr>
              )}
              {paginatedEcheances.map((e) => {
                const overdue = isOverdue(e);
                return (
                  <tr key={e.id}>
                    <td className={styles.mono}>{e.reference}</td>
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
                        const notPaid = e.statut !== ECHEANCE_STATUS.PAYE;
                        const canPay = permIndex?.hasForBien(bienId, proprietaireId, "CREATE_PAYMENT") && notPaid;
                        const canUpdate =
                          permIndex?.hasForBien(bienId, proprietaireId, "UPDATE_DUE_DATE") &&
                          e.statut === ECHEANCE_STATUS.IMPAYE;
                        const canDelete = permIndex?.hasForBien(bienId, proprietaireId, "DELETE_DUE_DATE");
                        if (!canPay && !canUpdate && !canDelete) return <span className={styles.empty}>—</span>;
                        return (
                          <div className={styles.tableActions}>
                            {canPay && (
                              <button type="button" className={styles.iconBtn} onClick={() => openPay(e)} title="Payer">
                                <i className="bi bi-cash-coin" />
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
                                onClick={() => {
                                  setDeleteTarget(e);
                                  setDeleteError(null);
                                }}
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

      {/* ---- Payer une échéance ---- */}
      <Modal isOpen={!!payTarget} onClose={closePay} title="Payer l'échéance">
        {payTarget && payDraft && (
          <form onSubmit={handleSubmitPay}>
            <Banner banner={payBanner} />
            <p className={styles.sectionSubtitle} style={{ marginBottom: "0.3rem" }}>
              {bailLabel(payTarget.bail)}
            </p>
            <p className={styles.sectionSubtitle} style={{ marginBottom: "1rem" }}>
              Montant dû : {formatCurrency(payTarget.montant_du)}
              {" · "}Reste à payer : {formatCurrency(Math.max(0, Number(payTarget.montant_du || 0) - paidSoFar(payTarget.id)))}
            </p>
            <TextField
              label="Montant payé (MAD)"
              name="montant"
              type="number"
              step="0.01"
              min="0"
              value={payDraft.montant}
              onChange={(e) => setPayDraft((d) => ({ ...d, montant: e.target.value }))}
              required
            />
            <SelectField
              label="Mode de paiement"
              name="mode_paiement"
              options={MODE_OPTIONS}
              value={payDraft.mode_paiement}
              onChange={(e) => setPayDraft((d) => ({ ...d, mode_paiement: e.target.value }))}
            />

            <div className={styles.editActions} style={{ marginTop: "1.2rem" }}>
              <button type="submit" className={styles.btn} disabled={payBusy}>
                <i className="bi bi-check-lg" />
                {payBusy ? "Enregistrement..." : "Enregistrer le paiement"}
              </button>
              <button type="button" className={styles.btnOutline} onClick={closePay} disabled={payBusy}>
                <i className="bi bi-x-lg" />
                Annuler
              </button>
            </div>
          </form>
        )}
      </Modal>

      <ConfirmationDialog
        isOpen={!!deleteTarget}
        onClose={() => {
          setDeleteTarget(null);
          setDeleteError(null);
        }}
        onConfirm={handleConfirmDelete}
        title="Masquer l'échéance"
        message={deleteTarget ? `Masquer l'échéance du ${formatDate(deleteTarget.date_echeance)} ?` : ""}
        confirmLabel="Masquer"
        danger
        isBusy={deleteBusy}
        error={deleteError}
      />
    </div>
  );
}
