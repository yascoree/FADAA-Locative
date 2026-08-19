"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { extractErrorMessage, isPlanLimitError, API_BASE_URL } from "@/lib/apiClient";
import {
  fetchBiens,
  fetchLots,
  fetchCategories,
  fetchBaux,
  createLot,
  updateLot,
  deleteLot,
  uploadLotPhoto,
  deleteLotPhoto,
  LOT_STATUS,
  LOT_STATUS_LABELS,
  BAIL_STATUS,
} from "@/lib/properties";
import { SORT_OPTIONS, sortList } from "@/lib/sort";
import StatCard from "@/components/StatCard";
import Modal from "@/components/Modal";
import ConfirmationDialog from "@/components/ConfirmationDialog";
import TextField from "@/components/TextField";
import SelectField from "@/components/SelectField";
import FilterSelect from "@/components/FilterSelect";
import PlanLimitPopup from "@/components/PlanLimitPopup";
import LotDetailsModal from "@/components/LotDetailsModal";
import { usePlanGate } from "@/hooks/usePlanGate";
import { useLanguage } from "@/context/LanguageContext";
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
  if (statut === LOT_STATUS.DISPONIBLE) return styles.badgeActive;
  if (statut === LOT_STATUS.LOUE) return styles.badgeNeutral;
  if (statut === LOT_STATUS.HORS_SERVICE) return styles.badgeDanger;
  return styles.badgeWarning;
}

function formatCurrency(value) {
  if (value === null || value === undefined || value === "") return "—";
  return `${Number(value).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} MAD`;
}

function photoUrl(url) {
  return `${API_BASE_URL}${url}`;
}

const STATUS_OPTIONS = Object.entries(LOT_STATUS_LABELS).map(([value, label]) => ({ value, label }));
const PAGE_SIZE = 10;

const EMPTY_FORM = {
  bien_id: "",
  categorie_id: "",
  reference: "",
  description: "",
  loyer_reference: "",
  statut: String(LOT_STATUS.DISPONIBLE),
  valorisation: "",
};

export default function ProprietaireLotsPage() {
  const { t } = useLanguage();
  const searchParams = useSearchParams();
  const [lots, setLots] = useState([]);
  const [biens, setBiens] = useState([]);
  const [categories, setCategories] = useState([]);
  const [baux, setBaux] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [detailsTarget, setDetailsTarget] = useState(null);

  const [search, setSearch] = useState("");
  const [bienFilter, setBienFilter] = useState("");
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
  const { checkBeforeOpen } = usePlanGate("lots");

  const [editingPhotos, setEditingPhotos] = useState([]);
  const [stagedFiles, setStagedFiles] = useState([]);
  const [pendingRemovePhotoIds, setPendingRemovePhotoIds] = useState([]);
  const [photoBusy, setPhotoBusy] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  useEffect(() => {
    async function init() {
      setIsLoading(true);
      try {
        const [lotsList, biensList, categoriesList, bauxList] = await Promise.all([
          fetchLots(),
          fetchBiens(),
          fetchCategories(),
          fetchBaux(),
        ]);
        setLots(lotsList);
        setBiens(biensList);
        setCategories(categoriesList);
        setBaux(bauxList);
        if (searchParams.get("create") === "1" && biensList.length > 0) {
          setFormMode("create");
          setFormTargetId(null);
          setFormDraft({ ...EMPTY_FORM, bien_id: String(biensList[0].id) });
          setFormBanner(null);
          setFormOpen(true);
        }
      } catch (err) {
        setLoadError(extractErrorMessage(err));
      } finally {
        setIsLoading(false);
      }
    }
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stats = useMemo(() => {
    return {
      total: lots.length,
      disponibles: lots.filter((l) => l.statut === LOT_STATUS.DISPONIBLE).length,
      loues: lots.filter((l) => l.statut === LOT_STATUS.LOUE).length,
      enMaintenance: lots.filter((l) => l.statut === LOT_STATUS.EN_MAINTENANCE).length,
      horsService: lots.filter((l) => l.statut === LOT_STATUS.HORS_SERVICE).length,
    };
  }, [lots]);

  const filteredLots = useMemo(() => {
    const term = search.trim().toLowerCase();
    const filtered = lots.filter((l) => {
      if (term) {
        const haystack = `${l.reference || ""} ${l.description || ""} ${bienName(l.bien_id)} ${l.loyer_reference ?? ""}`.toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      if (bienFilter && String(l.bien_id) !== bienFilter) return false;
      if (statusFilter && String(l.statut) !== statusFilter) return false;
      return true;
    });
    return sortList(filtered, sortBy, { dateOf: (l) => l.created_at, nameOf: (l) => l.reference });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lots, search, bienFilter, statusFilter, sortBy, biens]);

  const totalPages = Math.max(1, Math.ceil(filteredLots.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedLots = filteredLots.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  function bienName(bienId) {
    const bien = biens.find((b) => b.id === bienId);
    return bien ? bien.designation || `Bien #${bien.id}` : "—";
  }

  function categoryName(categorieId) {
    return categories.find((c) => c.id === categorieId)?.libelle || "—";
  }

  function currentBailForLot(lotId) {
    return baux.find(
      (b) => b.lot_id === lotId && (b.statut === BAIL_STATUS.ACTIF || b.statut === BAIL_STATUS.EN_ATTENTE)
    );
  }

  // Sous-catégories proposables pour le bien actuellement sélectionné dans le
  // formulaire — filtrées sur le même type_bien que ce bien (voir logique
  // Bien.type / Categorie.type_bien côté backend).
  const formBienType = biens.find((b) => b.id === Number(formDraft.bien_id))?.type;
  const availableCategories = categories.filter((c) => c.type_bien === formBienType);

  function openCreate() {
    const blockMessage = checkBeforeOpen();
    if (blockMessage) {
      setPlanLimitMessage(blockMessage);
      return;
    }
    setFormMode("create");
    setFormTargetId(null);
    setFormDraft({ ...EMPTY_FORM, bien_id: biens[0] ? String(biens[0].id) : "" });
    setFormBanner(null);
    setStagedFiles([]);
    setEditingPhotos([]);
    setFormOpen(true);
  }

  function openEdit(lot) {
    setFormMode("edit");
    setFormTargetId(lot.id);
    setFormDraft({
      bien_id: String(lot.bien_id),
      categorie_id: lot.categorie_id ? String(lot.categorie_id) : "",
      reference: lot.reference || "",
      description: lot.description || "",
      loyer_reference: lot.loyer_reference ?? "",
      statut: String(lot.statut),
      valorisation: lot.valorisation ?? "",
    });
    setEditingPhotos(lot.photos || []);
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
        uploaded.push(await uploadLotPhoto(formTargetId, file));
      }
      setEditingPhotos((prev) => [...prev, ...uploaded]);
      setLots((prev) =>
        prev.map((l) => (l.id === formTargetId ? { ...l, photos: [...(l.photos || []), ...uploaded] } : l))
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
        const created = await createLot({
          bienId: Number(formDraft.bien_id),
          categorieId: formDraft.categorie_id === "" ? null : Number(formDraft.categorie_id),
          reference: formDraft.reference,
          description: formDraft.description,
          loyerReference: formDraft.loyer_reference === "" ? null : Number(formDraft.loyer_reference),
          statut: Number(formDraft.statut),
          valorisation: formDraft.valorisation,
        });
        const photos = [];
        if (stagedFiles.length > 0) {
          for (const staged of stagedFiles) {
            // eslint-disable-next-line no-await-in-loop
            photos.push(await uploadLotPhoto(created.id, staged.file));
          }
          stagedFiles.forEach((f) => URL.revokeObjectURL(f.preview));
        }
        setLots((prev) => [...prev, { ...created, photos }]);
      } else {
        const updated = await updateLot(formTargetId, {
          bien_id: Number(formDraft.bien_id),
          categorie_id: formDraft.categorie_id === "" ? null : Number(formDraft.categorie_id),
          reference: formDraft.reference,
          description: formDraft.description || null,
          loyer_reference: formDraft.loyer_reference === "" ? null : Number(formDraft.loyer_reference),
          statut: Number(formDraft.statut),
          valorisation: formDraft.valorisation === "" ? null : Number(formDraft.valorisation),
        });
        if (pendingRemovePhotoIds.length > 0) {
          for (const photoId of pendingRemovePhotoIds) {
            // eslint-disable-next-line no-await-in-loop
            await deleteLotPhoto(formTargetId, photoId);
          }
        }
        const remainingPhotos = (updated.photos || editingPhotos).filter(
          (p) => !pendingRemovePhotoIds.includes(p.id)
        );
        setLots((prev) => prev.map((l) => (l.id === updated.id ? { ...updated, photos: remainingPhotos } : l)));
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
    return <p>{t("bo.common.loading")}</p>;
  }

  return (
    <div>
      <PlanLimitPopup message={planLimitMessage} onClose={() => setPlanLimitMessage(null)} />
      <Banner banner={loadError ? { type: "error", message: loadError } : null} />

      {/* ---- Stats ---- */}
      <div className={styles.section}>
        <div className={styles.statsGrid}>
          <StatCard icon="bi-grid-3x3-gap-fill" tone="primary" label={t("bo.proprietaireLots.statTotal")} value={stats.total} />
          <StatCard icon="bi-check-circle-fill" tone="accent" label={t("bo.proprietaireLots.statAvailable")} value={stats.disponibles} />
          <StatCard icon="bi-key-fill" tone="primary" label={t("bo.proprietaireLots.statRented")} value={stats.loues} />
          <StatCard icon="bi-tools" tone="warning" label={t("bo.proprietaireLots.statMaintenance")} value={stats.enMaintenance} />
          <StatCard icon="bi-slash-circle" tone="danger" label={t("bo.proprietaireLots.statOutOfService")} value={stats.horsService} />
        </div>
      </div>

      {/* ---- Table ---- */}
      <div className={styles.section} style={{ marginBottom: 0 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem" }}>
          <div>
            <h2 className={styles.sectionTitle}>
              <i className="bi bi-table" style={{ marginRight: "0.5rem", color: "var(--primary)" }} />
              {t("bo.proprietaireLots.title")}
            </h2>
            <p className={styles.sectionSubtitle}>
              {t("bo.proprietaireLots.subtitle", { shown: filteredLots.length, total: lots.length })}
            </p>
          </div>
          <button
            type="button"
            className={styles.btn}
            onClick={openCreate}
            disabled={biens.length === 0}
            title={biens.length === 0 ? t("bo.proprietaireLots.addBienFirst") : undefined}
          >
            <i className="bi bi-plus-lg" />
            {t("bo.proprietaireLots.newLot")}
          </button>
        </div>

        {biens.length === 0 && (
          <div className={styles.prereqNotice}>
            <span className={styles.prereqNoticeIcon}>
              <i className="bi bi-exclamation-lg" />
            </span>
            <span className={styles.prereqNoticeText}>{t("bo.proprietaireLots.prereqText")}</span>
            <Link href="/backoffice/proprietaire/biens?create=1" className={styles.prereqNoticeAction}>
              {t("bo.proprietaireLots.prereqAction")}
              <i className="bi bi-arrow-right" />
            </Link>
          </div>
        )}

        <div className={styles.filtersRow}>
          <input
            type="text"
            placeholder={t("bo.proprietaireLots.searchPlaceholder")}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCurrentPage(1);
            }}
          />
          <FilterSelect
            value={bienFilter}
            onChange={(v) => {
              setBienFilter(v);
              setCurrentPage(1);
            }}
            options={[
              { value: "", label: t("bo.proprietaireLots.allBiens") },
              ...biens.map((b) => ({ value: b.id, label: b.designation || `Bien #${b.id}` })),
            ]}
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
                <th>{t("bo.proprietaireLots.colReference")}</th>
                <th>{t("bo.proprietaireLots.colBien")}</th>
                <th>{t("bo.proprietaireLots.colSubcategory")}</th>
                <th>{t("bo.proprietaireLots.colReferenceRent")}</th>
                <th>{t("bo.proprietaireLots.colStatus")}</th>
                <th>{t("bo.proprietaireLots.colPhotos")}</th>
                <th>{t("bo.proprietaireLots.colActions")}</th>
              </tr>
            </thead>
            <tbody>
              {filteredLots.length === 0 && (
                <tr>
                  <td colSpan={7} className={styles.empty}>
                    {t("bo.common.noMatch")}
                  </td>
                </tr>
              )}
              {paginatedLots.map((l) => {
                const cover = l.photos?.[0];
                return (
                <tr key={l.id}>
                  <td>
                    <div className={styles.bienCell}>
                      {cover ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img className={styles.thumbSm} src={photoUrl(cover.url)} alt="" />
                      ) : (
                        <span className={styles.thumbPlaceholder}>
                          <i className="bi bi-grid-3x3-gap" />
                        </span>
                      )}
                      <span className={styles.userName}>{l.reference || `Lot #${l.id}`}</span>
                    </div>
                  </td>
                  <td>{bienName(l.bien_id)}</td>
                  <td>{l.categorie_id ? categoryName(l.categorie_id) : "—"}</td>
                  <td>{formatCurrency(l.loyer_reference)}</td>
                  <td>
                    <span className={`${styles.badge} ${badgeClass(l.statut)}`}>
                      {LOT_STATUS_LABELS[l.statut] || "—"}
                    </span>
                  </td>
                  <td>{l.photos?.length || 0}</td>
                  <td>
                    <div className={styles.tableActions}>
                      <button
                        type="button"
                        className={styles.iconBtn}
                        onClick={() => setDetailsTarget(l)}
                        title={t("bo.common.seeDetails")}
                      >
                        <i className="bi bi-eye" />
                      </button>
                      <button type="button" className={styles.iconBtn} onClick={() => openEdit(l)} title={t("bo.common.edit")}>
                        <i className="bi bi-pencil" />
                      </button>
                      <button
                        type="button"
                        className={`${styles.iconBtn} ${styles.iconBtnDanger}`}
                        onClick={() => {
                          setDeleteTarget(l);
                          setDeleteError(null);
                        }}
                        title={t("bo.common.delete")}
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

          {filteredLots.length > 0 && (
            <div className={styles.paginationRow}>
              <span>
                {t("bo.proprietaireLots.pageOf", { page: safePage, total: totalPages, count: filteredLots.length })}
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

      {/* ---- Créer / modifier un lot ---- */}
      <Modal isOpen={formOpen} onClose={closeForm} title={formMode === "create" ? t("bo.proprietaireLots.createTitle") : t("bo.proprietaireLots.editTitle")}>
        <form onSubmit={handleSubmitForm}>
          <Banner banner={formBanner} />
          <SelectField
            label={t("bo.proprietaireLots.bienLabel")}
            name="bien_id"
            options={biens.map((b) => ({ value: b.id, label: b.designation || `Bien #${b.id}` }))}
            value={formDraft.bien_id}
            onChange={(e) => setFormDraft((d) => ({ ...d, bien_id: e.target.value, categorie_id: "" }))}
            required
          />
          <SelectField
            label={t("bo.proprietaireLots.subcategoryLabel")}
            name="categorie_id"
            options={[
              { value: "", label: t("bo.proprietaireLots.none") },
              ...availableCategories.map((c) => ({ value: c.id, label: c.libelle })),
            ]}
            value={formDraft.categorie_id}
            onChange={(e) => setFormDraft((d) => ({ ...d, categorie_id: e.target.value }))}
            hint={availableCategories.length === 0 ? t("bo.proprietaireLots.noSubcategoryHint") : undefined}
          />
          <TextField
            label={t("bo.proprietaireLots.referenceLabel")}
            name="reference"
            value={formDraft.reference}
            onChange={(e) => setFormDraft((d) => ({ ...d, reference: e.target.value }))}
            placeholder={t("bo.proprietaireLots.referencePlaceholder")}
          />
          <TextField
            label={t("bo.proprietaireLots.descriptionLabel")}
            name="description"
            as="textarea"
            rows={3}
            value={formDraft.description}
            onChange={(e) => setFormDraft((d) => ({ ...d, description: e.target.value }))}
            placeholder={t("bo.proprietaireLots.descriptionPlaceholder")}
            hint={t("bo.proprietaireLots.optionalHint")}
          />
          <TextField
            label={t("bo.proprietaireLots.referenceRentLabel")}
            name="loyer_reference"
            type="number"
            step="0.01"
            min="0"
            value={formDraft.loyer_reference}
            onChange={(e) => setFormDraft((d) => ({ ...d, loyer_reference: e.target.value }))}
          />
          <SelectField
            label={t("bo.proprietaireLots.statusLabel")}
            name="statut"
            options={STATUS_OPTIONS}
            value={formDraft.statut}
            onChange={(e) => setFormDraft((d) => ({ ...d, statut: e.target.value }))}
          />
          <TextField
            label={t("bo.proprietaireLots.valorisationLabel")}
            name="valorisation"
            type="number"
            step="0.01"
            min="0"
            value={formDraft.valorisation}
            onChange={(e) => setFormDraft((d) => ({ ...d, valorisation: e.target.value }))}
            placeholder={t("bo.proprietaireLots.valorisationPlaceholder")}
            hint={t("bo.proprietaireLots.optionalHint")}
          />

          <label className={styles.field} style={{ display: "block", marginTop: "0.9rem" }}>
            {t("bo.proprietaireLots.photosLabel")}
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
                            ? "bo.proprietaireLots.restorePhotoTitle"
                            : "bo.proprietaireLots.removePhotoTitle"
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
                      title={t("bo.proprietaireLots.removeStagedTitle")}
                    >
                      <i className="bi bi-x" />
                    </button>
                  </div>
                ))}
            </div>
            <label className={styles.photoUpload}>
              <i className="bi bi-camera-fill" />
              {photoBusy ? t("bo.proprietaireLots.uploading") : t("bo.proprietaireLots.addPhotos")}
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
        title={t("bo.proprietaireLots.deleteConfirmTitle")}
        message={
          deleteTarget
            ? t("bo.proprietaireLots.deleteConfirmMessage", { name: deleteTarget.reference || `Lot #${deleteTarget.id}` })
            : ""
        }
        confirmLabel={t("bo.proprietaireLots.deleteConfirmLabel")}
        danger
        isBusy={deleteBusy}
        error={deleteError}
      />

      <LotDetailsModal
        lot={detailsTarget}
        onClose={() => setDetailsTarget(null)}
        bien={detailsTarget ? biens.find((b) => b.id === detailsTarget.bien_id) : null}
        categorieName={detailsTarget?.categorie_id ? categoryName(detailsTarget.categorie_id) : null}
        bail={detailsTarget ? currentBailForLot(detailsTarget.id) : null}
      />
    </div>
  );
}
