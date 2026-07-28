"use client";

import { useEffect, useMemo, useState } from "react";
import { extractErrorMessage } from "@/lib/apiClient";
import {
  fetchBiens,
  fetchEcheances,
  fetchPaiements,
  createPaiement,
  updatePaiement,
  annulerPaiement,
  updateEcheance,
  downloadQuittance,
  ECHEANCE_STATUS,
  MODE_PAIEMENT,
  MODE_PAIEMENT_LABELS,
  PAIEMENT_STATUS,
  PAIEMENT_STATUS_LABELS,
} from "@/lib/properties";
import { fetchLocataires } from "@/lib/tenants";
import { fetchGestionnairePermissionIndex } from "@/lib/mandates";
import StatCard from "@/components/StatCard";
import Modal from "@/components/Modal";
import ConfirmationDialog from "@/components/ConfirmationDialog";
import TextField from "@/components/TextField";
import SelectField from "@/components/SelectField";
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

const MODE_OPTIONS = Object.entries(MODE_PAIEMENT_LABELS).map(([value, label]) => ({ value, label }));
const PAGE_SIZE = 10;

const EMPTY_CREATE_FORM = {
  locataire_id: "",
  echeance_id: "",
  montant: "",
  mode_paiement: String(MODE_PAIEMENT.VIREMENT),
};

export default function AgencePaiementsPage() {
  const [paiements, setPaiements] = useState([]);
  const [echeances, setEcheances] = useState([]);
  const [biens, setBiens] = useState([]);
  const [locataires, setLocataires] = useState([]);
  const [permIndex, setPermIndex] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const [search, setSearch] = useState("");
  const [modeFilter, setModeFilter] = useState("");
  const [monthOnly, setMonthOnly] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const [createOpen, setCreateOpen] = useState(false);
  const [createDraft, setCreateDraft] = useState(EMPTY_CREATE_FORM);
  const [createBusy, setCreateBusy] = useState(false);
  const [createBanner, setCreateBanner] = useState(null);

  const [editTarget, setEditTarget] = useState(null);
  const [editDraft, setEditDraft] = useState(null);
  const [editBusy, setEditBusy] = useState(false);
  const [editBanner, setEditBanner] = useState(null);

  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelBusy, setCancelBusy] = useState(false);
  const [cancelError, setCancelError] = useState(null);
  const [listBanner, setListBanner] = useState(null);
  const [downloadingId, setDownloadingId] = useState(null);

  useEffect(() => {
    async function init() {
      setIsLoading(true);
      try {
        const [paiementsList, echeancesList, biensList, locatairesList, permissionIndex] = await Promise.all([
          fetchPaiements(),
          fetchEcheances(),
          fetchBiens(),
          fetchLocataires(),
          fetchGestionnairePermissionIndex(),
        ]);
        setPaiements(paiementsList);
        setEcheances(echeancesList);
        setBiens(biensList);
        setLocataires(locatairesList);
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
    const total = paiements.reduce((sum, p) => sum + Number(p.montant || 0), 0);
    const moisCourant = paiements
      .filter((p) => {
        const d = new Date(p.date_paiement);
        return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
      })
      .reduce((sum, p) => sum + Number(p.montant || 0), 0);
    return {
      count: paiements.length,
      total,
      moisCourant,
      moyenne: paiements.length > 0 ? total / paiements.length : 0,
    };
  }, [paiements]);

  function bienLotLabel(echeance) {
    if (!echeance?.bail) return "—";
    const bien = biens.find((b) => b.id === echeance.bail.lot?.bien_id);
    const bienName = bien?.designation || `Bien #${echeance.bail.lot?.bien_id}`;
    return `${bienName} — ${echeance.bail.lot?.reference || `Lot #${echeance.bail.lot_id}`}`;
  }

  function paidSoFar(echeanceId, excludePaiementId) {
    return paiements
      .filter((p) => p.echeance_id === echeanceId && p.id !== excludePaiementId)
      .reduce((sum, p) => sum + Number(p.montant || 0), 0);
  }

  function echeanceOptionLabel(echeance) {
    const label = `${bienLotLabel(echeance)} · ${echeance.bail?.locataire?.prenom || ""} ${echeance.bail?.locataire?.nom || ""} · ${formatDate(echeance.date_echeance)}`;
    if (echeance.montant_du === null || echeance.montant_du === undefined) return label;
    const reste = Number(echeance.montant_du) - paidSoFar(echeance.id);
    return `${label} · reste ${formatCurrency(Math.max(0, reste))}`;
  }

  function canCreatePaymentForEcheance(echeance) {
    if (!permIndex) return false;
    const bienId = echeance?.bail?.lot?.bien_id;
    const bien = biens.find((b) => b.id === bienId);
    if (!bien) return false;
    return permIndex.hasForBien(bienId, bien.proprietaire_id, "CREATE_PAYMENT");
  }

  function echeancesForLocataire(locataireId) {
    if (!locataireId) return [];
    return echeances
      .filter((e) => e.bail?.locataire_id === Number(locataireId) && canCreatePaymentForEcheance(e))
      .sort((a, b) => {
        if (a.statut !== b.statut) return a.statut === ECHEANCE_STATUS.PAYE ? 1 : -1;
        return new Date(a.date_echeance || 0) - new Date(b.date_echeance || 0);
      });
  }

  const locatairesWithEcheances = useMemo(
    () => locataires.filter((l) => echeances.some((e) => e.bail?.locataire_id === l.id && canCreatePaymentForEcheance(e))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [locataires, echeances, permIndex, biens]
  );

  const createEcheanceOptions = useMemo(
    () => echeancesForLocataire(createDraft.locataire_id),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [createDraft.locataire_id, echeances]
  );

  const filteredPaiements = useMemo(() => {
    const term = search.trim().toLowerCase();
    const now = new Date();
    return paiements.filter((p) => {
      if (term) {
        const locataire = p.echeance?.bail?.locataire;
        const bien = biens.find((b) => b.id === p.echeance?.bail?.lot?.bien_id);
        const haystack = [
          locataire?.prenom,
          locataire?.nom,
          locataire?.email,
          bien?.designation,
          p.echeance?.bail?.lot?.reference,
          p.montant,
          MODE_PAIEMENT_LABELS[p.mode_paiement],
          formatDate(p.date_paiement),
          formatDate(p.echeance?.date_echeance),
          PAIEMENT_STATUS_LABELS[p.statut],
        ]
          .filter((v) => v !== null && v !== undefined && v !== "")
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      if (modeFilter && String(p.mode_paiement) !== modeFilter) return false;
      if (monthOnly) {
        const d = new Date(p.date_paiement);
        if (d.getFullYear() !== now.getFullYear() || d.getMonth() !== now.getMonth()) return false;
      }
      return true;
    });
  }, [paiements, search, modeFilter, monthOnly, biens]);

  const totalPages = Math.max(1, Math.ceil(filteredPaiements.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedPaiements = filteredPaiements.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  async function reconcileEcheance(echeanceId, newMontantForPaiementId, newMontantValue) {
    const echeance = echeances.find((e) => e.id === echeanceId);
    if (!echeance || echeance.montant_du === null || echeance.montant_du === undefined) return;
    const paidTotal = paidSoFar(echeanceId, newMontantForPaiementId) + Number(newMontantValue || 0);
    const newStatus =
      paidTotal >= Number(echeance.montant_du)
        ? ECHEANCE_STATUS.PAYE
        : paidTotal > 0
          ? ECHEANCE_STATUS.PARTIEL
          : ECHEANCE_STATUS.IMPAYE;
    if (newStatus === echeance.statut) return;
    const updated = await updateEcheance(echeanceId, { statut: newStatus });
    setEcheances((prev) => prev.map((e) => (e.id === updated.id ? { ...e, ...updated } : e)));
    return newStatus;
  }

  function openCreate() {
    const firstLocataire = locatairesWithEcheances[0];
    const firstEcheance = firstLocataire ? echeancesForLocataire(firstLocataire.id)[0] : null;
    setCreateDraft({
      ...EMPTY_CREATE_FORM,
      locataire_id: firstLocataire ? String(firstLocataire.id) : "",
      echeance_id: firstEcheance ? String(firstEcheance.id) : "",
    });
    setCreateBanner(null);
    setCreateOpen(true);
  }

  function handleLocataireChange(locataireId) {
    const firstEcheance = echeancesForLocataire(locataireId)[0];
    setCreateDraft((d) => ({
      ...d,
      locataire_id: locataireId,
      echeance_id: firstEcheance ? String(firstEcheance.id) : "",
    }));
  }

  function closeCreate() {
    if (createBusy) return;
    setCreateOpen(false);
  }

  async function handleSubmitCreate(e) {
    e.preventDefault();
    setCreateBusy(true);
    setCreateBanner(null);
    try {
      const echeanceId = Number(createDraft.echeance_id);
      const echeance = echeances.find((ec) => ec.id === echeanceId);
      const created = await createPaiement({
        echeanceId,
        montant: createDraft.montant,
        modePaiement: Number(createDraft.mode_paiement),
      });
      setPaiements((prev) => [...prev, { ...created, echeance }]);

      if (echeance && echeance.montant_du !== null && echeance.montant_du !== undefined) {
        const paidTotal = paidSoFar(echeanceId) + Number(createDraft.montant || 0);
        const newStatus =
          paidTotal >= Number(echeance.montant_du)
            ? ECHEANCE_STATUS.PAYE
            : paidTotal > 0
              ? ECHEANCE_STATUS.PARTIEL
              : ECHEANCE_STATUS.IMPAYE;
        if (newStatus !== echeance.statut) {
          const updatedEcheance = await updateEcheance(echeanceId, { statut: newStatus });
          setEcheances((prev) => prev.map((ec) => (ec.id === updatedEcheance.id ? { ...ec, ...updatedEcheance } : ec)));
        }
      }

      setCreateOpen(false);
    } catch (err) {
      setCreateBanner({ type: "error", message: extractErrorMessage(err) });
    } finally {
      setCreateBusy(false);
    }
  }

  function openEdit(paiement) {
    setEditTarget(paiement);
    setEditDraft({
      montant: paiement.montant ?? "",
      mode_paiement: String(paiement.mode_paiement || MODE_PAIEMENT.VIREMENT),
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
      const updated = await updatePaiement(editTarget.id, {
        montant: editDraft.montant === "" ? null : Number(editDraft.montant),
        mode_paiement: Number(editDraft.mode_paiement),
      });
      setPaiements((prev) => prev.map((p) => (p.id === updated.id ? { ...p, ...updated } : p)));
      await reconcileEcheance(editTarget.echeance_id, editTarget.id, editDraft.montant);
      setEditTarget(null);
      setEditDraft(null);
    } catch (err) {
      setEditBanner({ type: "error", message: extractErrorMessage(err) });
    } finally {
      setEditBusy(false);
    }
  }

  async function handleDownload(quittanceId) {
    setDownloadingId(quittanceId);
    setListBanner(null);
    try {
      await downloadQuittance(quittanceId);
    } catch (err) {
      setListBanner({ type: "error", message: extractErrorMessage(err) });
    } finally {
      setDownloadingId(null);
    }
  }

  async function handleConfirmCancel() {
    if (!cancelTarget) return;
    setCancelBusy(true);
    setCancelError(null);
    try {
      const updated = await annulerPaiement(cancelTarget.id);
      setPaiements((prev) => prev.map((p) => (p.id === updated.id ? { ...p, ...updated } : p)));
      // Un paiement annulé ne doit plus compter pour l'échéance : son statut
      // (payée/partielle/impayée) est recalculé comme si ce paiement n'existait plus.
      await reconcileEcheance(cancelTarget.echeance_id, cancelTarget.id, 0);
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
      <Banner banner={listBanner} />

      {/* ---- Stats ---- */}
      <div className={styles.section}>
        <div className={styles.statsGrid}>
          <StatCard icon="bi-receipt" tone="primary" label="Paiements" value={stats.count} />
          <StatCard icon="bi-cash-stack" tone="accent" label="Total encaissé" value={formatCurrency(stats.total)} />
          <StatCard icon="bi-calendar-check-fill" tone="primary" label="Encaissé ce mois" value={formatCurrency(stats.moisCourant)} />
          <StatCard icon="bi-graph-up-arrow" tone="accent" label="Moyenne / paiement" value={formatCurrency(stats.moyenne)} />
        </div>
      </div>

      {/* ---- Table ---- */}
      <div className={styles.section} style={{ marginBottom: 0 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem" }}>
          <div>
            <h2 className={styles.sectionTitle}>
              <i className="bi bi-table" style={{ marginRight: "0.5rem", color: "var(--primary)" }} />
              Paiements
            </h2>
            <p className={styles.sectionSubtitle}>
              {filteredPaiements.length} paiement(s) affiché(s) sur {paiements.length}, tous propriétaires confondus.
            </p>
          </div>
          <button
            type="button"
            className={styles.btn}
            onClick={openCreate}
            disabled={locatairesWithEcheances.length === 0}
            title={locatairesWithEcheances.length === 0 ? "Aucun locataire avec une échéance à régler" : undefined}
          >
            <i className="bi bi-plus-lg" />
            Enregistrer un paiement
          </button>
        </div>

        {locatairesWithEcheances.length === 0 && (
          <p className={styles.empty}>Aucun locataire avec une échéance à régler pour le moment.</p>
        )}

        <div className={styles.filtersRow}>
          <input
            type="text"
            placeholder="Rechercher (locataire, bien, montant, date...)"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCurrentPage(1);
            }}
          />
          <select
            value={modeFilter}
            onChange={(e) => {
              setModeFilter(e.target.value);
              setCurrentPage(1);
            }}
          >
            <option value="">Tous les modes</option>
            {MODE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
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
                <th>Échéance</th>
                <th>Montant</th>
                <th>Mode</th>
                <th>Date de paiement</th>
                <th>Statut</th>
                <th>PDF</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredPaiements.length === 0 && (
                <tr>
                  <td colSpan={9} className={styles.empty}>
                    Aucun paiement ne correspond à ces critères.
                  </td>
                </tr>
              )}
              {paginatedPaiements.map((p) => (
                <tr key={p.id}>
                  <td>
                    {p.echeance?.bail?.locataire ? (
                      <div>
                        <div className={styles.userName}>
                          {p.echeance.bail.locataire.prenom} {p.echeance.bail.locataire.nom}
                        </div>
                        <div className={styles.recentEmail}>{p.echeance.bail.locataire.email}</div>
                      </div>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td>{bienLotLabel(p.echeance)}</td>
                  <td>{formatDate(p.echeance?.date_echeance)}</td>
                  <td>{formatCurrency(p.montant)}</td>
                  <td>{MODE_PAIEMENT_LABELS[p.mode_paiement] || "—"}</td>
                  <td>{formatDate(p.date_paiement)}</td>
                  <td>
                    <span className={`${styles.badge} ${p.statut === PAIEMENT_STATUS.ANNULE ? styles.badgeDanger : styles.badgeActive}`}>
                      {PAIEMENT_STATUS_LABELS[p.statut] || "—"}
                    </span>
                  </td>
                  <td>
                    {p.quittance ? (
                      <button
                        type="button"
                        className={styles.btnOutline}
                        onClick={() => handleDownload(p.quittance.id)}
                        disabled={downloadingId === p.quittance.id}
                      >
                        <i className="bi bi-download" />
                        {downloadingId === p.quittance.id ? "..." : "PDF"}
                      </button>
                    ) : (
                      <span className={styles.empty}>—</span>
                    )}
                  </td>
                  <td>
                    {(() => {
                      if (p.statut === PAIEMENT_STATUS.ANNULE) return <span className={styles.empty}>—</span>;
                      const bienId = p.echeance?.bail?.lot?.bien_id;
                      const bien = biens.find((b) => b.id === bienId);
                      const proprietaireId = bien?.proprietaire_id;
                      const canUpdate = permIndex?.hasForBien(bienId, proprietaireId, "UPDATE_PAYMENT");
                      if (!canUpdate) return <span className={styles.empty}>—</span>;
                      return (
                        <div className={styles.tableActions}>
                          <button type="button" className={styles.iconBtn} onClick={() => openEdit(p)} title="Modifier">
                            <i className="bi bi-pencil" />
                          </button>
                          <button
                            type="button"
                            className={`${styles.iconBtn} ${styles.iconBtnDanger}`}
                            onClick={() => {
                              setCancelTarget(p);
                              setCancelError(null);
                            }}
                            title="Annuler ce paiement"
                          >
                            <i className="bi bi-x-circle" />
                          </button>
                        </div>
                      );
                    })()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredPaiements.length > 0 && (
            <div className={styles.paginationRow}>
              <span>
                Page {safePage} / {totalPages} · {filteredPaiements.length} paiement(s)
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

      {/* ---- Enregistrer un paiement ---- */}
      <Modal isOpen={createOpen} onClose={closeCreate} title="Enregistrer un paiement">
        <form onSubmit={handleSubmitCreate}>
          <Banner banner={createBanner} />
          <SelectField
            label="Locataire"
            name="locataire_id"
            options={locatairesWithEcheances.map((l) => ({ value: l.id, label: `${l.prenom} ${l.nom} (${l.email})` }))}
            value={createDraft.locataire_id}
            onChange={(e) => handleLocataireChange(e.target.value)}
            hint="Enregistrez un paiement pour le compte du locataire, pour les biens que vous gérez."
            required
          />
          {createEcheanceOptions.length === 0 ? (
            <p className={styles.empty}>Ce locataire n&apos;a aucune échéance à régler.</p>
          ) : (
            <SelectField
              label="Échéance"
              name="echeance_id"
              options={createEcheanceOptions.map((e) => ({ value: e.id, label: echeanceOptionLabel(e) }))}
              value={createDraft.echeance_id}
              onChange={(e) => setCreateDraft((d) => ({ ...d, echeance_id: e.target.value }))}
              required
            />
          )}
          <TextField
            label="Montant (MAD)"
            name="montant"
            type="number"
            step="0.01"
            min="0"
            value={createDraft.montant}
            onChange={(e) => setCreateDraft((d) => ({ ...d, montant: e.target.value }))}
            required
          />
          <SelectField
            label="Mode de paiement"
            name="mode_paiement"
            options={MODE_OPTIONS}
            value={createDraft.mode_paiement}
            onChange={(e) => setCreateDraft((d) => ({ ...d, mode_paiement: e.target.value }))}
          />
          <p className={styles.sectionSubtitle} style={{ marginTop: "0.5rem" }}>
            <i className="bi bi-info-circle" /> Le statut de l&apos;échéance sera mis à jour automatiquement
            (payée/partielle) selon le montant total encaissé.
          </p>

          <div className={styles.editActions} style={{ marginTop: "1.2rem" }}>
            <button type="submit" className={styles.btn} disabled={createBusy}>
              <i className="bi bi-check-lg" />
              {createBusy ? "Enregistrement..." : "Enregistrer"}
            </button>
            <button type="button" className={styles.btnOutline} onClick={closeCreate} disabled={createBusy}>
              <i className="bi bi-x-lg" />
              Annuler
            </button>
          </div>
        </form>
      </Modal>

      {/* ---- Modifier un paiement ---- */}
      <Modal isOpen={!!editTarget} onClose={closeEdit} title="Modifier le paiement">
        {editTarget && editDraft && (
          <form onSubmit={handleSubmitEdit}>
            <Banner banner={editBanner} />
            <p className={styles.sectionSubtitle} style={{ marginBottom: "1rem" }}>
              {bienLotLabel(editTarget.echeance)} · {editTarget.echeance?.bail?.locataire?.prenom}{" "}
              {editTarget.echeance?.bail?.locataire?.nom}
            </p>
            <TextField
              label="Montant (MAD)"
              name="montant"
              type="number"
              step="0.01"
              min="0"
              value={editDraft.montant}
              onChange={(e) => setEditDraft((d) => ({ ...d, montant: e.target.value }))}
              required
            />
            <SelectField
              label="Mode de paiement"
              name="mode_paiement"
              options={MODE_OPTIONS}
              value={editDraft.mode_paiement}
              onChange={(e) => setEditDraft((d) => ({ ...d, mode_paiement: e.target.value }))}
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
        isOpen={!!cancelTarget}
        onClose={() => {
          setCancelTarget(null);
          setCancelError(null);
        }}
        onConfirm={handleConfirmCancel}
        title="Annuler le paiement"
        message={
          cancelTarget
            ? `Annuler ce paiement de ${formatCurrency(cancelTarget.montant)}, lié à l'échéance du ${formatDate(cancelTarget.echeance?.date_echeance)} pour ${bienLotLabel(cancelTarget.echeance)} ? Le statut de cette échéance sera recalculé et la quittance associée sera aussi annulée. Le paiement reste visible dans l'historique avec le statut "Annulé".`
            : ""
        }
        confirmLabel="Annuler le paiement"
        danger
        isBusy={cancelBusy}
        error={cancelError}
      />
    </div>
  );
}
