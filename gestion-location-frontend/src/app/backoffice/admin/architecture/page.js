"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { extractErrorMessage, API_BASE_URL } from "@/lib/apiClient";
import { fetchCategories, createCategorie, updateCategorie, deleteCategorie, fetchBiens } from "@/lib/properties";
import { fetchAvis, updateAvisStatut, deleteAvis, AVIS_STATUS, AVIS_STATUS_LABELS } from "@/lib/avis";
import {
  fetchPartenaires,
  createPartenaire,
  updatePartenaire,
  deletePartenaire,
  uploadPartenaireLogo,
  PARTENAIRE_STATUS,
  PARTENAIRE_STATUS_LABELS,
} from "@/lib/partenaires";
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

function Stars({ note }) {
  return (
    <span className={styles.starRow}>
      {[1, 2, 3, 4, 5].map((n) => (
        <i key={n} className={`bi ${n <= note ? "bi-star-fill" : "bi-star"}`} />
      ))}
    </span>
  );
}

function avisBadgeClass(statut) {
  if (statut === AVIS_STATUS.PUBLIE) return styles.badgeActive;
  if (statut === AVIS_STATUS.REJETE) return styles.badgeExpired;
  return styles.badgeSuspended;
}

function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
}

function logoSrc(logo) {
  if (!logo) return null;
  return logo.startsWith("http") ? logo : `${API_BASE_URL}${logo}`;
}

const EMPTY_CATEGORY_FORM = { libelle: "", description: "" };
const EMPTY_PARTNER_FORM = {
  nom: "",
  description: "",
  site_web: "",
  email: "",
  telephone: "",
  adresse: "",
  statut: PARTENAIRE_STATUS.ACTIF,
};

const TABS = [
  { key: "categories", label: "Catégories de biens", icon: "bi-diagram-3" },
  { key: "avis", label: "Avis", icon: "bi-chat-square-quote" },
  { key: "partenaires", label: "Partenaires", icon: "bi-handshake" },
];

export default function AdminArchitecturePage() {
  const [activeTab, setActiveTab] = useState("categories");
  const tabRefs = useRef({});
  const [tabIndicator, setTabIndicator] = useState(null);

  const [categories, setCategories] = useState([]);
  const [biens, setBiens] = useState([]);
  const [avisList, setAvisList] = useState([]);
  const [partenaires, setPartenaires] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    const el = tabRefs.current[activeTab];
    if (!el) return;
    setTabIndicator({ width: el.offsetWidth, left: el.offsetLeft });
  }, [activeTab, isLoading]);

  // ---- Catégories ----
  const [catFormOpen, setCatFormOpen] = useState(false);
  const [catFormMode, setCatFormMode] = useState("create");
  const [catFormTargetId, setCatFormTargetId] = useState(null);
  const [catFormDraft, setCatFormDraft] = useState(EMPTY_CATEGORY_FORM);
  const [catFormBusy, setCatFormBusy] = useState(false);
  const [catFormBanner, setCatFormBanner] = useState(null);
  const [catDeleteTarget, setCatDeleteTarget] = useState(null);
  const [catDeleteBusy, setCatDeleteBusy] = useState(false);
  const [catDeleteError, setCatDeleteError] = useState(null);

  // ---- Avis ----
  const [avisBanner, setAvisBanner] = useState(null);
  const [avisBusyId, setAvisBusyId] = useState(null);
  const [avisDeleteTarget, setAvisDeleteTarget] = useState(null);
  const [avisDeleteBusy, setAvisDeleteBusy] = useState(false);

  // ---- Partenaires ----
  const [partnerFormOpen, setPartnerFormOpen] = useState(false);
  const [partnerFormMode, setPartnerFormMode] = useState("create");
  const [partnerFormTargetId, setPartnerFormTargetId] = useState(null);
  const [partnerFormDraft, setPartnerFormDraft] = useState(EMPTY_PARTNER_FORM);
  const [partnerFormBusy, setPartnerFormBusy] = useState(false);
  const [partnerFormBanner, setPartnerFormBanner] = useState(null);
  const [partnerDeleteTarget, setPartnerDeleteTarget] = useState(null);
  const [partnerDeleteBusy, setPartnerDeleteBusy] = useState(false);
  const [logoUploadingId, setLogoUploadingId] = useState(null);
  const [partnerBanner, setPartnerBanner] = useState(null);
  const fileInputRefs = useRef({});

  useEffect(() => {
    async function init() {
      setIsLoading(true);
      try {
        const [categoriesList, biensList, avisData, partenairesData] = await Promise.all([
          fetchCategories(),
          fetchBiens(),
          fetchAvis(),
          fetchPartenaires(),
        ]);
        setCategories(categoriesList);
        setBiens(biensList);
        setAvisList(avisData);
        setPartenaires(partenairesData);
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

  const pendingAvisCount = useMemo(
    () => avisList.filter((a) => a.statut === AVIS_STATUS.EN_ATTENTE).length,
    [avisList]
  );

  // ---- Catégories : handlers ----
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

  // ---- Avis : handlers ----
  async function handleAvisStatut(avis, statut) {
    setAvisBanner(null);
    setAvisBusyId(avis.id);
    try {
      const updated = await updateAvisStatut(avis.id, statut);
      setAvisList((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
    } catch (err) {
      setAvisBanner({ type: "error", message: extractErrorMessage(err) });
    } finally {
      setAvisBusyId(null);
    }
  }

  async function handleConfirmDeleteAvis() {
    if (!avisDeleteTarget) return;
    setAvisDeleteBusy(true);
    try {
      await deleteAvis(avisDeleteTarget.id);
      setAvisList((prev) => prev.filter((a) => a.id !== avisDeleteTarget.id));
      setAvisDeleteTarget(null);
    } catch (err) {
      setAvisBanner({ type: "error", message: extractErrorMessage(err) });
    } finally {
      setAvisDeleteBusy(false);
    }
  }

  // ---- Partenaires : handlers ----
  function openCreatePartner() {
    setPartnerFormMode("create");
    setPartnerFormTargetId(null);
    setPartnerFormDraft(EMPTY_PARTNER_FORM);
    setPartnerFormBanner(null);
    setPartnerFormOpen(true);
  }

  function openEditPartner(p) {
    setPartnerFormMode("edit");
    setPartnerFormTargetId(p.id);
    setPartnerFormDraft({
      nom: p.nom,
      description: p.description || "",
      site_web: p.site_web || "",
      email: p.email || "",
      telephone: p.telephone || "",
      adresse: p.adresse || "",
      statut: p.statut,
    });
    setPartnerFormBanner(null);
    setPartnerFormOpen(true);
  }

  function closePartnerForm() {
    if (partnerFormBusy) return;
    setPartnerFormOpen(false);
  }

  async function handleSubmitPartnerForm(e) {
    e.preventDefault();
    setPartnerFormBusy(true);
    setPartnerFormBanner(null);
    const payload = {
      nom: partnerFormDraft.nom,
      description: partnerFormDraft.description || null,
      site_web: partnerFormDraft.site_web || null,
      email: partnerFormDraft.email || null,
      telephone: partnerFormDraft.telephone || null,
      adresse: partnerFormDraft.adresse || null,
      statut: Number(partnerFormDraft.statut),
    };
    try {
      if (partnerFormMode === "create") {
        const created = await createPartenaire(payload);
        setPartenaires((prev) => [...prev, created]);
      } else {
        const updated = await updatePartenaire(partnerFormTargetId, payload);
        setPartenaires((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      }
      setPartnerFormOpen(false);
    } catch (err) {
      setPartnerFormBanner({ type: "error", message: extractErrorMessage(err) });
    } finally {
      setPartnerFormBusy(false);
    }
  }

  async function handleConfirmDeletePartner() {
    if (!partnerDeleteTarget) return;
    setPartnerDeleteBusy(true);
    try {
      await deletePartenaire(partnerDeleteTarget.id);
      setPartenaires((prev) => prev.filter((p) => p.id !== partnerDeleteTarget.id));
      setPartnerDeleteTarget(null);
    } catch (err) {
      setPartnerBanner({ type: "error", message: extractErrorMessage(err) });
    } finally {
      setPartnerDeleteBusy(false);
    }
  }

  async function handleToggleActive(p) {
    setPartnerBanner(null);
    try {
      const updated = await updatePartenaire(p.id, {
        statut: p.statut === PARTENAIRE_STATUS.ACTIF ? PARTENAIRE_STATUS.INACTIF : PARTENAIRE_STATUS.ACTIF,
      });
      setPartenaires((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
    } catch (err) {
      setPartnerBanner({ type: "error", message: extractErrorMessage(err) });
    }
  }

  function triggerLogoUpload(partnerId) {
    fileInputRefs.current[partnerId]?.click();
  }

  async function handleLogoChange(partnerId, e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setPartnerBanner(null);
    setLogoUploadingId(partnerId);
    try {
      const updated = await uploadPartenaireLogo(partnerId, file);
      setPartenaires((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    } catch (err) {
      setPartnerBanner({ type: "error", message: extractErrorMessage(err) });
    } finally {
      setLogoUploadingId(null);
    }
  }

  if (isLoading) {
    return <p>Chargement...</p>;
  }

  return (
    <div>
      <Banner banner={loadError ? { type: "error", message: loadError } : null} />

      {/* ---- Sous-navigation Architecture ---- */}
      <div className={styles.archTabs}>
        {tabIndicator && (
          <span
            className={styles.archTabBubble}
            style={{ width: `${tabIndicator.width}px`, transform: `translateX(${tabIndicator.left}px)` }}
          />
        )}
        {TABS.map((tab) => (
          <button
            key={tab.key}
            ref={(el) => {
              tabRefs.current[tab.key] = el;
            }}
            type="button"
            className={`${styles.archTab} ${activeTab === tab.key ? styles.archTabActive : ""}`}
            onClick={() => setActiveTab(tab.key)}
          >
            <i className={`bi ${tab.icon}`} />
            {tab.label}
            {tab.key === "avis" && pendingAvisCount > 0 && (
              <span className={styles.archTabBadge}>{pendingAvisCount}</span>
            )}
          </button>
        ))}
      </div>

      {/* ==================== Catégories de biens ==================== */}
      {activeTab === "categories" && (
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
                            disabled={count > 0}
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
      )}

      {/* ==================== Avis ==================== */}
      {activeTab === "avis" && (
        <div className={styles.section} style={{ marginBottom: 0 }}>
          <h2 className={styles.sectionTitle}>
            <i className="bi bi-chat-square-quote" style={{ marginRight: "0.5rem", color: "var(--primary)" }} />
            Modération des avis
          </h2>
          <p className={styles.sectionSubtitle}>
            Approuvez les avis pour les afficher publiquement, rejetez ceux qui ne doivent pas apparaître, ou
            supprimez-les définitivement.
          </p>

          <Banner banner={avisBanner} />

          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Auteur</th>
                  <th>Note</th>
                  <th>Commentaire</th>
                  <th>Date</th>
                  <th>Statut</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {avisList.length === 0 && (
                  <tr>
                    <td colSpan={6} className={styles.empty}>
                      Aucun avis pour le moment.
                    </td>
                  </tr>
                )}
                {avisList.map((avis) => {
                  const busy = avisBusyId === avis.id;
                  return (
                    <tr key={avis.id}>
                      <td>
                        <span className={styles.userName}>
                          {avis.user ? `${avis.user.prenom} ${avis.user.nom}` : `Utilisateur #${avis.user_id}`}
                        </span>
                        {avis.user?.email && <div className={styles.tableSubtext}>{avis.user.email}</div>}
                      </td>
                      <td>
                        <Stars note={avis.note} />
                      </td>
                      <td style={{ maxWidth: 320 }}>{avis.commentaire || "—"}</td>
                      <td>{formatDate(avis.date_creation)}</td>
                      <td>
                        <span className={`${styles.badge} ${avisBadgeClass(avis.statut)}`}>
                          {AVIS_STATUS_LABELS[avis.statut]}
                        </span>
                      </td>
                      <td>
                        <div className={styles.tableActions}>
                          {avis.statut !== AVIS_STATUS.PUBLIE && (
                            <button
                              type="button"
                              className={styles.iconBtn}
                              onClick={() => handleAvisStatut(avis, AVIS_STATUS.PUBLIE)}
                              disabled={busy}
                              title="Approuver (afficher publiquement)"
                            >
                              <i className="bi bi-check-lg" />
                            </button>
                          )}
                          {avis.statut !== AVIS_STATUS.REJETE && (
                            <button
                              type="button"
                              className={styles.iconBtn}
                              onClick={() => handleAvisStatut(avis, AVIS_STATUS.REJETE)}
                              disabled={busy}
                              title="Rejeter (masquer)"
                            >
                              <i className="bi bi-eye-slash" />
                            </button>
                          )}
                          <button
                            type="button"
                            className={styles.iconBtn}
                            onClick={() => setAvisDeleteTarget(avis)}
                            title="Supprimer définitivement"
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
      )}

      {/* ==================== Partenaires ==================== */}
      {activeTab === "partenaires" && (
        <div className={styles.section} style={{ marginBottom: 0 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem" }}>
            <div>
              <h2 className={styles.sectionTitle}>
                <i className="bi bi-handshake" style={{ marginRight: "0.5rem", color: "var(--primary)" }} />
                Partenaires
              </h2>
              <p className={styles.sectionSubtitle}>
                Choisissez les partenaires mis en avant et gérez leur logo, affichés côté vitrine publique.
              </p>
            </div>
            <button type="button" className={styles.btn} onClick={openCreatePartner}>
              <i className="bi bi-plus-lg" />
              Nouveau partenaire
            </button>
          </div>

          <Banner banner={partnerBanner} />

          {partenaires.length === 0 && <p className={styles.empty}>Aucun partenaire pour le moment.</p>}

          <div className={styles.partnerGrid}>
            {partenaires.map((p) => {
              const src = logoSrc(p.logo);
              const uploading = logoUploadingId === p.id;
              return (
                <div className={styles.partnerCard} key={p.id}>
                  <div className={styles.partnerLogoWrap}>
                    {src ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={src} alt={p.nom} className={styles.partnerLogoImg} />
                    ) : (
                      <i className={`bi bi-building ${styles.partnerLogoPlaceholder}`} />
                    )}
                  </div>

                  <div>
                    <div className={styles.partnerName}>{p.nom}</div>
                    {p.description && <div className={styles.partnerMeta}>{p.description}</div>}
                    {p.site_web && <div className={styles.partnerMeta}>{p.site_web}</div>}
                  </div>

                  <span
                    className={`${styles.badge} ${p.statut === PARTENAIRE_STATUS.ACTIF ? styles.badgeActive : styles.badgeExpired}`}
                  >
                    {PARTENAIRE_STATUS_LABELS[p.statut]}
                  </span>

                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    style={{ display: "none" }}
                    ref={(el) => {
                      fileInputRefs.current[p.id] = el;
                    }}
                    onChange={(e) => handleLogoChange(p.id, e)}
                  />

                  <div className={styles.partnerActions}>
                    <button
                      type="button"
                      className={styles.btnOutline}
                      onClick={() => triggerLogoUpload(p.id)}
                      disabled={uploading}
                    >
                      <i className="bi bi-image" />
                      {uploading ? "Envoi..." : "Logo"}
                    </button>
                    <button type="button" className={styles.iconBtn} onClick={() => openEditPartner(p)} title="Modifier">
                      <i className="bi bi-pencil" />
                    </button>
                    <button
                      type="button"
                      className={styles.iconBtn}
                      onClick={() => handleToggleActive(p)}
                      title={p.statut === PARTENAIRE_STATUS.ACTIF ? "Désactiver" : "Activer"}
                    >
                      <i className={`bi ${p.statut === PARTENAIRE_STATUS.ACTIF ? "bi-pause-circle" : "bi-play-circle"}`} />
                    </button>
                    <button
                      type="button"
                      className={styles.iconBtn}
                      onClick={() => setPartnerDeleteTarget(p)}
                      title="Supprimer"
                    >
                      <i className="bi bi-trash" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ---- Créer / modifier une catégorie ---- */}
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
        message={catDeleteTarget ? `Supprimer définitivement la catégorie "${catDeleteTarget.libelle}" ?` : ""}
        confirmLabel="Supprimer"
        danger
        isBusy={catDeleteBusy}
      />

      {/* ---- Suppression d'un avis ---- */}
      <ConfirmationDialog
        isOpen={!!avisDeleteTarget}
        onClose={() => setAvisDeleteTarget(null)}
        onConfirm={handleConfirmDeleteAvis}
        title="Supprimer l'avis"
        message="Supprimer définitivement cet avis ? Cette action est irréversible."
        confirmLabel="Supprimer"
        danger
        isBusy={avisDeleteBusy}
      />

      {/* ---- Créer / modifier un partenaire ---- */}
      <Modal
        isOpen={partnerFormOpen}
        onClose={closePartnerForm}
        title={partnerFormMode === "create" ? "Nouveau partenaire" : "Modifier le partenaire"}
      >
        <form onSubmit={handleSubmitPartnerForm}>
          <Banner banner={partnerFormBanner} />
          <TextField
            label="Nom"
            name="nom"
            value={partnerFormDraft.nom}
            onChange={(e) => setPartnerFormDraft((d) => ({ ...d, nom: e.target.value }))}
            required
          />
          <TextField
            label="Description (optionnel)"
            name="description"
            value={partnerFormDraft.description}
            onChange={(e) => setPartnerFormDraft((d) => ({ ...d, description: e.target.value }))}
          />
          <TextField
            label="Site web (optionnel)"
            name="site_web"
            value={partnerFormDraft.site_web}
            onChange={(e) => setPartnerFormDraft((d) => ({ ...d, site_web: e.target.value }))}
            placeholder="https://..."
          />
          <TextField
            label="Email (optionnel)"
            name="email"
            type="email"
            value={partnerFormDraft.email}
            onChange={(e) => setPartnerFormDraft((d) => ({ ...d, email: e.target.value }))}
          />
          <TextField
            label="Téléphone (optionnel)"
            name="telephone"
            value={partnerFormDraft.telephone}
            onChange={(e) => setPartnerFormDraft((d) => ({ ...d, telephone: e.target.value }))}
          />
          <TextField
            label="Adresse (optionnel)"
            name="adresse"
            value={partnerFormDraft.adresse}
            onChange={(e) => setPartnerFormDraft((d) => ({ ...d, adresse: e.target.value }))}
          />

          <div className={styles.editActions} style={{ marginTop: "1.2rem" }}>
            <button type="submit" className={styles.btn} disabled={partnerFormBusy}>
              <i className="bi bi-check-lg" />
              {partnerFormBusy ? "Enregistrement..." : "Enregistrer"}
            </button>
            <button type="button" className={styles.btnOutline} onClick={closePartnerForm} disabled={partnerFormBusy}>
              <i className="bi bi-x-lg" />
              Annuler
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmationDialog
        isOpen={!!partnerDeleteTarget}
        onClose={() => setPartnerDeleteTarget(null)}
        onConfirm={handleConfirmDeletePartner}
        title="Supprimer le partenaire"
        message={partnerDeleteTarget ? `Supprimer définitivement "${partnerDeleteTarget.nom}" ?` : ""}
        confirmLabel="Supprimer"
        danger
        isBusy={partnerDeleteBusy}
      />
    </div>
  );
}
