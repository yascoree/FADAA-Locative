"use client";

import { useEffect, useMemo, useState } from "react";
import { extractErrorMessage } from "@/lib/apiClient";
import {
  fetchBiens,
  fetchLots,
  fetchBaux,
  createBail,
  updateBail,
  deleteBail,
  BAIL_STATUS,
  BAIL_STATUS_LABELS,
  FREQUENCE_PAIEMENT,
  FREQUENCE_PAIEMENT_LABELS,
} from "@/lib/properties";
import { fetchLocataires } from "@/lib/tenants";
import StatCard from "@/components/StatCard";
import Modal from "@/components/Modal";
import ConfirmationDialog from "@/components/ConfirmationDialog";
import TextField from "@/components/TextField";
import SelectField from "@/components/SelectField";
import RadioGroupField from "@/components/RadioGroupField";
import styles from "../proprietaire.module.css";

function Banner({ banner }) {
  if (!banner) return null;
  return (
    <div className={`${styles.banner} ${banner.type === "success" ? styles.bannerSuccess : styles.bannerError}`}>
      {banner.message}
    </div>
  );
}

function badgeClass(statut) {
  if (statut === BAIL_STATUS.ACTIF) return styles.badgeActive;
  if (statut === BAIL_STATUS.EN_ATTENTE) return styles.badgeWarning;
  if (statut === BAIL_STATUS.RESILIE) return styles.badgeDanger;
  return styles.badgeNeutral;
}

function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

function formatCurrency(value) {
  if (value === null || value === undefined || value === "") return "—";
  return `${Number(value).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} MAD`;
}

const STATUS_OPTIONS = Object.entries(BAIL_STATUS_LABELS).map(([value, label]) => ({ value, label }));
const FREQUENCE_OPTIONS = Object.entries(FREQUENCE_PAIEMENT_LABELS).map(([value, label]) => ({ value, label }));
const PAGE_SIZE = 10;

const EMPTY_CREATE_FORM = {
  lot_id: "",
  locataire_id: "",
  date_debut: "",
  date_fin: "",
  loyer: "",
  charges: "",
  depot: "",
  statut: String(BAIL_STATUS.EN_ATTENTE),
  frequence_paiement: String(FREQUENCE_PAIEMENT.MOIS),
};

export default function ProprietaireBauxPage() {
  const [baux, setBaux] = useState([]);
  const [lots, setLots] = useState([]);
  const [biens, setBiens] = useState([]);
  const [locataires, setLocataires] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const [search, setSearch] = useState("");
  const [lotFilter, setLotFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const [createOpen, setCreateOpen] = useState(false);
  const [createDraft, setCreateDraft] = useState(EMPTY_CREATE_FORM);
  const [createBusy, setCreateBusy] = useState(false);
  const [createBanner, setCreateBanner] = useState(null);

  const [editTarget, setEditTarget] = useState(null);
  const [editDraft, setEditDraft] = useState(null);
  const [editBusy, setEditBusy] = useState(false);
  const [editBanner, setEditBanner] = useState(null);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  useEffect(() => {
    async function init() {
      setIsLoading(true);
      try {
        const [bauxList, lotsList, biensList, locatairesList] = await Promise.all([
          fetchBaux(),
          fetchLots(),
          fetchBiens(),
          fetchLocataires(),
        ]);
        setBaux(bauxList);
        setLots(lotsList);
        setBiens(biensList);
        setLocataires(locatairesList);
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
      total: baux.length,
      actifs: baux.filter((b) => b.statut === BAIL_STATUS.ACTIF).length,
      enAttente: baux.filter((b) => b.statut === BAIL_STATUS.EN_ATTENTE).length,
      termines: baux.filter((b) => b.statut === BAIL_STATUS.RESILIE || b.statut === BAIL_STATUS.EXPIRE).length,
    };
  }, [baux]);

  function lotLabel(lot) {
    if (!lot) return "—";
    const bien = biens.find((b) => b.id === lot.bien_id);
    const bienName = bien?.designation || `Bien #${lot.bien_id}`;
    return `${bienName} — ${lot.reference || `Lot #${lot.id}`}`;
  }

  const filteredBaux = useMemo(() => {
    const term = search.trim().toLowerCase();
    return baux.filter((b) => {
      if (term) {
        const bien = biens.find((bi) => bi.id === b.lot?.bien_id);
        const haystack = [
          b.locataire?.prenom,
          b.locataire?.nom,
          b.locataire?.email,
          bien?.designation,
          b.lot?.reference,
          b.loyer,
          b.charges,
          b.depot,
          formatDate(b.date_debut),
          formatDate(b.date_fin),
          BAIL_STATUS_LABELS[b.statut],
        ]
          .filter((v) => v !== null && v !== undefined && v !== "")
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      if (lotFilter && String(b.lot_id) !== lotFilter) return false;
      if (statusFilter && String(b.statut) !== statusFilter) return false;
      return true;
    });
  }, [baux, search, lotFilter, statusFilter, biens]);

  const totalPages = Math.max(1, Math.ceil(filteredBaux.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedBaux = filteredBaux.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  function openCreate() {
    setCreateDraft({
      ...EMPTY_CREATE_FORM,
      lot_id: lots[0] ? String(lots[0].id) : "",
      locataire_id: locataires[0] ? String(locataires[0].id) : "",
    });
    setCreateBanner(null);
    setCreateOpen(true);
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
      const locataire = locataires.find((l) => l.id === Number(createDraft.locataire_id));
      const created = await createBail({
        lotId: Number(createDraft.lot_id),
        locataireId: Number(createDraft.locataire_id),
        dateDebut: createDraft.date_debut || null,
        dateFin: createDraft.date_fin || null,
        loyer: createDraft.loyer === "" ? null : Number(createDraft.loyer),
        charges: createDraft.charges === "" ? null : Number(createDraft.charges),
        depot: createDraft.depot === "" ? null : Number(createDraft.depot),
        statut: Number(createDraft.statut),
        frequencePaiement: Number(createDraft.frequence_paiement),
      });
      const lot = lots.find((l) => l.id === created.lot_id);
      setBaux((prev) => [...prev, { ...created, locataire, lot }]);
      setCreateOpen(false);
    } catch (err) {
      setCreateBanner({ type: "error", message: err.message || extractErrorMessage(err) });
    } finally {
      setCreateBusy(false);
    }
  }

  function openEdit(bail) {
    setEditTarget(bail);
    setEditDraft({
      date_fin: bail.date_fin || "",
      loyer: bail.loyer ?? "",
      charges: bail.charges ?? "",
      depot: bail.depot ?? "",
      statut: String(bail.statut),
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
      const updated = await updateBail(editTarget.id, {
        date_fin: editDraft.date_fin || null,
        loyer: editDraft.loyer === "" ? null : Number(editDraft.loyer),
        charges: editDraft.charges === "" ? null : Number(editDraft.charges),
        depot: editDraft.depot === "" ? null : Number(editDraft.depot),
        statut: Number(editDraft.statut),
      });
      setBaux((prev) => prev.map((b) => (b.id === updated.id ? { ...b, ...updated } : b)));
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
      await deleteBail(deleteTarget.id);
      setBaux((prev) => prev.filter((b) => b.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err) {
      setDeleteError(extractErrorMessage(err));
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
          <StatCard icon="bi-file-earmark-text-fill" tone="primary" label="Baux" value={stats.total} />
          <StatCard icon="bi-check-circle-fill" tone="accent" label="Actifs" value={stats.actifs} />
          <StatCard icon="bi-hourglass-split" tone="warning" label="En attente" value={stats.enAttente} />
          <StatCard icon="bi-x-circle-fill" tone="danger" label="Terminés" value={stats.termines} />
        </div>
      </div>

      {/* ---- Table ---- */}
      <div className={styles.section} style={{ marginBottom: 0 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem" }}>
          <div>
            <h2 className={styles.sectionTitle}>
              <i className="bi bi-table" style={{ marginRight: "0.5rem", color: "var(--primary)" }} />
              Mes baux
            </h2>
            <p className={styles.sectionSubtitle}>
              {filteredBaux.length} bail(aux) affiché(s) sur {baux.length}.
            </p>
          </div>
          <button
            type="button"
            className={styles.btn}
            onClick={openCreate}
            disabled={lots.length === 0 || locataires.length === 0}
            title={
              lots.length === 0
                ? "Ajoutez d'abord un lot"
                : locataires.length === 0
                  ? "Créez d'abord un locataire depuis la page Locataires"
                  : undefined
            }
          >
            <i className="bi bi-plus-lg" />
            Nouveau bail
          </button>
        </div>

        {lots.length === 0 && (
          <p className={styles.empty}>Vous devez d&apos;abord créer un lot avant de pouvoir ajouter un bail.</p>
        )}
        {lots.length > 0 && locataires.length === 0 && (
          <p className={styles.empty}>
            Aucun locataire disponible. Créez-en un depuis la page Locataires avant d&apos;ajouter un bail.
          </p>
        )}

        <div className={styles.filtersRow}>
          <input
            type="text"
            placeholder="Rechercher (locataire, bien, lot, loyer, date...)"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCurrentPage(1);
            }}
          />
          <select
            value={lotFilter}
            onChange={(e) => {
              setLotFilter(e.target.value);
              setCurrentPage(1);
            }}
          >
            <option value="">Tous les lots</option>
            {lots.map((l) => (
              <option key={l.id} value={l.id}>
                {lotLabel(l)}
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
        </div>

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Lot</th>
                <th>Locataire</th>
                <th>Loyer</th>
                <th>Période</th>
                <th>Statut</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredBaux.length === 0 && (
                <tr>
                  <td colSpan={6} className={styles.empty}>
                    Aucun bail ne correspond à ces critères.
                  </td>
                </tr>
              )}
              {paginatedBaux.map((b) => (
                <tr key={b.id}>
                  <td>{lotLabel(b.lot)}</td>
                  <td>
                    {b.locataire ? (
                      <div className={styles.bienCell}>
                        <span className={styles.thumbPlaceholder}>
                          <i className="bi bi-person" />
                        </span>
                        <div>
                          <div className={styles.userName}>
                            {b.locataire.prenom} {b.locataire.nom}
                          </div>
                          <div className={styles.recentEmail}>{b.locataire.email}</div>
                        </div>
                      </div>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td>
                    {formatCurrency(b.loyer)}
                    {b.charges ? ` + ${formatCurrency(b.charges)} charges` : ""}
                    <div className={styles.recentEmail}>/ {FREQUENCE_PAIEMENT_LABELS[b.frequence_paiement] || "—"}</div>
                  </td>
                  <td>
                    {formatDate(b.date_debut)} → {formatDate(b.date_fin)}
                  </td>
                  <td>
                    <span className={`${styles.badge} ${badgeClass(b.statut)}`}>
                      {BAIL_STATUS_LABELS[b.statut] || "—"}
                    </span>
                  </td>
                  <td>
                    <div className={styles.tableActions}>
                      <button type="button" className={styles.iconBtn} onClick={() => openEdit(b)} title="Modifier">
                        <i className="bi bi-pencil" />
                      </button>
                      <button
                        type="button"
                        className={`${styles.iconBtn} ${styles.iconBtnDanger}`}
                        onClick={() => {
                          setDeleteTarget(b);
                          setDeleteError(null);
                        }}
                        title="Supprimer"
                      >
                        <i className="bi bi-trash" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredBaux.length > 0 && (
            <div className={styles.paginationRow}>
              <span>
                Page {safePage} / {totalPages} · {filteredBaux.length} bail(aux)
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

      {/* ---- Créer un bail ---- */}
      <Modal isOpen={createOpen} onClose={closeCreate} title="Nouveau bail">
        <form onSubmit={handleSubmitCreate}>
          <Banner banner={createBanner} />
          <SelectField
            label="Lot"
            name="lot_id"
            options={lots.map((l) => ({ value: l.id, label: lotLabel(l) }))}
            value={createDraft.lot_id}
            onChange={(e) => setCreateDraft((d) => ({ ...d, lot_id: e.target.value }))}
            required
          />
          <SelectField
            label="Locataire"
            name="locataire_id"
            options={locataires.map((l) => ({ value: l.id, label: `${l.prenom} ${l.nom} (${l.email})` }))}
            value={createDraft.locataire_id}
            onChange={(e) => setCreateDraft((d) => ({ ...d, locataire_id: e.target.value }))}
            hint="N'apparaît pas dans la liste ? Créez-le d'abord depuis la page Locataires."
            required
          />
          <TextField
            label="Date de début"
            name="date_debut"
            type="date"
            value={createDraft.date_debut}
            onChange={(e) => setCreateDraft((d) => ({ ...d, date_debut: e.target.value }))}
          />
          <TextField
            label="Date de fin"
            name="date_fin"
            type="date"
            value={createDraft.date_fin}
            onChange={(e) => setCreateDraft((d) => ({ ...d, date_fin: e.target.value }))}
          />
          <TextField
            label="Loyer (MAD)"
            name="loyer"
            type="number"
            step="0.01"
            min="0"
            value={createDraft.loyer}
            onChange={(e) => setCreateDraft((d) => ({ ...d, loyer: e.target.value }))}
          />
          <TextField
            label="Charges (MAD)"
            name="charges"
            type="number"
            step="0.01"
            min="0"
            value={createDraft.charges}
            onChange={(e) => setCreateDraft((d) => ({ ...d, charges: e.target.value }))}
          />
          <TextField
            label="Dépôt de garantie (MAD)"
            name="depot"
            type="number"
            step="0.01"
            min="0"
            value={createDraft.depot}
            onChange={(e) => setCreateDraft((d) => ({ ...d, depot: e.target.value }))}
          />
          <RadioGroupField
            label="Fréquence de paiement"
            name="frequence_paiement"
            options={FREQUENCE_OPTIONS}
            value={createDraft.frequence_paiement}
            onChange={(e) => setCreateDraft((d) => ({ ...d, frequence_paiement: e.target.value }))}
            hint="Détermine l'espacement des échéances générées automatiquement."
          />
          <SelectField
            label="Statut"
            name="statut"
            options={STATUS_OPTIONS}
            value={createDraft.statut}
            onChange={(e) => setCreateDraft((d) => ({ ...d, statut: e.target.value }))}
          />

          <div className={styles.editActions} style={{ marginTop: "1.2rem" }}>
            <button type="submit" className={styles.btn} disabled={createBusy}>
              <i className="bi bi-check-lg" />
              {createBusy ? "Création..." : "Créer le bail"}
            </button>
            <button type="button" className={styles.btnOutline} onClick={closeCreate} disabled={createBusy}>
              <i className="bi bi-x-lg" />
              Annuler
            </button>
          </div>
        </form>
      </Modal>

      {/* ---- Modifier un bail ---- */}
      <Modal isOpen={!!editTarget} onClose={closeEdit} title="Modifier le bail">
        {editTarget && editDraft && (
          <form onSubmit={handleSubmitEdit}>
            <Banner banner={editBanner} />
            <p className={styles.sectionSubtitle} style={{ marginBottom: "1rem" }}>
              {lotLabel(editTarget.lot)} · {editTarget.locataire?.prenom} {editTarget.locataire?.nom}
            </p>
            <TextField
              label="Date de fin"
              name="date_fin"
              type="date"
              value={editDraft.date_fin}
              onChange={(e) => setEditDraft((d) => ({ ...d, date_fin: e.target.value }))}
            />
            <TextField
              label="Loyer (MAD)"
              name="loyer"
              type="number"
              step="0.01"
              min="0"
              value={editDraft.loyer}
              onChange={(e) => setEditDraft((d) => ({ ...d, loyer: e.target.value }))}
            />
            <TextField
              label="Charges (MAD)"
              name="charges"
              type="number"
              step="0.01"
              min="0"
              value={editDraft.charges}
              onChange={(e) => setEditDraft((d) => ({ ...d, charges: e.target.value }))}
            />
            <TextField
              label="Dépôt de garantie (MAD)"
              name="depot"
              type="number"
              step="0.01"
              min="0"
              value={editDraft.depot}
              onChange={(e) => setEditDraft((d) => ({ ...d, depot: e.target.value }))}
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

      {/* ---- Confirmation de suppression ---- */}
      <ConfirmationDialog
        isOpen={!!deleteTarget}
        onClose={() => {
          setDeleteTarget(null);
          setDeleteError(null);
        }}
        onConfirm={handleConfirmDelete}
        title="Supprimer le bail"
        message={
          deleteTarget
            ? `Masquer ce bail (${deleteTarget.locataire?.prenom || ""} ${deleteTarget.locataire?.nom || ""}) ? Ses échéances, paiements et quittances sont conservés (non supprimés). Impossible tant que le bail est actif : terminez-le ou résiliez-le d'abord.`
            : ""
        }
        confirmLabel="Supprimer"
        danger
        isBusy={deleteBusy}
        error={deleteError}
      />
    </div>
  );
}
