"use client";

import { useEffect, useMemo, useState } from "react";
import { extractErrorMessage } from "@/lib/apiClient";
import {
  fetchBiens,
  fetchLots,
  createLot,
  updateLot,
  deleteLot,
  LOT_STATUS,
  LOT_STATUS_LABELS,
} from "@/lib/properties";
import StatCard from "@/components/StatCard";
import Modal from "@/components/Modal";
import ConfirmationDialog from "@/components/ConfirmationDialog";
import TextField from "@/components/TextField";
import SelectField from "@/components/SelectField";
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
  if (statut === LOT_STATUS.LIBRE) return styles.badgeActive;
  if (statut === LOT_STATUS.OCCUPE) return styles.badgeNeutral;
  return styles.badgeWarning;
}

function formatCurrency(value) {
  if (value === null || value === undefined || value === "") return "—";
  return `${Number(value).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} MAD`;
}

const STATUS_OPTIONS = Object.entries(LOT_STATUS_LABELS).map(([value, label]) => ({ value, label }));
const PAGE_SIZE = 10;

const EMPTY_FORM = { bien_id: "", reference: "", loyer_reference: "", statut: String(LOT_STATUS.LIBRE) };

export default function ProprietaireLotsPage() {
  const [lots, setLots] = useState([]);
  const [biens, setBiens] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const [search, setSearch] = useState("");
  const [bienFilter, setBienFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState("create");
  const [formTargetId, setFormTargetId] = useState(null);
  const [formDraft, setFormDraft] = useState(EMPTY_FORM);
  const [formBusy, setFormBusy] = useState(false);
  const [formBanner, setFormBanner] = useState(null);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  useEffect(() => {
    async function init() {
      setIsLoading(true);
      try {
        const [lotsList, biensList] = await Promise.all([fetchLots(), fetchBiens()]);
        setLots(lotsList);
        setBiens(biensList);
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
      total: lots.length,
      libres: lots.filter((l) => l.statut === LOT_STATUS.LIBRE).length,
      occupes: lots.filter((l) => l.statut === LOT_STATUS.OCCUPE).length,
      reserves: lots.filter((l) => l.statut === LOT_STATUS.RESERVE).length,
    };
  }, [lots]);

  const filteredLots = useMemo(() => {
    const term = search.trim().toLowerCase();
    return lots.filter((l) => {
      if (term && !(l.reference || "").toLowerCase().includes(term)) return false;
      if (bienFilter && String(l.bien_id) !== bienFilter) return false;
      if (statusFilter && String(l.statut) !== statusFilter) return false;
      return true;
    });
  }, [lots, search, bienFilter, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredLots.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedLots = filteredLots.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  function bienName(bienId) {
    const bien = biens.find((b) => b.id === bienId);
    return bien ? bien.designation || `Bien #${bien.id}` : "—";
  }

  function openCreate() {
    setFormMode("create");
    setFormTargetId(null);
    setFormDraft({ ...EMPTY_FORM, bien_id: biens[0] ? String(biens[0].id) : "" });
    setFormBanner(null);
    setFormOpen(true);
  }

  function openEdit(lot) {
    setFormMode("edit");
    setFormTargetId(lot.id);
    setFormDraft({
      bien_id: String(lot.bien_id),
      reference: lot.reference || "",
      loyer_reference: lot.loyer_reference ?? "",
      statut: String(lot.statut),
    });
    setFormBanner(null);
    setFormOpen(true);
  }

  function closeForm() {
    if (formBusy) return;
    setFormOpen(false);
  }

  async function handleSubmitForm(e) {
    e.preventDefault();
    setFormBusy(true);
    setFormBanner(null);
    try {
      if (formMode === "create") {
        const created = await createLot({
          bienId: Number(formDraft.bien_id),
          reference: formDraft.reference,
          loyerReference: formDraft.loyer_reference === "" ? null : Number(formDraft.loyer_reference),
          statut: Number(formDraft.statut),
        });
        setLots((prev) => [...prev, created]);
      } else {
        const updated = await updateLot(formTargetId, {
          bien_id: Number(formDraft.bien_id),
          reference: formDraft.reference,
          loyer_reference: formDraft.loyer_reference === "" ? null : Number(formDraft.loyer_reference),
          statut: Number(formDraft.statut),
        });
        setLots((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
      }
      setFormOpen(false);
    } catch (err) {
      setFormBanner({ type: "error", message: extractErrorMessage(err) });
    } finally {
      setFormBusy(false);
    }
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      await deleteLot(deleteTarget.id);
      setLots((prev) => prev.filter((l) => l.id !== deleteTarget.id));
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
          <StatCard icon="bi-grid-3x3-gap-fill" tone="primary" label="Lots" value={stats.total} />
          <StatCard icon="bi-check-circle-fill" tone="accent" label="Libres" value={stats.libres} />
          <StatCard icon="bi-key-fill" tone="primary" label="Occupés" value={stats.occupes} />
          <StatCard icon="bi-bookmark-star-fill" tone="warning" label="Réservés" value={stats.reserves} />
        </div>
      </div>

      {/* ---- Table ---- */}
      <div className={styles.section} style={{ marginBottom: 0 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem" }}>
          <div>
            <h2 className={styles.sectionTitle}>
              <i className="bi bi-table" style={{ marginRight: "0.5rem", color: "var(--primary)" }} />
              Mes lots
            </h2>
            <p className={styles.sectionSubtitle}>
              {filteredLots.length} lot(s) affiché(s) sur {lots.length}.
            </p>
          </div>
          <button
            type="button"
            className={styles.btn}
            onClick={openCreate}
            disabled={biens.length === 0}
            title={biens.length === 0 ? "Ajoutez d'abord un bien" : undefined}
          >
            <i className="bi bi-plus-lg" />
            Nouveau lot
          </button>
        </div>

        {biens.length === 0 && (
          <p className={styles.empty}>Vous devez d&apos;abord créer un bien avant de pouvoir ajouter des lots.</p>
        )}

        <div className={styles.filtersRow}>
          <input
            type="text"
            placeholder="Rechercher par référence..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCurrentPage(1);
            }}
          />
          <select
            value={bienFilter}
            onChange={(e) => {
              setBienFilter(e.target.value);
              setCurrentPage(1);
            }}
          >
            <option value="">Tous les biens</option>
            {biens.map((b) => (
              <option key={b.id} value={b.id}>
                {b.designation || `Bien #${b.id}`}
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
                <th>Référence</th>
                <th>Bien</th>
                <th>Loyer de référence</th>
                <th>Statut</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredLots.length === 0 && (
                <tr>
                  <td colSpan={5} className={styles.empty}>
                    Aucun lot ne correspond à ces critères.
                  </td>
                </tr>
              )}
              {paginatedLots.map((l) => (
                <tr key={l.id}>
                  <td>
                    <span className={styles.userName}>{l.reference || `Lot #${l.id}`}</span>
                  </td>
                  <td>{bienName(l.bien_id)}</td>
                  <td>{formatCurrency(l.loyer_reference)}</td>
                  <td>
                    <span className={`${styles.badge} ${badgeClass(l.statut)}`}>
                      {LOT_STATUS_LABELS[l.statut] || "—"}
                    </span>
                  </td>
                  <td>
                    <div className={styles.tableActions}>
                      <button type="button" className={styles.iconBtn} onClick={() => openEdit(l)} title="Modifier">
                        <i className="bi bi-pencil" />
                      </button>
                      <button
                        type="button"
                        className={`${styles.iconBtn} ${styles.iconBtnDanger}`}
                        onClick={() => {
                          setDeleteTarget(l);
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

          {filteredLots.length > 0 && (
            <div className={styles.paginationRow}>
              <span>
                Page {safePage} / {totalPages} · {filteredLots.length} lot(s)
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

      {/* ---- Créer / modifier un lot ---- */}
      <Modal isOpen={formOpen} onClose={closeForm} title={formMode === "create" ? "Nouveau lot" : "Modifier le lot"}>
        <form onSubmit={handleSubmitForm}>
          <Banner banner={formBanner} />
          <SelectField
            label="Bien"
            name="bien_id"
            options={biens.map((b) => ({ value: b.id, label: b.designation || `Bien #${b.id}` }))}
            value={formDraft.bien_id}
            onChange={(e) => setFormDraft((d) => ({ ...d, bien_id: e.target.value }))}
            required
          />
          <TextField
            label="Référence"
            name="reference"
            value={formDraft.reference}
            onChange={(e) => setFormDraft((d) => ({ ...d, reference: e.target.value }))}
            placeholder="Ex : Apt 3B, Lot 12..."
          />
          <TextField
            label="Loyer de référence (MAD)"
            name="loyer_reference"
            type="number"
            step="0.01"
            min="0"
            value={formDraft.loyer_reference}
            onChange={(e) => setFormDraft((d) => ({ ...d, loyer_reference: e.target.value }))}
          />
          <SelectField
            label="Statut"
            name="statut"
            options={STATUS_OPTIONS}
            value={formDraft.statut}
            onChange={(e) => setFormDraft((d) => ({ ...d, statut: e.target.value }))}
          />

          <div className={styles.editActions} style={{ marginTop: "1.2rem" }}>
            <button type="submit" className={styles.btn} disabled={formBusy}>
              <i className="bi bi-check-lg" />
              {formBusy ? "Enregistrement..." : "Enregistrer"}
            </button>
            <button type="button" className={styles.btnOutline} onClick={closeForm} disabled={formBusy}>
              <i className="bi bi-x-lg" />
              Annuler
            </button>
          </div>
        </form>
      </Modal>

      {/* ---- Confirmation de suppression ---- */}
      <ConfirmationDialog
        isOpen={!!deleteTarget}
        onClose={() => {
          setDeleteTarget(null);
          setDeleteError(null);
        }}
        onConfirm={handleConfirmDelete}
        title="Supprimer le lot"
        message={
          deleteTarget
            ? `Masquer "${deleteTarget.reference || `Lot #${deleteTarget.id}`}" ? Il n'apparaîtra plus dans vos listes, mais ses baux sont conservés (non supprimés). Impossible s'il a un bail actif.`
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
