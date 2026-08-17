"use client";

import { useEffect, useMemo, useState } from "react";
import { extractErrorMessage } from "@/lib/apiClient";
import { fetchBaux, fetchBiens, BAIL_STATUS } from "@/lib/properties";
import {
  fetchDemandesMaintenance,
  createDemandeMaintenance,
  MAINTENANCE_STATUS,
  MAINTENANCE_STATUS_LABELS,
} from "@/lib/maintenance";
import StatCard from "@/components/StatCard";
import Modal from "@/components/Modal";
import TextField from "@/components/TextField";
import SelectField from "@/components/SelectField";
import { useLanguage } from "@/context/LanguageContext";
import styles from "../locataire.module.css";

function Banner({ banner }) {
  if (!banner) return null;
  return (
    <div className={`${styles.banner} ${banner.type === "success" ? styles.bannerSuccess : styles.bannerError}`}>
      {banner.message}
    </div>
  );
}

function badgeClass(statut) {
  if (statut === MAINTENANCE_STATUS.RESOLUE) return styles.badgeActive;
  if (statut === MAINTENANCE_STATUS.REJETEE) return styles.badgeDanger;
  if (statut === MAINTENANCE_STATUS.EN_COURS) return styles.badgeWarning;
  return styles.badgeNeutral;
}

function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
}

const EMPTY_FORM = { bail_id: "", titre: "", description: "" };

export default function LocataireMaintenancePage() {
  const { t } = useLanguage();
  const [demandes, setDemandes] = useState([]);
  const [baux, setBaux] = useState([]);
  const [biens, setBiens] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [createDraft, setCreateDraft] = useState(EMPTY_FORM);
  const [createBusy, setCreateBusy] = useState(false);
  const [createBanner, setCreateBanner] = useState(null);

  useEffect(() => {
    async function init() {
      setIsLoading(true);
      try {
        const [demandesList, bauxList, biensList] = await Promise.all([
          fetchDemandesMaintenance(),
          fetchBaux(),
          fetchBiens(),
        ]);
        setDemandes(demandesList);
        setBaux(bauxList);
        setBiens(biensList);
      } catch (err) {
        setLoadError(extractErrorMessage(err));
      } finally {
        setIsLoading(false);
      }
    }
    init();
  }, []);

  function bienLotLabel(bail) {
    if (!bail?.lot) return "—";
    const bien = biens.find((b) => b.id === bail.lot.bien_id);
    const bienName = bien?.designation || `Bien #${bail.lot.bien_id}`;
    return `${bienName} — ${bail.lot.reference || `Lot #${bail.lot_id}`}`;
  }

  const activeBaux = useMemo(() => baux.filter((b) => b.statut === BAIL_STATUS.ACTIF), [baux]);

  const stats = useMemo(
    () => ({
      total: demandes.length,
      enCours: demandes.filter((d) => d.statut === MAINTENANCE_STATUS.NOUVELLE || d.statut === MAINTENANCE_STATUS.EN_COURS)
        .length,
      resolues: demandes.filter((d) => d.statut === MAINTENANCE_STATUS.RESOLUE).length,
    }),
    [demandes]
  );

  function openCreate() {
    setCreateDraft({ ...EMPTY_FORM, bail_id: activeBaux[0] ? String(activeBaux[0].id) : "" });
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
      const created = await createDemandeMaintenance({
        bailId: Number(createDraft.bail_id),
        titre: createDraft.titre.trim(),
        description: createDraft.description.trim(),
      });
      setDemandes((prev) => [created, ...prev]);
      setCreateOpen(false);
    } catch (err) {
      setCreateBanner({ type: "error", message: extractErrorMessage(err) });
    } finally {
      setCreateBusy(false);
    }
  }

  if (isLoading) {
    return <p>{t("bo.common.loading")}</p>;
  }

  return (
    <div>
      <Banner banner={loadError ? { type: "error", message: loadError } : null} />

      <div className={styles.section}>
        <div className={styles.statsGrid}>
          <StatCard icon="bi-tools" tone="primary" label={t("bo.locataireMaintenance.statTotal")} value={stats.total} />
          <StatCard icon="bi-hourglass-split" tone="warning" label={t("bo.locataireMaintenance.statOpen")} value={stats.enCours} />
          <StatCard icon="bi-check-circle-fill" tone="accent" label={t("bo.locataireMaintenance.statResolved")} value={stats.resolues} />
        </div>
      </div>

      <div className={styles.section} style={{ marginBottom: 0 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem" }}>
          <div>
            <h2 className={styles.sectionTitle}>
              <i className="bi bi-tools" style={{ marginRight: "0.5rem", color: "var(--primary)" }} />
              {t("bo.locataireMaintenance.title")}
            </h2>
            <p className={styles.sectionSubtitle}>{t("bo.locataireMaintenance.subtitle")}</p>
          </div>
          <button
            type="button"
            className={styles.btn}
            onClick={openCreate}
            disabled={activeBaux.length === 0}
            title={activeBaux.length === 0 ? t("bo.locataireMaintenance.noActiveLease") : undefined}
          >
            <i className="bi bi-plus-lg" />
            {t("bo.locataireMaintenance.newRequest")}
          </button>
        </div>

        {demandes.length === 0 && <p className={styles.empty}>{t("bo.locataireMaintenance.noRequests")}</p>}

        <div className={styles.reclamationList}>
          {demandes.map((d) => (
            <div className={styles.reclamationCard} key={d.id}>
              <div className={styles.reclamationHeader}>
                <span className={styles.userName}>{d.titre}</span>
                <span className={`${styles.badge} ${badgeClass(d.statut)}`}>
                  {MAINTENANCE_STATUS_LABELS[d.statut]}
                </span>
              </div>
              <p className={styles.reclamationMessage}>{d.description}</p>
              <div className={styles.reclamationMeta}>
                {bienLotLabel(d.bail)} · {formatDate(d.date_creation)}
              </div>
              {d.reponse && (
                <div className={styles.messageQuoteCard} style={{ marginTop: "0.6rem" }}>
                  <p className={styles.messageQuoteText}>
                    <strong>{t("bo.locataireMaintenance.responseLabel")}</strong> {d.reponse}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <Modal isOpen={createOpen} onClose={closeCreate} title={t("bo.locataireMaintenance.createTitle")}>
        <form onSubmit={handleSubmitCreate}>
          <Banner banner={createBanner} />
          {activeBaux.length > 1 && (
            <SelectField
              label={t("bo.locataireMaintenance.leaseLabel")}
              name="bail_id"
              options={activeBaux.map((b) => ({ value: b.id, label: bienLotLabel(b) }))}
              value={createDraft.bail_id}
              onChange={(e) => setCreateDraft((d) => ({ ...d, bail_id: e.target.value }))}
              required
            />
          )}
          <TextField
            label={t("bo.locataireMaintenance.subjectLabel")}
            name="titre"
            value={createDraft.titre}
            onChange={(e) => setCreateDraft((d) => ({ ...d, titre: e.target.value }))}
            placeholder={t("bo.locataireMaintenance.subjectPlaceholder")}
            required
          />
          <TextField
            label={t("bo.locataireMaintenance.descriptionLabel")}
            name="description"
            as="textarea"
            rows={4}
            value={createDraft.description}
            onChange={(e) => setCreateDraft((d) => ({ ...d, description: e.target.value }))}
            placeholder={t("bo.locataireMaintenance.descriptionPlaceholder")}
            required
          />

          <div className={styles.editActions} style={{ marginTop: "1.2rem" }}>
            <button type="submit" className={styles.btn} disabled={createBusy}>
              <i className="bi bi-check-lg" />
              {createBusy ? t("bo.common.saving") : t("bo.locataireMaintenance.submit")}
            </button>
            <button type="button" className={styles.btnOutline} onClick={closeCreate} disabled={createBusy}>
              <i className="bi bi-x-lg" />
              {t("bo.common.cancel")}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
