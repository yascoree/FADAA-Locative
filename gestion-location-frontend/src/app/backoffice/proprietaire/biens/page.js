"use client";

import { useEffect, useMemo, useState } from "react";
import { extractErrorMessage, API_BASE_URL } from "@/lib/apiClient";
import { useAuth } from "@/context/AuthContext";
import {
  fetchCategories,
  fetchBiens,
  createBien,
  updateBien,
  deleteBien,
  uploadBienPhoto,
  deleteBienPhoto,
  BIEN_STATUS,
  BIEN_STATUS_LABELS,
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
  if (statut === BIEN_STATUS.DISPONIBLE) return styles.badgeActive;
  if (statut === BIEN_STATUS.LOUE) return styles.badgeNeutral;
  if (statut === BIEN_STATUS.MAINTENANCE) return styles.badgeWarning;
  return styles.badgeDanger;
}

function photoUrl(url) {
  return `${API_BASE_URL}${url}`;
}

const STATUS_OPTIONS = Object.entries(BIEN_STATUS_LABELS).map(([value, label]) => ({ value, label }));
const PAGE_SIZE = 10;

const EMPTY_FORM = { designation: "", categorie_id: "", statut: String(BIEN_STATUS.DISPONIBLE) };

export default function ProprietaireBiensPage() {
  const { user } = useAuth();

  const [biens, setBiens] = useState([]);
  const [categories, setCategories] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
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

  useEffect(() => {
    async function init() {
      setIsLoading(true);
      try {
        const [biensList, categoriesList] = await Promise.all([fetchBiens(), fetchCategories()]);
        setBiens(biensList);
        setCategories(categoriesList);
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
      disponibles: biens.filter((b) => b.statut === BIEN_STATUS.DISPONIBLE).length,
      loues: biens.filter((b) => b.statut === BIEN_STATUS.LOUE).length,
      autres: biens.filter((b) => b.statut === BIEN_STATUS.MAINTENANCE || b.statut === BIEN_STATUS.HORS_SERVICE).length,
    };
  }, [biens]);

  const filteredBiens = useMemo(() => {
    const term = search.trim().toLowerCase();
    return biens.filter((b) => {
      if (term && !(b.designation || "").toLowerCase().includes(term)) return false;
      if (statusFilter && String(b.statut) !== statusFilter) return false;
      return true;
    });
  }, [biens, search, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredBiens.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedBiens = filteredBiens.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  function categoryName(categorieId) {
    return categories.find((c) => c.id === categorieId)?.libelle || "—";
  }

  function openCreate() {
    setFormMode("create");
    setFormTargetId(null);
    setFormDraft(EMPTY_FORM);
    setFormBanner(null);
    setStagedFiles([]);
    setEditingPhotos([]);
    setFormOpen(true);
  }

  function openEdit(bien) {
    setFormMode("edit");
    setFormTargetId(bien.id);
    setFormDraft({
      designation: bien.designation || "",
      categorie_id: String(bien.categorie_id),
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
        // Séquentiel : évite de saturer l'API si l'utilisateur sélectionne beaucoup de photos d'un coup.
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
          proprietaireId: user.id,
          categorieId: Number(formDraft.categorie_id),
          designation: formDraft.designation,
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
          categorie_id: Number(formDraft.categorie_id),
          designation: formDraft.designation,
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
    try {
      await deleteBien(deleteTarget.id);
      setBiens((prev) => prev.filter((b) => b.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err) {
      setLoadError(extractErrorMessage(err));
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
          <StatCard icon="bi-house-door-fill" tone="primary" label="Biens" value={stats.total} />
          <StatCard icon="bi-check-circle-fill" tone="accent" label="Disponibles" value={stats.disponibles} />
          <StatCard icon="bi-key-fill" tone="primary" label="Loués" value={stats.loues} />
          <StatCard icon="bi-tools" tone="warning" label="Maintenance / hors service" value={stats.autres} />
        </div>
      </div>

      {/* ---- Table ---- */}
      <div className={styles.section} style={{ marginBottom: 0 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem" }}>
          <div>
            <h2 className={styles.sectionTitle}>
              <i className="bi bi-table" style={{ marginRight: "0.5rem", color: "var(--primary)" }} />
              Mes biens
            </h2>
            <p className={styles.sectionSubtitle}>
              {filteredBiens.length} bien(s) affiché(s) sur {biens.length}.
            </p>
          </div>
          <button type="button" className={styles.btn} onClick={openCreate}>
            <i className="bi bi-plus-lg" />
            Nouveau bien
          </button>
        </div>

        <div className={styles.filtersRow}>
          <input
            type="text"
            placeholder="Rechercher par désignation..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCurrentPage(1);
            }}
          />
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
                <th>Bien</th>
                <th>Catégorie</th>
                <th>Statut</th>
                <th>Photos</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredBiens.length === 0 && (
                <tr>
                  <td colSpan={5} className={styles.empty}>
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
                          <img className={styles.thumbSm} src={photoUrl(cover.url)} alt="" />
                        ) : (
                          <span className={styles.thumbPlaceholder}>
                            <i className="bi bi-house" />
                          </span>
                        )}
                        <span className={styles.userName}>{b.designation || `Bien #${b.id}`}</span>
                      </div>
                    </td>
                    <td>{categoryName(b.categorie_id)}</td>
                    <td>
                      <span className={`${styles.badge} ${badgeClass(b.statut)}`}>
                        {BIEN_STATUS_LABELS[b.statut] || "—"}
                      </span>
                    </td>
                    <td>{b.photos?.length || 0}</td>
                    <td>
                      <div className={styles.tableActions}>
                        <button type="button" className={styles.iconBtn} onClick={() => openEdit(b)} title="Modifier">
                          <i className="bi bi-pencil" />
                        </button>
                        <button
                          type="button"
                          className={`${styles.iconBtn} ${styles.iconBtnDanger}`}
                          onClick={() => setDeleteTarget(b)}
                          title="Supprimer"
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
          <TextField
            label="Désignation"
            name="designation"
            value={formDraft.designation}
            onChange={(e) => setFormDraft((d) => ({ ...d, designation: e.target.value }))}
            placeholder="Ex : Villa Anfa, Immeuble 12..."
          />
          <SelectField
            label="Catégorie"
            name="categorie_id"
            options={categories.map((c) => ({ value: c.id, label: c.libelle }))}
            value={formDraft.categorie_id}
            onChange={(e) => setFormDraft((d) => ({ ...d, categorie_id: e.target.value }))}
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
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        title="Supprimer le bien"
        message={
          deleteTarget
            ? `Supprimer définitivement "${deleteTarget.designation || `Bien #${deleteTarget.id}`}" ? Les lots et baux associés seront aussi supprimés. Cette action est irréversible.`
            : ""
        }
        confirmLabel="Supprimer"
        danger
        isBusy={deleteBusy}
      />
    </div>
  );
}
