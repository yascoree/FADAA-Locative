"use client";

import { useEffect, useMemo, useState } from "react";
import { extractErrorMessage } from "@/lib/apiClient";
import { fetchCategories, createCategorie, updateCategorie, deleteCategorie, fetchBiens } from "@/lib/properties";
import Modal from "@/components/Modal";
import ConfirmationDialog from "@/components/ConfirmationDialog";
import TextField from "@/components/TextField";
import styles from "../admin.module.css";

function Banner({ banner }) {
  if (!banner) return null;
  return (
    <div className={`${styles.banner} ${banner.type === "success" ? styles.bannerSuccess : styles.bannerError}`}>
      {banner.message}
    </div>
  );
}

const EMPTY_CATEGORY_FORM = { libelle: "", description: "" };

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState([]);
  const [biens, setBiens] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const [catFormOpen, setCatFormOpen] = useState(false);
  const [catFormMode, setCatFormMode] = useState("create");
  const [catFormTargetId, setCatFormTargetId] = useState(null);
  const [catFormDraft, setCatFormDraft] = useState(EMPTY_CATEGORY_FORM);
  const [catFormBusy, setCatFormBusy] = useState(false);
  const [catFormBanner, setCatFormBanner] = useState(null);
  const [catDeleteTarget, setCatDeleteTarget] = useState(null);
  const [catDeleteBusy, setCatDeleteBusy] = useState(false);
  const [catDeleteError, setCatDeleteError] = useState(null);

  useEffect(() => {
    async function init() {
      setIsLoading(true);
      try {
        const [categoriesList, biensList] = await Promise.all([fetchCategories(), fetchBiens()]);
        setCategories(categoriesList);
        setBiens(biensList);
      } catch (err) {
        setLoadError(extractErrorMessage(err));
      } finally {
        setIsLoading(false);
      }
    }
    init();
  }, []);

  const usageCount = useMemo(() => {
    const map = new Map();
    biens.forEach((b) => map.set(b.categorie_id, (map.get(b.categorie_id) || 0) + 1));
    return map;
  }, [biens]);

  const catDeleteTargetCount = catDeleteTarget ? usageCount.get(catDeleteTarget.id) || 0 : 0;
  const catFormTargetCount = catFormTargetId ? usageCount.get(catFormTargetId) || 0 : 0;
  const libelleLocked = catFormMode === "edit" && catFormTargetCount > 0;

  function openCreateCategory() {
    setCatFormMode("create");
    setCatFormTargetId(null);
    setCatFormDraft(EMPTY_CATEGORY_FORM);
    setCatFormBanner(null);
    setCatFormOpen(true);
  }

  function openEditCategory(cat) {
    setCatFormMode("edit");
    setCatFormTargetId(cat.id);
    setCatFormDraft({ libelle: cat.libelle, description: cat.description || "" });
    setCatFormBanner(null);
    setCatFormOpen(true);
  }

  function closeCategoryForm() {
    if (catFormBusy) return;
    setCatFormOpen(false);
  }

  async function handleSubmitCategoryForm(e) {
    e.preventDefault();
    setCatFormBusy(true);
    setCatFormBanner(null);
    try {
      if (catFormMode === "create") {
        const created = await createCategorie({ libelle: catFormDraft.libelle, description: catFormDraft.description });
        setCategories((prev) => [...prev, created]);
      } else {
        const updated = await updateCategorie(catFormTargetId, {
          libelle: catFormDraft.libelle,
          description: catFormDraft.description || null,
        });
        setCategories((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      }
      setCatFormOpen(false);
    } catch (err) {
      setCatFormBanner({ type: "error", message: extractErrorMessage(err) });
    } finally {
      setCatFormBusy(false);
    }
  }

  async function handleConfirmDeleteCategory() {
    if (!catDeleteTarget) return;
    setCatDeleteBusy(true);
    setCatDeleteError(null);
    try {
      await deleteCategorie(catDeleteTarget.id);
      setCategories((prev) => prev.filter((c) => c.id !== catDeleteTarget.id));
      setCatDeleteTarget(null);
    } catch (err) {
      setCatDeleteError(extractErrorMessage(err));
    } finally {
      setCatDeleteBusy(false);
    }
  }

  if (isLoading) {
    return <p>Chargement...</p>;
  }

  return (
    <div>
      <Banner banner={loadError ? { type: "error", message: loadError } : null} />

      <div className={styles.section} style={{ marginBottom: 0 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem" }}>
          <div>
            <h2 className={styles.sectionTitle}>
              <i className="bi bi-diagram-3" style={{ marginRight: "0.5rem", color: "var(--primary)" }} />
              Catégories de biens
            </h2>
            <p className={styles.sectionSubtitle}>
              Référentiel partagé utilisé par tous les propriétaires/gestionnaires pour classer leurs biens
              (Appartement, Villa, Studio...). Lecture libre, création/modification/suppression réservées aux
              admins.
            </p>
          </div>
          <button type="button" className={styles.btn} onClick={openCreateCategory}>
            <i className="bi bi-plus-lg" />
            Nouvelle catégorie
          </button>
        </div>

        {catDeleteError && <Banner banner={{ type: "error", message: catDeleteError }} />}

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Libellé</th>
                <th>Description</th>
                <th>Biens</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {categories.length === 0 && (
                <tr>
                  <td colSpan={4} className={styles.empty}>
                    Aucune catégorie. Créez-en une pour que les propriétaires puissent classer leurs biens.
                  </td>
                </tr>
              )}
              {categories.map((cat) => {
                const count = usageCount.get(cat.id) || 0;
                return (
                  <tr key={cat.id}>
                    <td>
                      <span className={styles.userName}>{cat.libelle}</span>
                    </td>
                    <td>{cat.description || "—"}</td>
                    <td>{count}</td>
                    <td>
                      <div className={styles.tableActions}>
                        <button
                          type="button"
                          className={styles.iconBtn}
                          onClick={() => openEditCategory(cat)}
                          title="Modifier"
                        >
                          <i className="bi bi-pencil" />
                        </button>
                        <button
                          type="button"
                          className={styles.iconBtn}
                          onClick={() => {
                            setCatDeleteError(null);
                            setCatDeleteTarget(cat);
                          }}
                          title={count > 0 ? "Utilisée par des biens existants" : "Supprimer"}
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
        </div>
      </div>

      <Modal
        isOpen={catFormOpen}
        onClose={closeCategoryForm}
        title={catFormMode === "create" ? "Nouvelle catégorie" : "Modifier la catégorie"}
      >
        <form onSubmit={handleSubmitCategoryForm}>
          <Banner banner={catFormBanner} />
          <TextField
            label="Libellé"
            name="libelle"
            value={catFormDraft.libelle}
            onChange={(e) => setCatFormDraft((d) => ({ ...d, libelle: e.target.value }))}
            placeholder="Ex : Appartement, Villa, Studio..."
            required
            disabled={libelleLocked}
            hint={libelleLocked ? "Utilisée par des biens existants : le libellé ne peut plus être modifié." : undefined}
          />
          <TextField
            label="Description (optionnel)"
            name="description"
            value={catFormDraft.description}
            onChange={(e) => setCatFormDraft((d) => ({ ...d, description: e.target.value }))}
          />

          <div className={styles.editActions} style={{ marginTop: "1.2rem" }}>
            <button type="submit" className={styles.btn} disabled={catFormBusy}>
              <i className="bi bi-check-lg" />
              {catFormBusy ? "Enregistrement..." : "Enregistrer"}
            </button>
            <button type="button" className={styles.btnOutline} onClick={closeCategoryForm} disabled={catFormBusy}>
              <i className="bi bi-x-lg" />
              Annuler
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmationDialog
        isOpen={!!catDeleteTarget}
        onClose={() => setCatDeleteTarget(null)}
        onConfirm={handleConfirmDeleteCategory}
        title="Supprimer la catégorie"
        message={
          catDeleteTarget
            ? catDeleteTargetCount > 0
              ? `Impossible de supprimer "${catDeleteTarget.libelle}" : cette catégorie est liée à ${catDeleteTargetCount} bien${catDeleteTargetCount > 1 ? "s" : ""} existant${catDeleteTargetCount > 1 ? "s" : ""}.`
              : `Supprimer définitivement la catégorie "${catDeleteTarget.libelle}" ?`
            : ""
        }
        confirmLabel="Supprimer"
        danger
        isBusy={catDeleteBusy}
        hideConfirm={catDeleteTargetCount > 0}
      />
    </div>
  );
}
