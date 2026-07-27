"use client";

import { useRef, useState, useEffect } from "react";
import { extractErrorMessage, API_BASE_URL } from "@/lib/apiClient";
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

function logoSrc(logo) {
  if (!logo) return null;
  return logo.startsWith("http") ? logo : `${API_BASE_URL}${logo}`;
}

const EMPTY_PARTNER_FORM = {
  nom: "",
  description: "",
  site_web: "",
  email: "",
  telephone: "",
  adresse: "",
  statut: PARTENAIRE_STATUS.ACTIF,
};

export default function AdminPartenairesPage() {
  const [partenaires, setPartenaires] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

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
        const partenairesData = await fetchPartenaires();
        setPartenaires(partenairesData);
      } catch (err) {
        setLoadError(extractErrorMessage(err));
      } finally {
        setIsLoading(false);
      }
    }
    init();
  }, []);

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
