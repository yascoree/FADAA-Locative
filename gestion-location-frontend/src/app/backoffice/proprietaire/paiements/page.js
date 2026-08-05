"use client";

import { useEffect, useMemo, useState } from "react";
import { extractErrorMessage, isPlanLimitError } from "@/lib/apiClient";
import {
  fetchBiens,
  fetchEcheances,
  fetchPaiements,
  createPaiement,
  annulerPaiement,
  downloadQuittance,
  uploadPaiementJustificatif,
  confirmerEncaissement,
  ECHEANCE_STATUS,
  MODE_PAIEMENT,
  MODE_PAIEMENT_LABELS,
  PAIEMENT_STATUS,
  PAIEMENT_STATUS_LABELS,
} from "@/lib/properties";
import { API_BASE_URL } from "@/lib/apiClient";
import { fetchLocataires } from "@/lib/tenants";
import { SORT_OPTIONS, sortList } from "@/lib/sort";
import StatCard from "@/components/StatCard";
import Modal from "@/components/Modal";
import Drawer from "@/components/Drawer";
import ConfirmationDialog from "@/components/ConfirmationDialog";
import TextField from "@/components/TextField";
import SelectField from "@/components/SelectField";
import FilterChip from "@/components/FilterChip";
import FilterSelect from "@/components/FilterSelect";
import PlanLimitPopup from "@/components/PlanLimitPopup";
import { usePlanGate } from "@/hooks/usePlanGate";
import { useLanguage } from "@/context/LanguageContext";
import uiStyles from "@/components/ui.module.css";
import styles from "../proprietaire.module.css";

function Banner({ banner }) {
  if (!banner) return null;
  return (
    <div className={`${styles.banner} ${banner.type === "success" ? styles.bannerSuccess : styles.bannerError}`}>
      {banner.message}
    </div>
  );
}

function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

function formatCurrency(value) {
  if (value === null || value === undefined || value === "") return "—";
  return `${Number(value).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} MAD`;
}

const MODE_OPTIONS = Object.entries(MODE_PAIEMENT_LABELS).map(([value, label]) => ({ value, label }));
const PAGE_SIZE = 10;

// Chèque/virement : encaissement différé, voir explication sur le badge
// "En attente d'encaissement" plus bas et confirmerEncaissement().
const MODES_ENCAISSEMENT_DIFFERE = [MODE_PAIEMENT.CHEQUE, MODE_PAIEMENT.VIREMENT];
function isModeDiffere(mode) {
  return MODES_ENCAISSEMENT_DIFFERE.includes(Number(mode));
}

const EMPTY_CREATE_FORM = {
  locataire_id: "",
  echeance_id: "",
  montant: "",
  mode_paiement: String(MODE_PAIEMENT.VIREMENT),
  agence_bancaire: "",
  reference_paiement: "",
};

export default function ProprietairePaiementsPage() {
  const { t } = useLanguage();
  const [paiements, setPaiements] = useState([]);
  const [echeances, setEcheances] = useState([]);
  const [biens, setBiens] = useState([]);
  const [locataires, setLocataires] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const [search, setSearch] = useState("");
  const [modeFilter, setModeFilter] = useState("");
  const [monthOnly, setMonthOnly] = useState(false);
  const [sortBy, setSortBy] = useState("recent");
  const [currentPage, setCurrentPage] = useState(1);

  const [createOpen, setCreateOpen] = useState(false);
  const [createDraft, setCreateDraft] = useState(EMPTY_CREATE_FORM);
  const [createBusy, setCreateBusy] = useState(false);
  const [createBanner, setCreateBanner] = useState(null);
  const [planLimitMessage, setPlanLimitMessage] = useState(null);
  const { checkBeforeOpen } = usePlanGate("quittances_mois");
  const [createJustificatif, setCreateJustificatif] = useState(null);
  const [createJustificatifBusy, setCreateJustificatifBusy] = useState(false);

  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelMotif, setCancelMotif] = useState("");
  const [cancelBusy, setCancelBusy] = useState(false);
  const [cancelError, setCancelError] = useState(null);
  const [listBanner, setListBanner] = useState(null);
  const [downloadingId, setDownloadingId] = useState(null);
  const [detailsTarget, setDetailsTarget] = useState(null);

  const [encaissementTarget, setEncaissementTarget] = useState(null);
  const [encaissementDraft, setEncaissementDraft] = useState({ agence_bancaire: "", reference_paiement: "", date_encaissement: "" });
  const [encaissementJustificatif, setEncaissementJustificatif] = useState(null);
  const [encaissementJustificatifBusy, setEncaissementJustificatifBusy] = useState(false);
  const [encaissementBusy, setEncaissementBusy] = useState(false);
  const [encaissementError, setEncaissementError] = useState(null);

  useEffect(() => {
    async function init() {
      setIsLoading(true);
      try {
        const [paiementsList, echeancesList, biensList, locatairesList] = await Promise.all([
          fetchPaiements(),
          fetchEcheances(),
          fetchBiens(),
          fetchLocataires(),
        ]);
        setPaiements(paiementsList);
        setEcheances(echeancesList);
        setBiens(biensList);
        setLocataires(locatairesList);
      } catch (err) {
        setLoadError(extractErrorMessage(err));
      } finally {
        setIsLoading(false);
      }
    }
    init();
  }, []);

  const stats = useMemo(() => {
    const now = new Date();
    // Un paiement annulé ne doit plus compter dans les totaux affichés : on ne
    // prend en compte que les paiements encore valides.
    const valides = paiements.filter((p) => p.statut !== PAIEMENT_STATUS.ANNULE);
    const total = valides.reduce((sum, p) => sum + Number(p.montant || 0), 0);
    const moisCourant = valides
      .filter((p) => {
        const d = new Date(p.date_paiement);
        return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
      })
      .reduce((sum, p) => sum + Number(p.montant || 0), 0);
    return {
      count: valides.length,
      total,
      moisCourant,
      moyenne: valides.length > 0 ? total / valides.length : 0,
    };
  }, [paiements]);

  function bienLotLabel(echeance) {
    if (!echeance?.bail) return "—";
    const bien = biens.find((b) => b.id === echeance.bail.lot?.bien_id);
    const bienName = bien?.designation || `Bien #${echeance.bail.lot?.bien_id}`;
    return `${bienName} — ${echeance.bail.lot?.reference || `Lot #${echeance.bail.lot_id}`}`;
  }

  function paidSoFar(echeanceId, excludePaiementId) {
    return paiements
      .filter(
        (p) =>
          p.echeance_id === echeanceId &&
          p.id !== excludePaiementId &&
          p.statut !== PAIEMENT_STATUS.ANNULE
      )
      .reduce((sum, p) => sum + Number(p.montant || 0), 0);
  }

  function echeanceOptionLabel(echeance) {
    const label = `${bienLotLabel(echeance)} · ${echeance.bail?.locataire?.prenom || ""} ${echeance.bail?.locataire?.nom || ""} · ${formatDate(echeance.date_echeance)}`;
    if (echeance.montant_du === null || echeance.montant_du === undefined) return label;
    const reste = Number(echeance.montant_du) - paidSoFar(echeance.id);
    return `${label} · ${t("bo.proprietairePaiements.remainingSuffix", { amount: formatCurrency(Math.max(0, reste)) })}`;
  }

  function echeancesForLocataire(locataireId) {
    if (!locataireId) return [];
    return echeances
      .filter((e) => e.bail?.locataire_id === Number(locataireId))
      // Une échéance déjà entièrement réglée (reste = 0) n'a plus rien à
      // encaisser : l'exclure du sélecteur plutôt que de simplement la trier
      // en dernier, pour ne pas laisser un choix qui échouerait de toute façon.
      .filter((e) => {
        if (e.montant_du === null || e.montant_du === undefined) return true;
        return Number(e.montant_du) - paidSoFar(e.id) > 0;
      })
      .sort((a, b) => new Date(a.date_echeance || 0) - new Date(b.date_echeance || 0));
  }

  const locatairesWithEcheances = useMemo(
    () => locataires.filter((l) => echeances.some((e) => e.bail?.locataire_id === l.id)),
    [locataires, echeances]
  );

  const createEcheanceOptions = useMemo(
    () => echeancesForLocataire(createDraft.locataire_id),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [createDraft.locataire_id, echeances]
  );

  const filteredPaiements = useMemo(() => {
    const term = search.trim().toLowerCase();
    const now = new Date();
    const filtered = paiements.filter((p) => {
      if (term) {
        const locataire = p.echeance?.bail?.locataire;
        const bien = biens.find((b) => b.id === p.echeance?.bail?.lot?.bien_id);
        const haystack = [
          locataire?.prenom,
          locataire?.nom,
          locataire?.email,
          bien?.designation,
          p.echeance?.bail?.lot?.reference,
          p.montant,
          MODE_PAIEMENT_LABELS[p.mode_paiement],
          formatDate(p.date_paiement),
          formatDate(p.echeance?.date_echeance),
          PAIEMENT_STATUS_LABELS[p.statut],
        ]
          .filter((v) => v !== null && v !== undefined && v !== "")
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      if (modeFilter && String(p.mode_paiement) !== modeFilter) return false;
      if (monthOnly) {
        const d = new Date(p.date_paiement);
        if (d.getFullYear() !== now.getFullYear() || d.getMonth() !== now.getMonth()) return false;
      }
      return true;
    });
    return sortList(filtered, sortBy, {
      dateOf: (p) => p.date_paiement,
      nameOf: (p) => {
        const l = p.echeance?.bail?.locataire;
        return l ? `${l.prenom} ${l.nom}` : "";
      },
    });
  }, [paiements, search, modeFilter, monthOnly, sortBy, biens]);

  const totalPages = Math.max(1, Math.ceil(filteredPaiements.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedPaiements = filteredPaiements.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  // Le statut de l'échéance est recalculé et persisté côté serveur (voir
  // sync_echeance_statut), automatiquement à chaque paiement créé/annulé — on se
  // contente ici de refléter la même valeur localement, sans appel réseau, pour
  // que l'UI reste cohérente sans attendre un rechargement complet.
  function reconcileEcheance(echeanceId, newMontantForPaiementId, newMontantValue) {
    const echeance = echeances.find((e) => e.id === echeanceId);
    if (!echeance || echeance.montant_du === null || echeance.montant_du === undefined) return;
    const paidTotal = paidSoFar(echeanceId, newMontantForPaiementId) + Number(newMontantValue || 0);
    const newStatus =
      paidTotal >= Number(echeance.montant_du)
        ? ECHEANCE_STATUS.PAYE
        : paidTotal > 0
          ? ECHEANCE_STATUS.PARTIEL
          : ECHEANCE_STATUS.IMPAYE;
    if (newStatus === echeance.statut) return;
    setEcheances((prev) => prev.map((e) => (e.id === echeanceId ? { ...e, statut: newStatus } : e)));
    return newStatus;
  }

  function openCreate() {
    const blockMessage = checkBeforeOpen();
    if (blockMessage) {
      setPlanLimitMessage(blockMessage);
      return;
    }
    const firstLocataire = locatairesWithEcheances[0];
    const firstEcheance = firstLocataire ? echeancesForLocataire(firstLocataire.id)[0] : null;
    setCreateDraft({
      ...EMPTY_CREATE_FORM,
      locataire_id: firstLocataire ? String(firstLocataire.id) : "",
      echeance_id: firstEcheance ? String(firstEcheance.id) : "",
    });
    setCreateJustificatif(null);
    setCreateBanner(null);
    setCreateOpen(true);
  }

  function handleLocataireChange(locataireId) {
    const firstEcheance = echeancesForLocataire(locataireId)[0];
    setCreateDraft((d) => ({
      ...d,
      locataire_id: locataireId,
      echeance_id: firstEcheance ? String(firstEcheance.id) : "",
    }));
  }

  function closeCreate() {
    if (createBusy) return;
    setCreateOpen(false);
  }

  async function handleCreateJustificatifChange(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setCreateJustificatifBusy(true);
    setCreateBanner(null);
    try {
      const uploaded = await uploadPaiementJustificatif(file);
      setCreateJustificatif(uploaded);
    } catch (err) {
      setCreateBanner({ type: "error", message: extractErrorMessage(err) });
    } finally {
      setCreateJustificatifBusy(false);
    }
  }

  async function handleSubmitCreate(e) {
    e.preventDefault();
    setCreateBusy(true);
    setCreateBanner(null);
    try {
      const echeanceId = Number(createDraft.echeance_id);
      const echeance = echeances.find((ec) => ec.id === echeanceId);
      const created = await createPaiement({
        echeanceId,
        montant: createDraft.montant,
        modePaiement: Number(createDraft.mode_paiement),
        agenceBancaire: createDraft.agence_bancaire,
        referencePaiement: createDraft.reference_paiement,
        justificatif: createJustificatif?.justificatif,
        justificatifNom: createJustificatif?.justificatif_nom,
      });
      setPaiements((prev) => [...prev, { ...created, echeance }]);
      reconcileEcheance(echeanceId, null, createDraft.montant);

      setCreateOpen(false);
    } catch (err) {
      if (isPlanLimitError(err)) {
        setPlanLimitMessage(extractErrorMessage(err));
      } else {
        setCreateBanner({ type: "error", message: extractErrorMessage(err) });
      }
    } finally {
      setCreateBusy(false);
    }
  }

  function openEncaissement(paiement) {
    setEncaissementTarget(paiement);
    setEncaissementDraft({
      agence_bancaire: paiement.agence_bancaire || "",
      reference_paiement: paiement.reference_paiement || "",
      date_encaissement: "",
    });
    setEncaissementJustificatif(null);
    setEncaissementError(null);
  }

  async function handleEncaissementJustificatifChange(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setEncaissementJustificatifBusy(true);
    setEncaissementError(null);
    try {
      const uploaded = await uploadPaiementJustificatif(file);
      setEncaissementJustificatif(uploaded);
    } catch (err) {
      setEncaissementError(extractErrorMessage(err));
    } finally {
      setEncaissementJustificatifBusy(false);
    }
  }

  async function handleConfirmEncaissement(e) {
    e.preventDefault();
    if (!encaissementTarget) return;
    setEncaissementBusy(true);
    setEncaissementError(null);
    try {
      const updated = await confirmerEncaissement(encaissementTarget.id, {
        agenceBancaire: encaissementDraft.agence_bancaire,
        referencePaiement: encaissementDraft.reference_paiement,
        dateEncaissement: encaissementDraft.date_encaissement || undefined,
        justificatif: encaissementJustificatif?.justificatif,
        justificatifNom: encaissementJustificatif?.justificatif_nom,
      });
      setPaiements((prev) => prev.map((p) => (p.id === updated.id ? { ...p, ...updated } : p)));
      setEncaissementTarget(null);
    } catch (err) {
      setEncaissementError(extractErrorMessage(err));
    } finally {
      setEncaissementBusy(false);
    }
  }

  async function handleDownload(quittanceId) {
    setDownloadingId(quittanceId);
    setListBanner(null);
    try {
      await downloadQuittance(quittanceId);
    } catch (err) {
      setListBanner({ type: "error", message: extractErrorMessage(err) });
    } finally {
      setDownloadingId(null);
    }
  }

  async function handleConfirmCancel() {
    if (!cancelTarget) return;
    setCancelBusy(true);
    setCancelError(null);
    try {
      const updated = await annulerPaiement(cancelTarget.id, cancelMotif.trim() || undefined);
      setPaiements((prev) => prev.map((p) => (p.id === updated.id ? { ...p, ...updated } : p)));
      // Un paiement annulé ne doit plus compter pour l'échéance : son statut
      // (payée/partielle/impayée) est recalculé comme si ce paiement n'existait plus.
      reconcileEcheance(cancelTarget.echeance_id, cancelTarget.id, 0);
      setCancelTarget(null);
      setCancelMotif("");
    } catch (err) {
      setCancelError(extractErrorMessage(err));
    } finally {
      setCancelBusy(false);
    }
  }

  if (isLoading) {
    return <p>{t("bo.common.loading")}</p>;
  }

  return (
    <div>
      <PlanLimitPopup message={planLimitMessage} onClose={() => setPlanLimitMessage(null)} />
      <Banner banner={loadError ? { type: "error", message: loadError } : null} />
      <Banner banner={listBanner} />

      {/* ---- Stats ---- */}
      <div className={styles.section}>
        <div className={styles.statsGrid}>
          <StatCard icon="bi-receipt" tone="primary" label={t("bo.proprietairePaiements.statCount")} value={stats.count} />
          <StatCard icon="bi-cash-stack" tone="accent" label={t("bo.proprietairePaiements.statTotal")} value={formatCurrency(stats.total)} />
          <StatCard icon="bi-calendar-check-fill" tone="primary" label={t("bo.proprietairePaiements.statMonth")} value={formatCurrency(stats.moisCourant)} />
          <StatCard icon="bi-graph-up-arrow" tone="accent" label={t("bo.proprietairePaiements.statAverage")} value={formatCurrency(stats.moyenne)} />
        </div>
      </div>

      {/* ---- Table ---- */}
      <div className={styles.section} style={{ marginBottom: 0 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem" }}>
          <div>
            <h2 className={styles.sectionTitle}>
              <i className="bi bi-table" style={{ marginRight: "0.5rem", color: "var(--primary)" }} />
              {t("bo.proprietairePaiements.title")}
            </h2>
            <p className={styles.sectionSubtitle}>
              {t("bo.proprietairePaiements.subtitle", { shown: filteredPaiements.length, total: paiements.length })}
            </p>
          </div>
          <button
            type="button"
            className={styles.btn}
            onClick={openCreate}
            disabled={locatairesWithEcheances.length === 0}
            title={locatairesWithEcheances.length === 0 ? t("bo.proprietairePaiements.noEligibleTenant") : undefined}
          >
            <i className="bi bi-plus-lg" />
            {t("bo.proprietairePaiements.recordPayment")}
          </button>
        </div>

        <div className={styles.filtersRow}>
          <input
            type="text"
            placeholder={t("bo.proprietairePaiements.searchPlaceholder")}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCurrentPage(1);
            }}
          />
          <FilterSelect
            value={modeFilter}
            onChange={(v) => {
              setModeFilter(v);
              setCurrentPage(1);
            }}
            options={[{ value: "", label: t("bo.proprietairePaiements.allModes") }, ...MODE_OPTIONS]}
          />
          <FilterChip
            checked={monthOnly}
            onChange={(checked) => {
              setMonthOnly(checked);
              setCurrentPage(1);
            }}
          >
            {t("bo.proprietairePaiements.thisMonthOnly")}
          </FilterChip>
          <FilterSelect value={sortBy} onChange={setSortBy} options={SORT_OPTIONS} />
        </div>

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>{t("bo.proprietairePaiements.colTenant")}</th>
                <th>{t("bo.proprietairePaiements.colBienLot")}</th>
                <th>{t("bo.proprietairePaiements.colDueDate")}</th>
                <th>{t("bo.proprietairePaiements.colAmount")}</th>
                <th>{t("bo.proprietairePaiements.colMode")}</th>
                <th>{t("bo.proprietairePaiements.colPaymentDate")}</th>
                <th>{t("bo.proprietairePaiements.colStatus")}</th>
                <th>{t("bo.proprietairePaiements.colPdf")}</th>
                <th>{t("bo.proprietairePaiements.colActions")}</th>
              </tr>
            </thead>
            <tbody>
              {filteredPaiements.length === 0 && (
                <tr>
                  <td colSpan={9} className={styles.empty}>
                    {t("bo.common.noMatch")}
                  </td>
                </tr>
              )}
              {paginatedPaiements.map((p) => (
                <tr key={p.id}>
                  <td>
                    {p.echeance?.bail?.locataire ? (
                      <div>
                        <div className={styles.userName}>
                          {p.echeance.bail.locataire.prenom} {p.echeance.bail.locataire.nom}
                        </div>
                        <div className={styles.recentEmail}>{p.echeance.bail.locataire.email}</div>
                      </div>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td>{bienLotLabel(p.echeance)}</td>
                  <td>{formatDate(p.echeance?.date_echeance)}</td>
                  <td>
                    {formatCurrency(p.montant)}
                    {p.echeance?.montant_du !== null && p.echeance?.montant_du !== undefined && (
                      <span className={styles.recentEmail}> / {formatCurrency(p.echeance.montant_du)} {t("bo.proprietairePaiements.due")}</span>
                    )}
                  </td>
                  <td>{MODE_PAIEMENT_LABELS[p.mode_paiement] || "—"}</td>
                  <td>{formatDate(p.date_paiement)}</td>
                  <td>
                    <span className={`${styles.badge} ${p.statut === PAIEMENT_STATUS.ANNULE ? styles.badgeDanger : styles.badgeActive}`}>
                      {PAIEMENT_STATUS_LABELS[p.statut] || "—"}
                    </span>
                    {p.statut !== PAIEMENT_STATUS.ANNULE && !p.encaisse && (
                      <div>
                        <span className={`${styles.badge} ${styles.badgeSuspended}`} style={{ marginTop: "0.3rem" }}>
                          <i className="bi bi-hourglass-split" /> {t("bo.proprietairePaiements.pendingEncaissement")}
                        </span>
                      </div>
                    )}
                  </td>
                  <td>
                    {p.quittance ? (
                      <button
                        type="button"
                        className={styles.btnOutline}
                        onClick={() => handleDownload(p.quittance.id)}
                        disabled={downloadingId === p.quittance.id}
                      >
                        <i className="bi bi-download" />
                        {downloadingId === p.quittance.id ? "..." : t("bo.proprietairePaiements.colPdf")}
                      </button>
                    ) : (
                      <span className={styles.empty}>—</span>
                    )}
                  </td>
                  <td>
                    <div className={styles.tableActions}>
                      <button
                        type="button"
                        className={styles.iconBtn}
                        onClick={() => setDetailsTarget(p)}
                        title={t("bo.common.seeDetails")}
                      >
                        <i className="bi bi-info-circle" />
                      </button>
                      {p.statut !== PAIEMENT_STATUS.ANNULE && !p.encaisse && (
                        <button
                          type="button"
                          className={styles.iconBtn}
                          onClick={() => openEncaissement(p)}
                          title={t("bo.proprietairePaiements.confirmEncaissement")}
                        >
                          <i className="bi bi-check2-circle" />
                        </button>
                      )}
                      {p.statut !== PAIEMENT_STATUS.ANNULE && (
                        <button
                          type="button"
                          className={`${styles.iconBtn} ${styles.iconBtnDanger}`}
                          onClick={() => {
                            setCancelTarget(p);
                            setCancelError(null);
                          }}
                          title={t("bo.proprietairePaiements.cancelThisPayment")}
                        >
                          <i className="bi bi-x-circle" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredPaiements.length > 0 && (
            <div className={styles.paginationRow}>
              <span>
                {t("bo.proprietairePaiements.pageOf", { page: safePage, total: totalPages, count: filteredPaiements.length })}
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

      {/* ---- Enregistrer un paiement ---- */}
      <Modal isOpen={createOpen} onClose={closeCreate} title={t("bo.proprietairePaiements.createTitle")}>
        <form onSubmit={handleSubmitCreate}>
          <Banner banner={createBanner} />
          <SelectField
            label={t("bo.proprietairePaiements.tenantLabel")}
            name="locataire_id"
            options={locatairesWithEcheances.map((l) => ({ value: l.id, label: `${l.prenom} ${l.nom} (${l.email})` }))}
            value={createDraft.locataire_id}
            onChange={(e) => handleLocataireChange(e.target.value)}
            hint={t("bo.proprietairePaiements.tenantHint")}
            required
          />
          {createEcheanceOptions.length === 0 ? (
            <p className={styles.empty}>{t("bo.proprietairePaiements.noEcheanceForTenant")}</p>
          ) : (
            <SelectField
              label={t("bo.proprietairePaiements.dueDateLabel")}
              name="echeance_id"
              options={createEcheanceOptions.map((e) => ({ value: e.id, label: echeanceOptionLabel(e) }))}
              value={createDraft.echeance_id}
              onChange={(e) => setCreateDraft((d) => ({ ...d, echeance_id: e.target.value }))}
              required
            />
          )}
          <TextField
            label={t("bo.proprietairePaiements.amountLabel")}
            name="montant"
            type="number"
            step="0.01"
            min="0"
            value={createDraft.montant}
            onChange={(e) => setCreateDraft((d) => ({ ...d, montant: e.target.value }))}
            required
          />
          <SelectField
            label={t("bo.proprietairePaiements.modeLabel")}
            name="mode_paiement"
            options={MODE_OPTIONS}
            value={createDraft.mode_paiement}
            onChange={(e) => setCreateDraft((d) => ({ ...d, mode_paiement: e.target.value }))}
          />

          {isModeDiffere(createDraft.mode_paiement) && (
            <div className={styles.card} style={{ marginTop: "0.5rem", marginBottom: "0.5rem" }}>
              <p className={styles.sectionSubtitle} style={{ marginTop: 0 }}>
                <i className="bi bi-hourglass-split" /> {t("bo.proprietairePaiements.deferredNotice")}
              </p>
              <TextField
                label={t("bo.proprietairePaiements.bankAgencyLabel")}
                name="agence_bancaire"
                value={createDraft.agence_bancaire}
                onChange={(e) => setCreateDraft((d) => ({ ...d, agence_bancaire: e.target.value }))}
              />
              <TextField
                label={t("bo.proprietairePaiements.referenceLabel")}
                name="reference_paiement"
                value={createDraft.reference_paiement}
                onChange={(e) => setCreateDraft((d) => ({ ...d, reference_paiement: e.target.value }))}
              />
              <label className={uiStyles.field} style={{ marginTop: "0.5rem" }}>
                {t("bo.proprietairePaiements.justificatifLabel")}
                <input type="file" onChange={handleCreateJustificatifChange} disabled={createJustificatifBusy} style={{ display: "block", marginTop: "0.3rem" }} />
              </label>
              {createJustificatifBusy && <p className={styles.sectionSubtitle}>{t("bo.common.uploading")}</p>}
              {createJustificatif && (
                <p className={styles.sectionSubtitle}>
                  <i className="bi bi-paperclip" /> {createJustificatif.justificatif_nom}
                </p>
              )}
            </div>
          )}

          <p className={styles.sectionSubtitle} style={{ marginTop: "0.5rem" }}>
            <i className="bi bi-info-circle" /> {t("bo.proprietairePaiements.autoStatusHint")}
          </p>

          <div className={styles.editActions} style={{ marginTop: "1.2rem" }}>
            <button type="submit" className={styles.btn} disabled={createBusy}>
              <i className="bi bi-check-lg" />
              {createBusy ? t("bo.common.saving") : t("bo.common.save")}
            </button>
            <button type="button" className={styles.btnOutline} onClick={closeCreate} disabled={createBusy}>
              <i className="bi bi-x-lg" />
              {t("bo.common.cancel")}
            </button>
          </div>
        </form>
      </Modal>

      {/* ---- Détails d'un paiement ---- */}
      <Drawer
        isOpen={!!detailsTarget}
        onClose={() => setDetailsTarget(null)}
        title={
          detailsTarget && (
            <div>
              <h3 className={styles.detailTitle}>
                <i className="bi bi-receipt" style={{ color: "var(--primary)" }} />
                {t("bo.proprietairePaiements.detailsPaymentPrefix")} {formatDate(detailsTarget.date_paiement)}
              </h3>
              <span
                className={`${styles.badge} ${detailsTarget.statut === PAIEMENT_STATUS.ANNULE ? styles.badgeDanger : styles.badgeActive}`}
                style={{ marginTop: "0.5rem", display: "inline-flex" }}
              >
                {PAIEMENT_STATUS_LABELS[detailsTarget.statut] || "—"}
              </span>
            </div>
          )
        }
      >
        {detailsTarget && (
          <div>
            <div className={styles.statsGrid} style={{ marginBottom: "1.4rem" }}>
              <StatCard
                icon={detailsTarget.statut === PAIEMENT_STATUS.ANNULE ? "bi-x-circle" : "bi-cash-stack"}
                tone={detailsTarget.statut === PAIEMENT_STATUS.ANNULE ? "danger" : "primary"}
                label={t(
                  detailsTarget.statut === PAIEMENT_STATUS.ANNULE
                    ? "bo.proprietairePaiements.cancelledAmountLabel"
                    : "bo.proprietairePaiements.amountPaidLabel"
                )}
                value={formatCurrency(detailsTarget.montant)}
              />
              <StatCard
                icon="bi-hourglass-split"
                tone="warning"
                label={t("bo.proprietairePaiements.remainingLabel")}
                value={formatCurrency(
                  Math.max(0, Number(detailsTarget.echeance?.montant_du || 0) - paidSoFar(detailsTarget.echeance_id))
                )}
              />
            </div>
            {detailsTarget.statut === PAIEMENT_STATUS.ANNULE && (
              <p className={styles.sectionSubtitle} style={{ marginTop: "-1rem", marginBottom: "1.4rem" }}>
                <i className="bi bi-info-circle" /> {t("bo.proprietairePaiements.remainingCancelledNotice")}
              </p>
            )}

            <div className={styles.detailBlockTitle}>
              <i className="bi bi-person-fill" />
              {t("bo.proprietairePaiements.tenantSection")}
            </div>
            <div className={styles.detailLine}>
              <strong>{t("bo.proprietairePaiements.nameLabel")}</strong>{" "}
              {detailsTarget.echeance?.bail?.locataire
                ? `${detailsTarget.echeance.bail.locataire.prenom} ${detailsTarget.echeance.bail.locataire.nom}`
                : "—"}
            </div>
            <div className={styles.detailLine}>
              <strong>{t("bo.proprietairePaiements.bienLotLabel")}</strong> {bienLotLabel(detailsTarget.echeance)}
            </div>

            <div className={styles.detailBlockTitle} style={{ marginTop: "1rem" }}>
              <i className="bi bi-info-circle" />
              {t("bo.proprietairePaiements.paymentSection")}
            </div>
            <div className={styles.detailLine}>
              <strong>{t("bo.proprietairePaiements.totalDueLabel")}</strong> {formatCurrency(detailsTarget.echeance?.montant_du)}
            </div>
            <div className={styles.detailLine}>
              <strong>{t("bo.proprietairePaiements.modeColonLabel")}</strong> {MODE_PAIEMENT_LABELS[detailsTarget.mode_paiement] || "—"}
            </div>
            <div className={styles.detailLine}>
              <strong>{t("bo.proprietairePaiements.collectedByLabel")}</strong>{" "}
              {detailsTarget.encaisseur
                ? `${detailsTarget.encaisseur.prenom} ${detailsTarget.encaisseur.nom} (${detailsTarget.encaisseur.email})`
                : "—"}
            </div>

            {detailsTarget.statut !== PAIEMENT_STATUS.ANNULE &&
              [MODE_PAIEMENT.CHEQUE, MODE_PAIEMENT.VIREMENT].includes(detailsTarget.mode_paiement) && (
                <>
                  <div className={styles.detailBlockTitle} style={{ marginTop: "1rem" }}>
                    <i className="bi bi-bank" />
                    {t("bo.proprietairePaiements.encaissementSection")}
                  </div>
                  <div className={styles.detailLine}>
                    <strong>{t("bo.proprietairePaiements.encaissementStatusLabel")}</strong>{" "}
                    {detailsTarget.encaisse
                      ? t("bo.proprietairePaiements.encaissed")
                      : t("bo.proprietairePaiements.pendingEncaissement")}
                  </div>
                  {detailsTarget.encaisse && (
                    <div className={styles.detailLine}>
                      <strong>{t("bo.proprietairePaiements.encaissementDateLabel")}</strong>{" "}
                      {formatDate(detailsTarget.date_encaissement)}
                    </div>
                  )}
                  {detailsTarget.agence_bancaire && (
                    <div className={styles.detailLine}>
                      <strong>{t("bo.proprietairePaiements.bankAgencyLabel")}</strong> {detailsTarget.agence_bancaire}
                    </div>
                  )}
                  {detailsTarget.reference_paiement && (
                    <div className={styles.detailLine}>
                      <strong>{t("bo.proprietairePaiements.referenceLabel")}</strong> {detailsTarget.reference_paiement}
                    </div>
                  )}
                  {detailsTarget.justificatif && (
                    <div className={styles.detailLine}>
                      <strong>{t("bo.proprietairePaiements.justificatifLabel")}</strong>{" "}
                      <a href={`${API_BASE_URL}${detailsTarget.justificatif}`} target="_blank" rel="noreferrer">
                        {detailsTarget.justificatif_nom || t("bo.proprietairePaiements.justificatifLabel")}
                      </a>
                    </div>
                  )}
                </>
              )}

            {detailsTarget.statut === PAIEMENT_STATUS.ANNULE && (
              <>
                <div className={styles.detailBlockTitle} style={{ marginTop: "1rem" }}>
                  <i className="bi bi-x-circle" />
                  {t("bo.proprietairePaiements.cancellationSection")}
                </div>
                <div className={styles.detailLine}>
                  <strong>{t("bo.proprietairePaiements.cancelledByLabel")}</strong>{" "}
                  {detailsTarget.annulateur
                    ? `${detailsTarget.annulateur.prenom} ${detailsTarget.annulateur.nom}`
                    : "—"}
                </div>
                <div className={styles.detailLine}>
                  <strong>{t("bo.proprietairePaiements.cancelledDateLabel")}</strong> {formatDate(detailsTarget.date_annulation)}
                </div>
                <div className={styles.detailLine}>
                  <strong>{t("bo.proprietairePaiements.cancelMotifResultLabel")}</strong> {detailsTarget.motif_annulation || "—"}
                </div>
              </>
            )}
          </div>
        )}
      </Drawer>

      <ConfirmationDialog
        isOpen={!!cancelTarget}
        onClose={() => {
          setCancelTarget(null);
          setCancelMotif("");
          setCancelError(null);
        }}
        onConfirm={handleConfirmCancel}
        title={t("bo.proprietairePaiements.cancelTitle")}
        message={
          cancelTarget
            ? t("bo.proprietairePaiements.cancelMessage", {
                amount: formatCurrency(cancelTarget.montant),
                date: formatDate(cancelTarget.echeance?.date_echeance),
              })
            : ""
        }
        confirmLabel={t("bo.proprietairePaiements.cancelConfirmLabel")}
        danger
        isBusy={cancelBusy}
        error={cancelError}
      >
        <TextField
          as="textarea"
          label={t("bo.proprietairePaiements.cancelMotifLabel")}
          name="cancel_motif"
          rows={2}
          value={cancelMotif}
          onChange={(e) => setCancelMotif(e.target.value)}
          placeholder={t("bo.proprietairePaiements.cancelMotifPlaceholder")}
        />
      </ConfirmationDialog>

      {/* ---- Confirmer l'encaissement (chèque/virement) ---- */}
      <Modal
        isOpen={!!encaissementTarget}
        onClose={() => (encaissementBusy ? null : setEncaissementTarget(null))}
        title={t("bo.proprietairePaiements.confirmEncaissement")}
      >
        {encaissementTarget && (
          <form onSubmit={handleConfirmEncaissement}>
            {encaissementError && (
              <div className={`${styles.banner} ${styles.bannerError}`}>{encaissementError}</div>
            )}
            <p className={styles.sectionSubtitle} style={{ marginTop: 0 }}>
              {t("bo.proprietairePaiements.encaissementModalHint", {
                amount: formatCurrency(encaissementTarget.montant),
              })}
            </p>
            <TextField
              label={t("bo.proprietairePaiements.bankAgencyLabel")}
              name="encaissement_agence_bancaire"
              value={encaissementDraft.agence_bancaire}
              onChange={(e) => setEncaissementDraft((d) => ({ ...d, agence_bancaire: e.target.value }))}
            />
            <TextField
              label={t("bo.proprietairePaiements.referenceLabel")}
              name="encaissement_reference"
              value={encaissementDraft.reference_paiement}
              onChange={(e) => setEncaissementDraft((d) => ({ ...d, reference_paiement: e.target.value }))}
            />
            <TextField
              label={t("bo.proprietairePaiements.encaissementDateLabel")}
              name="encaissement_date"
              type="date"
              value={encaissementDraft.date_encaissement}
              onChange={(e) => setEncaissementDraft((d) => ({ ...d, date_encaissement: e.target.value }))}
            />
            <label className={uiStyles.field} style={{ marginTop: "0.5rem" }}>
              {t("bo.proprietairePaiements.justificatifLabel")}
              <input
                type="file"
                onChange={handleEncaissementJustificatifChange}
                disabled={encaissementJustificatifBusy}
                style={{ display: "block", marginTop: "0.3rem" }}
              />
            </label>
            {encaissementJustificatifBusy && <p className={styles.sectionSubtitle}>{t("bo.common.uploading")}</p>}
            {encaissementJustificatif && (
              <p className={styles.sectionSubtitle}>
                <i className="bi bi-paperclip" /> {encaissementJustificatif.justificatif_nom}
              </p>
            )}

            <div className={styles.editActions} style={{ marginTop: "1.2rem" }}>
              <button type="submit" className={styles.btn} disabled={encaissementBusy}>
                <i className="bi bi-check-lg" />
                {encaissementBusy ? t("bo.common.saving") : t("bo.proprietairePaiements.confirmEncaissement")}
              </button>
              <button
                type="button"
                className={styles.btnOutline}
                onClick={() => setEncaissementTarget(null)}
                disabled={encaissementBusy}
              >
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
