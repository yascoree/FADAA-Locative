"use client";

import { useEffect, useMemo, useState } from "react";
import { extractErrorMessage, isPlanLimitError, API_BASE_URL } from "@/lib/apiClient";
import {
  fetchBiens,
  fetchLots,
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
import MapPicker from "@/components/MapPicker";
import BienDetailsModal from "@/components/BienDetailsModal";
import PlanLimitPopup from "@/components/PlanLimitPopup";
import LoadingState from "@/components/LoadingState";
import EmptyState from "@/components/EmptyState";
import { useLanguage } from "@/context/LanguageContext";
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
  adresse: "",
  latitude: null,
  longitude: null,
  type: String(TYPE_BIEN.IMMOBILIER),
  statut: String(BIEN_STATUS.ACTIF),
  valorisation: "",
};

export default function AgenceBiensPage() {
  const { t } = useLanguage();
  const [biens, setBiens] = useState([]);
  const [lots, setLots] = useState([]);
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
  const [planLimitMessage, setPlanLimitMessage] = useState(null);

  const [editingPhotos, setEditingPhotos] = useState([]);
  const [stagedFiles, setStagedFiles] = useState([]);
  const [pendingRemovePhotoIds, setPendingRemovePhotoIds] = useState([]);
  const [photoBusy, setPhotoBusy] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  const [detailsTarget, setDetailsTarget] = useState(null);

  useEffect(() => {
    async function init() {
      setIsLoading(true);
      try {
        const [biensList, lotsList, mandatesList, permissionIndex] = await Promise.all([
          fetchBiens(),
          fetchLots(),
          fetchMandates(),
          fetchGestionnairePermissionIndex(),
        ]);
        setBiens(biensList);
        setLots(lotsList);
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
        const haystack = `${b.designation || ""} ${b.description || ""} ${b.adresse || ""} ${TYPE_BIEN_LABELS[b.type] || ""} ${proprietaireName(b.proprietaire_id)}`.toLowerCase();
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
      adresse: bien.adresse || "",
      latitude: bien.latitude ?? null,
      longitude: bien.longitude ?? null,
      type: String(bien.type),
      statut: String(bien.statut),
      valorisation: bien.valorisation ?? "",
    });
    setEditingPhotos(bien.photos || []);
    setStagedFiles([]);
    setPendingRemovePhotoIds([]);
    setFormBanner(null);
    setFormOpen(true);
  }

  function closeForm() {
    if (formBusy || photoBusy) return;
    stagedFiles.forEach((f) => URL.revokeObjectURL(f.preview));
    setPendingRemovePhotoIds([]);
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

  // La suppression réelle n'est effectuée qu'à la soumission du formulaire (voir
  // handleSubmitForm) : ce clic ne fait que marquer/démarquer la photo localement,
  // pour éviter qu'un simple clic sur la vignette supprime la photo sans confirmation.
  function toggleRemoveExistingPhoto(photoId) {
    setPendingRemovePhotoIds((prev) =>
      prev.includes(photoId) ? prev.filter((id) => id !== photoId) : [...prev, photoId]
    );
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
          adresse: formDraft.adresse,
          latitude: formDraft.latitude,
          longitude: formDraft.longitude,
          statut: Number(formDraft.statut),
          valorisation: formDraft.valorisation,
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
          adresse: formDraft.adresse || null,
          latitude: formDraft.latitude,
          longitude: formDraft.longitude,
          statut: Number(formDraft.statut),
          valorisation: formDraft.valorisation === "" ? null : Number(formDraft.valorisation),
        });
        if (pendingRemovePhotoIds.length > 0) {
          for (const photoId of pendingRemovePhotoIds) {
            // eslint-disable-next-line no-await-in-loop
            await deleteBienPhoto(formTargetId, photoId);
          }
        }
        const remainingPhotos = (updated.photos || editingPhotos).filter(
          (p) => !pendingRemovePhotoIds.includes(p.id)
        );
        setBiens((prev) =>
          prev.map((b) => (b.id === updated.id ? { ...b, ...updated, photos: remainingPhotos } : b))
        );
        setPendingRemovePhotoIds([]);
      }
      setFormOpen(false);
    } catch (err) {
      if (isPlanLimitError(err)) {
        setPlanLimitMessage(extractErrorMessage(err));
      } else {
        setFormBanner({ type: "error", message: extractErrorMessage(err) });
      }
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
    return <LoadingState label={t("bo.common.loading")} />;
  }

  return (
    <div>
      <Banner banner={loadError ? { type: "error", message: loadError } : null} />

      {proprietaires.length === 0 && (
        <div className={`${styles.banner} ${styles.bannerSuccess}`}>
          <i className="bi bi-hourglass-split" style={{ marginRight: "0.4rem" }} />
          {t("bo.agenceBiens.noMandateBanner")}
        </div>
      )}

      {/* ---- Stats ---- */}
      <div className={styles.section}>
        <div className={styles.statsGrid}>
          <StatCard icon="bi-house-door-fill" tone="primary" label={t("bo.agenceBiens.statTotal")} value={stats.total} />
          <StatCard icon="bi-check-circle-fill" tone="accent" label={t("bo.proprietaireBiens.statActive")} value={stats.actifs} />
          <StatCard icon="bi-pause-circle" tone="warning" label={t("bo.proprietaireBiens.statInactive")} value={stats.inactifs} />
          <StatCard icon="bi-archive-fill" tone="danger" label={t("bo.proprietaireBiens.statArchived")} value={stats.archives} />
        </div>
      </div>

      {/* ---- Table ---- */}
      <div className={styles.section} style={{ marginBottom: 0 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem" }}>
          <div>
            <h2 className={styles.sectionTitle}>
              <i className="bi bi-table" style={{ marginRight: "0.5rem", color: "var(--primary)" }} />
              {t("bo.agenceBiens.title")}
            </h2>
            <p className={styles.sectionSubtitle}>
              {t("bo.agenceBiens.subtitle", { shown: filteredBiens.length, total: biens.length })}
            </p>
          </div>
          {creatableProprietaires.length > 0 && (
            <button type="button" className={styles.btn} onClick={openCreate}>
              <i className="bi bi-plus-lg" />
              {t("bo.proprietaireBiens.newBien")}
            </button>
          )}
        </div>

        <div className={styles.filtersRow}>
          <input
            type="text"
            placeholder={t("bo.agenceBiens.searchPlaceholder")}
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
            options={[{ value: "", label: t("bo.common.allStatuses") }, ...STATUS_OPTIONS]}
          />
          <FilterSelect value={sortBy} onChange={setSortBy} options={SORT_OPTIONS} />
        </div>

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>{t("bo.agenceBiens.colBien")}</th>
                <th>{t("bo.agenceBiens.colProprietaire")}</th>
                <th>{t("bo.proprietaireBiens.colType")}</th>
                <th>{t("bo.proprietaireBiens.colStatus")}</th>
                <th>{t("bo.proprietaireBiens.colPhotos")}</th>
                <th>{t("bo.proprietaireBiens.colActions")}</th>
              </tr>
            </thead>
            <tbody>
              {filteredBiens.length === 0 && (
                <tr>
                  <td colSpan={6} className={styles.empty}>
                    <EmptyState icon="bi-house-door" title={t("bo.common.noMatch")} />
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
                        <div>
                          <span className={styles.userName}>{b.designation || `Bien #${b.id}`}</span>
                          {b.adresse && (
                            <div style={{ fontSize: "0.76rem", color: "var(--text-muted)" }}>
                              <i className="bi bi-geo-alt" style={{ marginRight: "0.25rem" }} />
                              {b.adresse}
                            </div>
                          )}
                        </div>
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
                        return (
                          <div className={styles.tableActions}>
                            <button
                              type="button"
                              className={styles.iconBtn}
                              onClick={() => setDetailsTarget(b)}
                              title={t("bo.common.seeDetails")}
                            >
                              <i className="bi bi-eye" />
                            </button>
                            {canUpdate && (
                              <button type="button" className={styles.iconBtn} onClick={() => openEdit(b)} title={t("bo.common.edit")}>
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
                                title={t("bo.common.delete")}
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
                {t("bo.proprietaireBiens.pageOf", { page: safePage, total: totalPages, count: filteredBiens.length })}
              </span>
              <div className={styles.paginationButtons}>
                <button
                  type="button"
                  className={styles.btnOutline}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={safePage <= 1}
                >
                  <i className="bi bi-chevron-left" />
                  {t("bo.common.previous")}
                </button>
                <button
                  type="button"
                  className={styles.btnOutline}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={safePage >= totalPages}
                >
                  {t("bo.common.next")}
                  <i className="bi bi-chevron-right" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ---- Créer / modifier un bien ---- */}
      <Modal isOpen={formOpen} onClose={closeForm} title={formMode === "create" ? t("bo.proprietaireBiens.createTitle") : t("bo.proprietaireBiens.editTitle")}>
        <form onSubmit={handleSubmitForm}>
          <Banner banner={formBanner} />
          {formMode === "create" && (
            <SelectField
              label={t("bo.agenceBiens.proprietaireLabel")}
              name="proprietaire_id"
              options={creatableProprietaires.map((p) => ({ value: p.id, label: `${p.prenom} ${p.nom}` }))}
              value={formDraft.proprietaire_id}
              onChange={(e) => setFormDraft((d) => ({ ...d, proprietaire_id: e.target.value }))}
              required
            />
          )}
          <TextField
            label={t("bo.proprietaireBiens.designationLabel")}
            name="designation"
            value={formDraft.designation}
            onChange={(e) => setFormDraft((d) => ({ ...d, designation: e.target.value }))}
            placeholder={t("bo.proprietaireBiens.designationPlaceholder")}
          />
          <MapPicker
            label={t("bo.proprietaireBiens.locationLabel")}
            adresse={formDraft.adresse}
            latitude={formDraft.latitude}
            longitude={formDraft.longitude}
            onChange={({ adresse, latitude, longitude }) => setFormDraft((d) => ({ ...d, adresse, latitude, longitude }))}
            hint={t("bo.proprietaireBiens.locationHint")}
          />
          <TextField
            label={t("bo.proprietaireBiens.descriptionLabel")}
            name="description"
            as="textarea"
            rows={3}
            value={formDraft.description}
            onChange={(e) => setFormDraft((d) => ({ ...d, description: e.target.value }))}
            placeholder={t("bo.proprietaireBiens.descriptionPlaceholder")}
            hint={t("bo.proprietaireBiens.optionalHint")}
          />
          <SelectField
            label={t("bo.proprietaireBiens.typeLabel")}
            name="type"
            options={TYPE_OPTIONS}
            value={formDraft.type}
            onChange={(e) => setFormDraft((d) => ({ ...d, type: e.target.value }))}
            required
          />
          <SelectField
            label={t("bo.proprietaireBiens.statusLabel")}
            name="statut"
            options={STATUS_OPTIONS}
            value={formDraft.statut}
            onChange={(e) => setFormDraft((d) => ({ ...d, statut: e.target.value }))}
          />
          <TextField
            label={t("bo.proprietaireBiens.valorisationLabel")}
            name="valorisation"
            type="number"
            step="0.01"
            min="0"
            value={formDraft.valorisation}
            onChange={(e) => setFormDraft((d) => ({ ...d, valorisation: e.target.value }))}
            placeholder={t("bo.proprietaireBiens.valorisationPlaceholder")}
            hint={t("bo.proprietaireBiens.optionalHint")}
          />

          <label className={styles.field} style={{ display: "block", marginTop: "0.9rem" }}>
            {t("bo.proprietaireBiens.photosLabel")}
            <div className={styles.photoGrid}>
              {formMode === "edit" &&
                editingPhotos.map((photo) => {
                  const pendingRemove = pendingRemovePhotoIds.includes(photo.id);
                  return (
                    <div className={styles.photoThumb} key={photo.id} style={{ opacity: pendingRemove ? 0.4 : 1 }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={photoUrl(photo.url)} alt="" />
                      <button
                        type="button"
                        className={styles.photoRemoveBtn}
                        onClick={() => toggleRemoveExistingPhoto(photo.id)}
                        disabled={photoBusy}
                        title={t(
                          pendingRemove
                            ? "bo.proprietaireBiens.restorePhotoTitle"
                            : "bo.proprietaireBiens.removePhotoTitle"
                        )}
                      >
                        <i className={`bi ${pendingRemove ? "bi-arrow-counterclockwise" : "bi-x"}`} />
                      </button>
                    </div>
                  );
                })}
              {formMode === "create" &&
                stagedFiles.map((staged, index) => (
                  <div className={styles.photoThumb} key={staged.preview}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={staged.preview} alt="" />
                    <button
                      type="button"
                      className={styles.photoRemoveBtn}
                      onClick={() => removeStagedFile(index)}
                      title={t("bo.proprietaireBiens.removeStagedTitle")}
                    >
                      <i className="bi bi-x" />
                    </button>
                  </div>
                ))}
            </div>
            <label className={styles.photoUpload}>
              <i className="bi bi-camera-fill" />
              {photoBusy ? t("bo.proprietaireBiens.uploading") : t("bo.proprietaireBiens.addPhotos")}
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
              {formBusy ? t("bo.common.saving") : t("bo.common.save")}
            </button>
            <button type="button" className={styles.btnOutline} onClick={closeForm} disabled={formBusy}>
              <i className="bi bi-x-lg" />
              {t("bo.common.cancel")}
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
        title={t("bo.proprietaireBiens.deleteConfirmTitle")}
        message={
          deleteTarget
            ? t("bo.proprietaireBiens.deleteConfirmMessage", {
                name: deleteTarget.designation || `Bien #${deleteTarget.id}`,
              })
            : ""
        }
        confirmLabel={t("bo.proprietaireBiens.deleteConfirmLabel")}
        danger
        isBusy={deleteBusy}
        error={deleteError}
      />

      {/* ---- Détails d'un bien ---- */}
      <BienDetailsModal
        bien={detailsTarget}
        onClose={() => setDetailsTarget(null)}
        ownerName={detailsTarget ? proprietaireName(detailsTarget.proprietaire_id) : null}
        lots={detailsTarget ? lots.filter((l) => l.bien_id === detailsTarget.id) : null}
      />

      <PlanLimitPopup message={planLimitMessage} onClose={() => setPlanLimitMessage(null)} />
    </div>
  );
}
