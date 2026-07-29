"use client";

import { useEffect, useMemo, useState } from "react";
import { extractErrorMessage, API_BASE_URL } from "@/lib/apiClient";
import {
  fetchBiens,
  createBien,
  updateBien,
  deleteBien,
  uploadBienPhoto,
  deleteBienPhoto,
  BIEN_STATUS,
  BIEN_STATUS_LABELS,
  TYPE_BIEN,
  TYPE_BIEN_LABELS,
} from "@/lib/properties";
import { fetchMandates, fetchGestionnairePermissionIndex, MANDAT_STATUS } from "@/lib/mandates";
import { SORT_OPTIONS, sortList } from "@/lib/sort";
import StatCard from "@/components/StatCard";
import Modal from "@/components/Modal";
import ConfirmationDialog from "@/components/ConfirmationDialog";
import TextField from "@/components/TextField";
import SelectField from "@/components/SelectField";
import FilterSelect from "@/components/FilterSelect";
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
  if (statut === BIEN_STATUS.ACTIF) return styles.badgeActive;
  if (statut === BIEN_STATUS.INACTIF) return styles.badgeWarning;
  return styles.badgeDanger;
}

function photoUrl(url) {
  return `${API_BASE_URL}${url}`;
}

const STATUS_OPTIONS = Object.entries(BIEN_STATUS_LABELS).map(([value, label]) => ({ value, label }));
const TYPE_OPTIONS = Object.entries(TYPE_BIEN_LABELS).map(([value, label]) => ({ value, label }));
const PAGE_SIZE = 10;

const EMPTY_FORM = {
  proprietaire_id: "",
  designation: "",
  description: "",
  type: String(TYPE_BIEN.IMMOBILIER),
  statut: String(BIEN_STATUS.ACTIF),
};

export default function AgenceBiensPage() {
  const [biens, setBiens] = useState([]);
  const [proprietaires, setProprietaires] = useState([]);
  const [permIndex, setPermIndex] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sortBy, setSortBy] = useState("recent");
  const [currentPage, setCurrentPage] = useState(1);

  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState("create");
  const [formTargetId, setFormTargetId] = useState(null);
  const [formDraft, setFormDraft] = useState(EMPTY_FORM);
  const [formBusy, setFormBusy] = useState(false);
  const [formBanner, setFormBanner] = useState(null);

  const [editingPhotos, setEditingPhotos] = useState([]);
  const [stagedFiles, setStagedFiles] = useState([]);
  const [photoBusy, setPhotoBusy] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  useEffect(() => {
    async function init() {
      setIsLoading(true);
      try {
        const [biensList, mandatesList, permissionIndex] = await Promise.all([
          fetchBiens(),
          fetchMandates(),
          fetchGestionnairePermissionIndex(),
        ]);
        setBiens(biensList);
        const proprietairesById = new Map();
        mandatesList
          .filter((m) => m.statut === MANDAT_STATUS.ACTIF && m.proprietaire)
          .forEach((m) => proprietairesById.set(m.proprietaire.id, m.proprietaire));
        setProprietaires([...proprietairesById.values()]);
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
      total: biens.length,
      actifs: biens.filter((b) => b.statut === BIEN_STATUS.ACTIF).length,
      inactifs: biens.filter((b) => b.statut === BIEN_STATUS.INACTIF).length,
      archives: biens.filter((b) => b.statut === BIEN_STATUS.ARCHIVE).length,
    };
  }, [biens]);

  const creatableProprietaires = useMemo(() => {
    if (!permIndex) return [];
    return proprietaires.filter((p) => permIndex.hasForProprietaire(p.id, "CREATE_PROPERTY"));
  }, [proprietaires, permIndex]);

  const filteredBiens = useMemo(() => {
    const term = search.trim().toLowerCase();
    const filtered = biens.filter((b) => {
      if (term) {
        const haystack = `${b.designation || ""} ${b.description || ""} ${TYPE_BIEN_LABELS[b.type] || ""} ${proprietaireName(b.proprietaire_id)}`.toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      if (statusFilter && String(b.statut) !== statusFilter) return false;
      return true;
    });
    return sortList(filtered, sortBy, { dateOf: (b) => b.created_at, nameOf: (b) => b.designation });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [biens, search, statusFilter, sortBy, proprietaires]);

  const totalPages = Math.max(1, Math.ceil(filteredBiens.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedBiens = filteredBiens.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  function proprietaireName(proprietaireId) {
    const p = proprietaires.find((p) => p.id === proprietaireId);
    return p ? `${p.prenom} ${p.nom}` : `#${proprietaireId}`;
  }

  function openCreate() {
    setFormMode("create");
    setFormTargetId(null);
    setFormDraft({
      ...EMPTY_FORM,
      proprietaire_id: creatableProprietaires[0] ? String(creatableProprietaires[0].id) : "",
    });
    setFormBanner(null);
    setStagedFiles([]);
    setEditingPhotos([]);
    setFormOpen(true);
  }

  function openEdit(bien) {
    setFormMode("edit");
    setFormTargetId(bien.id);
    setFormDraft({
      proprietaire_id: String(bien.proprietaire_id),
      designation: bien.designation || "",
      description: bien.description || "",
      type: String(bien.type),
      statut: String(bien.statut),
    });
    setEditingPhotos(bien.photos || []);
    setStagedFiles([]);
    setFormBanner(null);
    setFormOpen(true);
  }

  function closeForm() {
    if (formBusy || photoBusy) return;
    stagedFiles.forEach((f) => URL.revokeObjectURL(f.preview));
    setFormOpen(false);
  }

  function handleStageFiles(e) {
    const files = Array.from(e.target.files || []);
    setStagedFiles((prev) => [...prev, ...files.map((file) => ({ file, preview: URL.createObjectURL(file) }))]);
    e.target.value = "";
  }

  function removeStagedFile(index) {
    setStagedFiles((prev) => {
      const copy = [...prev];
      URL.revokeObjectURL(copy[index].preview);
      copy.splice(index, 1);
      return copy;
    });
  }

  async function handleAddPhotosToExisting(e) {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (files.length === 0 || !formTargetId) return;
    setPhotoBusy(true);
    setFormBanner(null);
    try {
      const uploaded = [];
      for (const file of files) {
        // Séquentiel : évite de saturer l'API si beaucoup de photos sont sélectionnées d'un coup.
        // eslint-disable-next-line no-await-in-loop
        uploaded.push(await uploadBienPhoto(formTargetId, file));
      }
      setEditingPhotos((prev) => [...prev, ...uploaded]);
      setBiens((prev) =>
        prev.map((b) => (b.id === formTargetId ? { ...b, photos: [...(b.photos || []), ...uploaded] } : b))
      );
    } catch (err) {
      setFormBanner({ type: "error", message: extractErrorMessage(err) });
    } finally {
      setPhotoBusy(false);
    }
  }

  async function handleRemoveExistingPhoto(photo) {
    setPhotoBusy(true);
    setFormBanner(null);
    try {
      await deleteBienPhoto(formTargetId, photo.id);
      setEditingPhotos((prev) => prev.filter((p) => p.id !== photo.id));
      setBiens((prev) =>
        prev.map((b) =>
          b.id === formTargetId ? { ...b, photos: (b.photos || []).filter((p) => p.id !== photo.id) } : b
        )
      );
    } catch (err) {
      setFormBanner({ type: "error", message: extractErrorMessage(err) });
    } finally {
      setPhotoBusy(false);
    }
  }

  async function handleSubmitForm(e) {
    e.preventDefault();
    setFormBusy(true);
    setFormBanner(null);
    try {
      if (formMode === "create") {
        const created = await createBien({
          proprietaireId: Number(formDraft.proprietaire_id),
          type: Number(formDraft.type),
          designation: formDraft.designation,
          description: formDraft.description,
          statut: Number(formDraft.statut),
        });
        const photos = [];
        if (stagedFiles.length > 0) {
          for (const staged of stagedFiles) {
            // eslint-disable-next-line no-await-in-loop
            photos.push(await uploadBienPhoto(created.id, staged.file));
          }
          stagedFiles.forEach((f) => URL.revokeObjectURL(f.preview));
        }
        setBiens((prev) => [...prev, { ...created, photos }]);
      } else {
        const updated = await updateBien(formTargetId, {
          type: Number(formDraft.type),
          designation: formDraft.designation,
          description: formDraft.description || null,
          statut: Number(formDraft.statut),
        });
        setBiens((prev) => prev.map((b) => (b.id === updated.id ? { ...b, ...updated } : b)));
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
      await deleteBien(deleteTarget.id);
      setBiens((prev) => prev.filter((b) => b.id !== deleteTarget.id));
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

      {proprietaires.length === 0 && (
        <div className={`${styles.banner} ${styles.bannerSuccess}`}>
          <i className="bi bi-hourglass-split" style={{ marginRight: "0.4rem" }} />
          Aucun mandat actif pour l&apos;instant. Un propriétaire doit vous inviter pour que ses biens apparaissent
          ici.
        </div>
      )}

      {/* ---- Stats ---- */}
      <div className={styles.section}>
        <div className={styles.statsGrid}>
          <StatCard icon="bi-house-door-fill" tone="primary" label="Biens gérés" value={stats.total} />
          <StatCard icon="bi-check-circle-fill" tone="accent" label="Actifs" value={stats.actifs} />
          <StatCard icon="bi-pause-circle" tone="warning" label="Inactifs" value={stats.inactifs} />
          <StatCard icon="bi-archive-fill" tone="danger" label="Archivés" value={stats.archives} />
        </div>
      </div>

      {/* ---- Table ---- */}
      <div className={styles.section} style={{ marginBottom: 0 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem" }}>
          <div>
            <h2 className={styles.sectionTitle}>
              <i className="bi bi-table" style={{ marginRight: "0.5rem", color: "var(--primary)" }} />
              Biens gérés
            </h2>
            <p className={styles.sectionSubtitle}>
              {filteredBiens.length} bien(s) affiché(s) sur {biens.length}, tous propriétaires confondus.
            </p>
          </div>
          {creatableProprietaires.length > 0 && (
            <button type="button" className={styles.btn} onClick={openCreate}>
              <i className="bi bi-plus-lg" />
              Nouveau bien
            </button>
          )}
        </div>

        <div className={styles.filtersRow}>
          <input
            type="text"
            placeholder="Rechercher par désignation, propriétaire, type, description..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCurrentPage(1);
            }}
          />
          <FilterSelect
            value={statusFilter}
            onChange={(v) => {
              setStatusFilter(v);
              setCurrentPage(1);
            }}
            options={[{ value: "", label: "Tous les statuts" }, ...STATUS_OPTIONS]}
          />
          <FilterSelect value={sortBy} onChange={setSortBy} options={SORT_OPTIONS} />
        </div>

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Bien</th>
                <th>Propriétaire</th>
                <th>Type</th>
                <th>Statut</th>
                <th>Photos</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredBiens.length === 0 && (
                <tr>
                  <td colSpan={6} className={styles.empty}>
                    Aucun bien ne correspond à ces critères.
                  </td>
                </tr>
              )}
              {paginatedBiens.map((b) => {
                const cover = b.photos?.[0];
                return (
                  <tr key={b.id}>
                    <td>
                      <div className={styles.bienCell}>
                        {cover ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img className={styles.thumbSm} src={photoUrl(cover.url)} alt="" />
                        ) : (
                          <span className={styles.thumbPlaceholder}>
                            <i className="bi bi-house" />
                          </span>
                        )}
                        <span className={styles.userName}>{b.designation || `Bien #${b.id}`}</span>
                      </div>
                    </td>
                    <td>{proprietaireName(b.proprietaire_id)}</td>
                    <td>{TYPE_BIEN_LABELS[b.type] || "—"}</td>
                    <td>
                      <span className={`${styles.badge} ${badgeClass(b.statut)}`}>
                        {BIEN_STATUS_LABELS[b.statut] || "—"}
                      </span>
                    </td>
                    <td>{b.photos?.length || 0}</td>
                    <td>
                      {(() => {
                        const canUpdate = permIndex?.hasForBien(b.id, b.proprietaire_id, "UPDATE_PROPERTY");
                        const canDelete = permIndex?.hasForBien(b.id, b.proprietaire_id, "DELETE_PROPERTY");
                        if (!canUpdate && !canDelete) return <span className={styles.empty}>—</span>;
                        return (
                          <div className={styles.tableActions}>
                            {canUpdate && (
                              <button type="button" className={styles.iconBtn} onClick={() => openEdit(b)} title="Modifier">
                                <i className="bi bi-pencil" />
                              </button>
                            )}
                            {canDelete && (
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

          {filteredBiens.length > 0 && (
            <div className={styles.paginationRow}>
              <span>
                Page {safePage} / {totalPages} · {filteredBiens.length} bien(s)
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

      {/* ---- Créer / modifier un bien ---- */}
      <Modal isOpen={formOpen} onClose={closeForm} title={formMode === "create" ? "Nouveau bien" : "Modifier le bien"}>
        <form onSubmit={handleSubmitForm}>
          <Banner banner={formBanner} />
          {formMode === "create" && (
            <SelectField
              label="Propriétaire"
              name="proprietaire_id"
              options={creatableProprietaires.map((p) => ({ value: p.id, label: `${p.prenom} ${p.nom}` }))}
              value={formDraft.proprietaire_id}
              onChange={(e) => setFormDraft((d) => ({ ...d, proprietaire_id: e.target.value }))}
              required
            />
          )}
          <TextField
            label="Désignation"
            name="designation"
            value={formDraft.designation}
            onChange={(e) => setFormDraft((d) => ({ ...d, designation: e.target.value }))}
            placeholder="Ex : Villa Anfa, Immeuble 12..."
          />
          <TextField
            label="Description"
            name="description"
            as="textarea"
            rows={3}
            value={formDraft.description}
            onChange={(e) => setFormDraft((d) => ({ ...d, description: e.target.value }))}
            placeholder="Détails, particularités, informations utiles..."
            hint="Optionnel"
          />
          <SelectField
            label="Type"
            name="type"
            options={TYPE_OPTIONS}
            value={formDraft.type}
            onChange={(e) => setFormDraft((d) => ({ ...d, type: e.target.value }))}
            required
          />
          <SelectField
            label="Statut"
            name="statut"
            options={STATUS_OPTIONS}
            value={formDraft.statut}
            onChange={(e) => setFormDraft((d) => ({ ...d, statut: e.target.value }))}
          />

          <label className={styles.field} style={{ display: "block", marginTop: "0.9rem" }}>
            Photos
            <div className={styles.photoGrid}>
              {formMode === "edit" &&
                editingPhotos.map((photo) => (
                  <div className={styles.photoThumb} key={photo.id}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photoUrl(photo.url)} alt="" />
                    <button
                      type="button"
                      className={styles.photoRemoveBtn}
                      onClick={() => handleRemoveExistingPhoto(photo)}
                      disabled={photoBusy}
                      title="Supprimer cette photo"
                    >
                      <i className="bi bi-x" />
                    </button>
                  </div>
                ))}
              {formMode === "create" &&
                stagedFiles.map((staged, index) => (
                  <div className={styles.photoThumb} key={staged.preview}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={staged.preview} alt="" />
                    <button
                      type="button"
                      className={styles.photoRemoveBtn}
                      onClick={() => removeStagedFile(index)}
                      title="Retirer cette photo"
                    >
                      <i className="bi bi-x" />
                    </button>
                  </div>
                ))}
            </div>
            <label className={styles.photoUpload}>
              <i className="bi bi-camera-fill" />
              {photoBusy ? "Envoi..." : "Ajouter des photos"}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                disabled={photoBusy}
                onChange={formMode === "edit" ? handleAddPhotosToExisting : handleStageFiles}
              />
            </label>
          </label>

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
        title="Masquer le bien"
        message={
          deleteTarget
            ? `Masquer "${deleteTarget.designation || `Bien #${deleteTarget.id}`}" ? Il ne sera plus visible dans vos listes (ses lots et baux restent conservés).`
            : ""
        }
        confirmLabel="Masquer"
        danger
        isBusy={deleteBusy}
        error={deleteError}
      />
    </div>
  );
}
