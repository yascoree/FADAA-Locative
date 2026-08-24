"use client";

import { useEffect, useMemo, useState } from "react";
import { extractErrorMessage } from "@/lib/apiClient";
import { fetchBiens } from "@/lib/properties";
import { fetchGestionnairePermissionIndex } from "@/lib/mandates";
import {
  fetchDemandesMaintenance,
  updateDemandeMaintenance,
  MAINTENANCE_STATUS,
  MAINTENANCE_STATUS_LABELS,
} from "@/lib/maintenance";
import StatCard from "@/components/StatCard";
import Modal from "@/components/Modal";
import TextField from "@/components/TextField";
import SelectField from "@/components/SelectField";
import LoadingState from "@/components/LoadingState";
import EmptyState from "@/components/EmptyState";
import { useLanguage } from "@/context/LanguageContext";
import { useAgencyPortfolio } from "@/context/AgencyPortfolioContext";
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
  if (statut === MAINTENANCE_STATUS.RESOLUE) return styles.badgeActive;
  if (statut === MAINTENANCE_STATUS.REJETEE) return styles.badgeDanger;
  if (statut === MAINTENANCE_STATUS.EN_COURS) return styles.badgeWarning;
  return styles.badgeNeutral;
}

function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
}

const RESPOND_STATUS_OPTIONS = [
  { value: String(MAINTENANCE_STATUS.EN_COURS), label: MAINTENANCE_STATUS_LABELS[MAINTENANCE_STATUS.EN_COURS] },
  { value: String(MAINTENANCE_STATUS.RESOLUE), label: MAINTENANCE_STATUS_LABELS[MAINTENANCE_STATUS.RESOLUE] },
  { value: String(MAINTENANCE_STATUS.REJETEE), label: MAINTENANCE_STATUS_LABELS[MAINTENANCE_STATUS.REJETEE] },
];

export default function AgenceMaintenancePage() {
  const { t } = useLanguage();
  const [demandes, setDemandes] = useState([]);
  const [biens, setBiens] = useState([]);
  const [permIndex, setPermIndex] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const [respondTarget, setRespondTarget] = useState(null);
  const [respondDraft, setRespondDraft] = useState({ statut: "", reponse: "" });
  const [respondBusy, setRespondBusy] = useState(false);
  const [respondBanner, setRespondBanner] = useState(null);

  const { selectedClientId } = useAgencyPortfolio();

  useEffect(() => {
    async function init() {
      setIsLoading(true);
      try {
        const params = selectedClientId ? { proprietaire_id: selectedClientId } : {};
        const [demandesList, biensList, permissionIndex] = await Promise.all([
          fetchDemandesMaintenance(params),
          fetchBiens(params),
          fetchGestionnairePermissionIndex(),
        ]);
        setDemandes(demandesList);
        setBiens(biensList);
        setPermIndex(permissionIndex);
      } catch (err) {
        setLoadError(extractErrorMessage(err));
      } finally {
        setIsLoading(false);
      }
    }
    init();
  }, [selectedClientId]);

  function bienLotLabel(bail) {
    if (!bail?.lot) return "—";
    const bien = biens.find((b) => b.id === bail.lot.bien_id);
    const bienName = bien?.designation || `Bien #${bail.lot.bien_id}`;
    return `${bienName} — ${bail.lot.reference || `Lot #${bail.lot_id}`}`;
  }

  function canRespond(demande) {
    const bienId = demande.bail?.lot?.bien_id;
    const bien = biens.find((b) => b.id === bienId);
    if (!bien) return false;
    return permIndex?.hasForBien(bienId, bien.proprietaire_id, "UPDATE_LEASE");
  }

  const stats = useMemo(
    () => ({
      total: demandes.length,
      nouvelles: demandes.filter((d) => d.statut === MAINTENANCE_STATUS.NOUVELLE).length,
      enCours: demandes.filter((d) => d.statut === MAINTENANCE_STATUS.EN_COURS).length,
      resolues: demandes.filter((d) => d.statut === MAINTENANCE_STATUS.RESOLUE).length,
    }),
    [demandes]
  );

  function openRespond(demande) {
    setRespondTarget(demande);
    setRespondDraft({ statut: String(MAINTENANCE_STATUS.EN_COURS), reponse: demande.reponse || "" });
    setRespondBanner(null);
  }

  function closeRespond() {
    if (respondBusy) return;
    setRespondTarget(null);
  }

  async function handleSubmitRespond(e) {
    e.preventDefault();
    if (!respondTarget) return;
    setRespondBusy(true);
    setRespondBanner(null);
    try {
      const updated = await updateDemandeMaintenance(respondTarget.id, {
        statut: Number(respondDraft.statut),
        reponse: respondDraft.reponse.trim() || null,
      });
      setDemandes((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
      setRespondTarget(null);
    } catch (err) {
      setRespondBanner({ type: "error", message: extractErrorMessage(err) });
    } finally {
      setRespondBusy(false);
    }
  }

  if (isLoading) {
    return <LoadingState label={t("bo.common.loading")} />;
  }

  return (
    <div>
      <Banner banner={loadError ? { type: "error", message: loadError } : null} />

      <div className={styles.section}>
        <div className={styles.statsGrid}>
          <StatCard icon="bi-tools" tone="primary" label={t("bo.proprietaireMaintenance.statTotal")} value={stats.total} />
          <StatCard icon="bi-exclamation-circle" tone="danger" label={t("bo.proprietaireMaintenance.statNew")} value={stats.nouvelles} />
          <StatCard icon="bi-hourglass-split" tone="warning" label={t("bo.proprietaireMaintenance.statOpen")} value={stats.enCours} />
          <StatCard icon="bi-check-circle-fill" tone="accent" label={t("bo.proprietaireMaintenance.statResolved")} value={stats.resolues} />
        </div>
      </div>

      <div className={styles.section} style={{ marginBottom: 0 }}>
        <h2 className={styles.sectionTitle}>
          <i className="bi bi-tools" style={{ marginRight: "0.5rem", color: "var(--primary)" }} />
          {t("bo.proprietaireMaintenance.title")}
        </h2>
        <p className={styles.sectionSubtitle}>{t("bo.proprietaireMaintenance.subtitle")}</p>

        {demandes.length === 0 && <EmptyState icon="bi-tools" title={t("bo.proprietaireMaintenance.noRequests")} />}

        <div className={styles.reclamationList}>
          {demandes.map((d) => {
            const closed = d.statut === MAINTENANCE_STATUS.RESOLUE || d.statut === MAINTENANCE_STATUS.REJETEE;
            return (
              <div className={styles.reclamationCard} key={d.id}>
                <div className={styles.reclamationHeader}>
                  <div>
                    <span className={styles.userName}>{d.titre}</span>
                    {d.locataire && (
                      <div className={styles.recentEmail}>
                        {d.locataire.prenom} {d.locataire.nom} · {bienLotLabel(d.bail)}
                      </div>
                    )}
                  </div>
                  <span className={`${styles.badge} ${badgeClass(d.statut)}`}>
                    {MAINTENANCE_STATUS_LABELS[d.statut]}
                  </span>
                </div>
                <p className={styles.reclamationMessage}>{d.description}</p>
                <div className={styles.reclamationMeta}>{formatDate(d.date_creation)}</div>

                {d.reponse && (
                  <div className={styles.messageQuoteCard} style={{ marginTop: "0.6rem" }}>
                    <p className={styles.messageQuoteText}>
                      <strong>{t("bo.proprietaireMaintenance.responseLabel")}</strong> {d.reponse}
                    </p>
                  </div>
                )}

                {!closed && canRespond(d) && (
                  <div className={styles.reclamationActions}>
                    <button type="button" className={styles.btn} onClick={() => openRespond(d)}>
                      <i className="bi bi-reply-fill" />
                      {t("bo.proprietaireMaintenance.respond")}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <Modal isOpen={!!respondTarget} onClose={closeRespond} title={t("bo.proprietaireMaintenance.respondTitle")}>
        {respondTarget && (
          <form onSubmit={handleSubmitRespond}>
            <Banner banner={respondBanner} />
            <p className={styles.sectionSubtitle} style={{ marginTop: 0 }}>
              {respondTarget.titre}
            </p>
            <SelectField
              label={t("bo.proprietaireMaintenance.statusLabel")}
              name="statut"
              options={RESPOND_STATUS_OPTIONS}
              value={respondDraft.statut}
              onChange={(e) => setRespondDraft((d) => ({ ...d, statut: e.target.value }))}
              required
            />
            <TextField
              label={t("bo.proprietaireMaintenance.responseFieldLabel")}
              name="reponse"
              as="textarea"
              rows={4}
              value={respondDraft.reponse}
              onChange={(e) => setRespondDraft((d) => ({ ...d, reponse: e.target.value }))}
              placeholder={t("bo.proprietaireMaintenance.responsePlaceholder")}
              hint={t("bo.proprietaireMaintenance.optionalHint")}
            />

            <div className={styles.editActions} style={{ marginTop: "1.2rem" }}>
              <button type="submit" className={styles.btn} disabled={respondBusy}>
                <i className="bi bi-check-lg" />
                {respondBusy ? t("bo.common.saving") : t("bo.common.save")}
              </button>
              <button type="button" className={styles.btnOutline} onClick={closeRespond} disabled={respondBusy}>
                <i className="bi bi-x-lg" />
                {t("bo.common.cancel")}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
