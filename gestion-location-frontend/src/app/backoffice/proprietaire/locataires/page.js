"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { extractErrorMessage, isPlanLimitError, API_BASE_URL } from "@/lib/apiClient";
import { fetchLocataires, createLocataire, deactivateLocataire, activateLocataire } from "@/lib/tenants";
import { fetchBiens, fetchBaux, fetchEcheances, fetchPaiements, BAIL_STATUS, BAIL_STATUS_LABELS, ECHEANCE_STATUS } from "@/lib/properties";
import { ACCOUNT_STATUS, accountStatusLabels } from "@/lib/users";
import { SORT_OPTIONS, sortList } from "@/lib/sort";
import StatCard from "@/components/StatCard";
import Modal from "@/components/Modal";
import Drawer from "@/components/Drawer";
import TextField from "@/components/TextField";
import SelectField from "@/components/SelectField";
import FilterChip from "@/components/FilterChip";
import FilterSelect from "@/components/FilterSelect";
import PlanLimitPopup from "@/components/PlanLimitPopup";
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

function accountBadgeClass(statut) {
  if (statut === ACCOUNT_STATUS.ACTIF) return styles.badgeActive;
  if (statut === ACCOUNT_STATUS.INVITE_EN_ATTENTE) return styles.badgeWarning;
  return styles.badgeDanger;
}

function accountStatusIcon(statut) {
  if (statut === ACCOUNT_STATUS.ACTIF) return "bi-check-circle-fill";
  if (statut === ACCOUNT_STATUS.INVITE_EN_ATTENTE) return "bi-hourglass-split";
  return "bi-slash-circle-fill";
}

function avatarRingClass(locataire, isOverdueFlag) {
  if (isOverdueFlag) return styles.tenantAvatarRingOverdue;
  if (locataire.statut_compte === ACCOUNT_STATUS.ACTIF) return styles.tenantAvatarRingActive;
  if (locataire.statut_compte === ACCOUNT_STATUS.INVITE_EN_ATTENTE) return styles.tenantAvatarRingPending;
  return styles.tenantAvatarRingDisabled;
}

function bailBadgeClass(statut) {
  if (statut === BAIL_STATUS.ACTIF) return styles.badgeActive;
  if (statut === BAIL_STATUS.EN_ATTENTE) return styles.badgeWarning;
  if (statut === BAIL_STATUS.RESILIE) return styles.badgeDanger;
  return styles.badgeNeutral;
}

function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

function formatCurrency(value) {
  if (value === null || value === undefined || value === "") return "—";
  return `${Number(value).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} MAD`;
}

function isOverdue(echeance) {
  if (echeance.statut === ECHEANCE_STATUS.PAYE || !echeance.date_echeance) return false;
  return new Date(echeance.date_echeance) < new Date(new Date().toDateString());
}

const PAGE_SIZE = 10;

const EMPTY_FORM = { prenom: "", nom: "", email: "", mot_de_passe: "", statut_compte: String(ACCOUNT_STATUS.ACTIF) };

export default function ProprietaireLocatairesPage() {
  const { t } = useLanguage();
  const ACCOUNT_STATUS_LABELS = useMemo(() => accountStatusLabels(t), [t]);
  const STATUS_OPTIONS = useMemo(
    () => Object.entries(ACCOUNT_STATUS_LABELS).map(([value, label]) => ({ value, label })),
    [ACCOUNT_STATUS_LABELS]
  );
  const searchParams = useSearchParams();
  const [locataires, setLocataires] = useState([]);
  const [baux, setBaux] = useState([]);
  const [echeances, setEcheances] = useState([]);
  const [paiements, setPaiements] = useState([]);
  const [biens, setBiens] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const [search, setSearch] = useState("");
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [sortBy, setSortBy] = useState("recent");
  const [currentPage, setCurrentPage] = useState(1);

  const [formOpen, setFormOpen] = useState(false);
  const [formDraft, setFormDraft] = useState(EMPTY_FORM);
  const [formBusy, setFormBusy] = useState(false);
  const [formBanner, setFormBanner] = useState(null);
  const [planLimitMessage, setPlanLimitMessage] = useState(null);
  const { checkBeforeOpen } = usePlanGate("locataires");

  const [selectedId, setSelectedId] = useState(null);
  const [statusBusyId, setStatusBusyId] = useState(null);
  const [statusBanner, setStatusBanner] = useState(null);

  useEffect(() => {
    async function init() {
      setIsLoading(true);
      try {
        const [locatairesList, bauxList, echeancesList, paiementsList, biensList] = await Promise.all([
          fetchLocataires(),
          fetchBaux(),
          fetchEcheances(),
          fetchPaiements(),
          fetchBiens(),
        ]);
        setLocataires(locatairesList);
        setBaux(bauxList);
        setEcheances(echeancesList);
        setPaiements(paiementsList);
        setBiens(biensList);
      } catch (err) {
        setLoadError(extractErrorMessage(err));
      } finally {
        setIsLoading(false);
      }
    }
    init();
  }, []);

  function bauxOf(locataireId) {
    return baux.filter((b) => b.locataire_id === locataireId);
  }

  function echeancesOf(locataireId) {
    const bailIds = new Set(bauxOf(locataireId).map((b) => b.id));
    return echeances.filter((e) => bailIds.has(e.bail_id));
  }

  function paiementsOf(locataireId) {
    const bailIds = new Set(bauxOf(locataireId).map((b) => b.id));
    return paiements.filter((p) => bailIds.has(p.echeance?.bail_id));
  }

  function bienLotLabel(bail) {
    const bien = biens.find((b) => b.id === bail.lot?.bien_id);
    const bienName = bien?.designation || `Bien #${bail.lot?.bien_id}`;
    return `${bienName} — ${bail.lot?.reference || `Lot #${bail.lot_id}`}`;
  }

  const locataireHasOverdue = useMemo(() => {
    const map = new Map();
    locataires.forEach((l) => {
      map.set(l.id, echeancesOf(l.id).some(isOverdue));
    });
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locataires, baux, echeances]);

  const stats = useMemo(() => {
    const avecBailActif = locataires.filter((l) => bauxOf(l.id).some((b) => b.statut === BAIL_STATUS.ACTIF)).length;
    const enRetard = locataires.filter((l) => locataireHasOverdue.get(l.id)).length;
    const desactives = locataires.filter((l) => l.statut_compte !== ACCOUNT_STATUS.ACTIF).length;
    return { total: locataires.length, avecBailActif, enRetard, desactives };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locataires, baux, locataireHasOverdue]);

  const filteredLocataires = useMemo(() => {
    const term = search.trim().toLowerCase();
    const filtered = locataires.filter((l) => {
      if (term) {
        const activeBaux = bauxOf(l.id).filter((b) => b.statut === BAIL_STATUS.ACTIF);
        const haystack = [l.prenom, l.nom, l.email, ...activeBaux.map((b) => bienLotLabel(b))]
          .filter((v) => v !== null && v !== undefined && v !== "")
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      if (overdueOnly && !locataireHasOverdue.get(l.id)) return false;
      return true;
    });
    return sortList(filtered, sortBy, { dateOf: (l) => l.date_creation, nameOf: (l) => `${l.prenom} ${l.nom}` });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locataires, search, overdueOnly, sortBy, locataireHasOverdue, baux, biens]);

  const totalPages = Math.max(1, Math.ceil(filteredLocataires.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedLocataires = filteredLocataires.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const selected = locataires.find((l) => l.id === selectedId) || null;

  function openCreate() {
    const blockMessage = checkBeforeOpen();
    if (blockMessage) {
      setPlanLimitMessage(blockMessage);
      return;
    }
    setFormDraft(EMPTY_FORM);
    setFormBanner(null);
    setFormOpen(true);
  }

  useEffect(() => {
    function openIfRequested() {
      if (searchParams.get("create") === "1") {
        openCreate();
      }
    }
    openIfRequested();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function closeForm() {
    if (formBusy) return;
    setFormOpen(false);
  }

  async function handleSubmitForm(e) {
    e.preventDefault();
    setFormBusy(true);
    setFormBanner(null);
    try {
      const created = await createLocataire({
        prenom: formDraft.prenom,
        nom: formDraft.nom,
        email: formDraft.email,
        motDePasse: formDraft.mot_de_passe,
        statutCompte: Number(formDraft.statut_compte),
      });
      setLocataires((prev) => [...prev, created]);
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

  async function handleToggleStatus(locataire) {
    setStatusBanner(null);
    setStatusBusyId(locataire.id);
    try {
      const updated =
        locataire.statut_compte === ACCOUNT_STATUS.ACTIF
          ? await deactivateLocataire(locataire.id)
          : await activateLocataire(locataire.id);
      setLocataires((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
    } catch (err) {
      setStatusBanner({ type: "error", message: extractErrorMessage(err) });
    } finally {
      setStatusBusyId(null);
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
          <StatCard icon="bi-people-fill" tone="primary" label={t("bo.proprietaireLocataires.statTotal")} value={stats.total} />
          <StatCard icon="bi-file-earmark-check-fill" tone="accent" label={t("bo.proprietaireLocataires.statActiveLease")} value={stats.avecBailActif} />
          <StatCard icon="bi-exclamation-octagon-fill" tone="danger" label={t("bo.proprietaireLocataires.statOverdue")} value={stats.enRetard} />
          <StatCard icon="bi-slash-circle-fill" tone="warning" label={t("bo.proprietaireLocataires.statDisabled")} value={stats.desactives} />
        </div>
      </div>

      {/* ---- Table ---- */}
      <div className={styles.section} style={{ marginBottom: 0 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem" }}>
          <div>
            <h2 className={styles.sectionTitle}>
              <span className={styles.sectionIconBadge}>
                <i className="bi bi-people-fill" />
              </span>
              {t("bo.proprietaireLocataires.title")}
            </h2>
            <p className={styles.sectionSubtitle}>
              {t("bo.proprietaireLocataires.subtitle", { shown: filteredLocataires.length, total: locataires.length })}
            </p>
          </div>
          <button type="button" className={styles.btn} onClick={openCreate}>
            <i className="bi bi-plus-lg" />
            {t("bo.proprietaireLocataires.newTenant")}
          </button>
        </div>

        <div className={styles.filtersRow}>
          <div className={styles.searchFieldWrap}>
            <i className={`bi bi-search ${styles.searchFieldIcon}`} />
            <input
              type="text"
              placeholder={t("bo.proprietaireLocataires.searchPlaceholder")}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>
          <FilterChip
            checked={overdueOnly}
            onChange={(checked) => {
              setOverdueOnly(checked);
              setCurrentPage(1);
            }}
          >
            {t("bo.proprietaireLocataires.overdueOnly")}
          </FilterChip>
          <FilterSelect value={sortBy} onChange={setSortBy} options={SORT_OPTIONS} />
        </div>

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>{t("bo.proprietaireLocataires.colTenant")}</th>
                <th>{t("bo.proprietaireLocataires.colEmail")}</th>
                <th>{t("bo.proprietaireLocataires.colBiensOccupied")}</th>
                <th>{t("bo.proprietaireLocataires.colAccountStatus")}</th>
                <th>{t("bo.proprietaireLocataires.colActions")}</th>
              </tr>
            </thead>
            <tbody>
              {filteredLocataires.length === 0 && (
                <tr>
                  <td colSpan={5} className={styles.empty}>
                    {t("bo.common.noMatch")}
                  </td>
                </tr>
              )}
              {paginatedLocataires.map((l) => {
                const allBaux = bauxOf(l.id);
                const activeBaux = allBaux.filter((b) => b.statut === BAIL_STATUS.ACTIF);
                const initials = `${l.prenom?.[0] || ""}${l.nom?.[0] || ""}`.toUpperCase();
                const overdue = locataireHasOverdue.get(l.id);
                const isActive = selectedId === l.id;
                return (
                  <tr
                    key={l.id}
                    className={`${isActive ? styles.tableRowActive : ""} ${overdue ? styles.tenantRowOverdue : ""}`}
                  >
                    <td>
                      <div className={styles.userCell}>
                        <span className={`${styles.tenantAvatarRing} ${avatarRingClass(l, overdue)}`}>
                          {l.photo ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={`${API_BASE_URL}${l.photo}`}
                              alt=""
                              className={styles.tenantAvatarInner}
                              style={{ objectFit: "cover" }}
                            />
                          ) : (
                            <span className={styles.tenantAvatarInner}>{initials || "?"}</span>
                          )}
                        </span>
                        <div>
                          <div className={styles.userName}>
                            {l.prenom} {l.nom}
                          </div>
                          {overdue && (
                            <span className={styles.tenantOverdueTag}>
                              <i className="bi bi-exclamation-triangle-fill" />
                              {t("bo.proprietaireLocataires.overdueBadge")}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td>{l.email}</td>
                    <td>
                      <div className={styles.tenantBiensRow}>
                        {activeBaux.length > 0 ? (
                          activeBaux.map((b) => (
                            <span className={styles.tenantBienChip} key={b.id}>
                              <i className="bi bi-house-door" />
                              {bienLotLabel(b)}
                            </span>
                          ))
                        ) : (
                          <span style={{ color: "var(--text-muted)" }}>
                            {allBaux.length > 0 ? t("bo.proprietaireLocataires.noActiveLease") : "—"}
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      <span className={`${styles.badge} ${styles.badgeWithIcon} ${accountBadgeClass(l.statut_compte)}`}>
                        <i className={`bi ${accountStatusIcon(l.statut_compte)}`} />
                        {ACCOUNT_STATUS_LABELS[l.statut_compte]}
                      </span>
                    </td>
                    <td>
                      <div className={styles.tableActions}>
                        <button
                          type="button"
                          className={styles.iconBtn}
                          onClick={() => setSelectedId(isActive ? null : l.id)}
                          title={t("bo.common.seeDetails")}
                        >
                          <i className={`bi ${isActive ? "bi-chevron-up" : "bi-eye"}`} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {filteredLocataires.length > 0 && (
            <div className={styles.paginationRow}>
              <span>
                {t("bo.proprietaireLocataires.pageOf", { page: safePage, total: totalPages, count: filteredLocataires.length })}
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

        {/* ---- Détail du locataire ---- */}
        {selected && (
          <Drawer
            isOpen={!!selected}
            onClose={() => setSelectedId(null)}
            title={
              <div className={styles.detailHeaderIdentity}>
                <span
                  className={`${styles.tenantAvatarRing} ${styles.tenantAvatarRingLg} ${avatarRingClass(
                    selected,
                    locataireHasOverdue.get(selected.id)
                  )}`}
                >
                  {selected.photo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`${API_BASE_URL}${selected.photo}`}
                      alt=""
                      className={styles.tenantAvatarInner}
                      style={{ objectFit: "cover" }}
                    />
                  ) : (
                    <span className={styles.tenantAvatarInner}>
                      {`${selected.prenom?.[0] || ""}${selected.nom?.[0] || ""}`.toUpperCase() || "?"}
                    </span>
                  )}
                </span>
                <div>
                  <h3 className={styles.detailTitle}>
                    {selected.prenom} {selected.nom}
                  </h3>
                  <div className={styles.detailHeaderMeta}>
                    <span className={`${styles.badge} ${styles.badgeWithIcon} ${accountBadgeClass(selected.statut_compte)}`}>
                      <i className={`bi ${accountStatusIcon(selected.statut_compte)}`} />
                      {ACCOUNT_STATUS_LABELS[selected.statut_compte]}
                    </span>
                  </div>
                  <div className={styles.detailHeaderMeta} style={{ marginTop: "0.3rem" }}>
                    <i className="bi bi-envelope" />
                    {selected.email}
                  </div>
                </div>
              </div>
            }
          >
            <Banner banner={statusBanner} />
            {selected.statut_compte !== ACCOUNT_STATUS.INVITE_EN_ATTENTE && (
              <div className={styles.editActions} style={{ marginBottom: "1rem" }}>
                <button
                  type="button"
                  className={selected.statut_compte === ACCOUNT_STATUS.ACTIF ? styles.btnOutline : styles.btn}
                  onClick={() => handleToggleStatus(selected)}
                  disabled={statusBusyId === selected.id}
                >
                  <i className={`bi ${selected.statut_compte === ACCOUNT_STATUS.ACTIF ? "bi-slash-circle" : "bi-check-circle"}`} />
                  {selected.statut_compte === ACCOUNT_STATUS.ACTIF
                    ? t("bo.proprietaireLocataires.deactivate")
                    : t("bo.proprietaireLocataires.reactivate")}
                </button>
              </div>
            )}

            <div className={styles.tenantStatTiles}>
              <div className={styles.tenantStatTile}>
                <span className={styles.tenantStatTileIcon}>
                  <i className="bi bi-cash-stack" />
                </span>
                <div>
                  <div className={styles.tenantStatTileLabel}>{t("bo.proprietaireLocataires.totalPaid")}</div>
                  <div className={styles.tenantStatTileValue}>
                    {formatCurrency(paiementsOf(selected.id).reduce((sum, p) => sum + Number(p.montant || 0), 0))}
                  </div>
                </div>
              </div>
              <div className={styles.tenantStatTile}>
                <span className={`${styles.tenantStatTileIcon} ${styles.tenantStatTileIconDanger}`}>
                  <i className="bi bi-exclamation-triangle-fill" />
                </span>
                <div>
                  <div className={styles.tenantStatTileLabel}>{t("bo.proprietaireLocataires.overdueDueDates")}</div>
                  <div className={styles.tenantStatTileValue}>{echeancesOf(selected.id).filter(isOverdue).length}</div>
                </div>
              </div>
              <div className={styles.tenantStatTile}>
                <span className={styles.tenantStatTileIcon}>
                  <i className="bi bi-calendar-check" />
                </span>
                <div>
                  <div className={styles.tenantStatTileLabel}>{t("bo.proprietaireLocataires.memberSince")}</div>
                  <div className={styles.tenantStatTileValue} style={{ fontSize: "0.92rem" }}>
                    {formatDate(selected.date_creation)}
                  </div>
                </div>
              </div>
            </div>

            <div className={styles.detailBlockTitle}>
              <i className="bi bi-file-earmark-text-fill" />
              {t("bo.proprietaireLocataires.leaseHistory")}
            </div>
            <div className={styles.tableWrap} style={{ marginTop: "0.5rem" }}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>{t("bo.proprietaireLocataires.colBienLot")}</th>
                    <th>{t("bo.proprietaireLocataires.colPeriod")}</th>
                    <th>{t("bo.proprietaireLocataires.colRent")}</th>
                    <th>{t("bo.proprietaireLocataires.colStatus")}</th>
                  </tr>
                </thead>
                <tbody>
                  {bauxOf(selected.id).length === 0 && (
                    <tr>
                      <td colSpan={4} className={styles.empty}>
                        {t("bo.proprietaireLocataires.noLease")}
                      </td>
                    </tr>
                  )}
                  {bauxOf(selected.id).map((b) => (
                    <tr key={b.id}>
                      <td>{bienLotLabel(b)}</td>
                      <td>
                        {formatDate(b.date_debut)} → {formatDate(b.date_fin)}
                      </td>
                      <td>{formatCurrency(b.loyer)}</td>
                      <td>
                        <span className={`${styles.badge} ${bailBadgeClass(b.statut)}`}>
                          {BAIL_STATUS_LABELS[b.statut] || "—"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Drawer>
        )}
      </div>

      {/* ---- Nouveau locataire ---- */}
      <Modal isOpen={formOpen} onClose={closeForm} title={t("bo.proprietaireLocataires.createTitle")}>
        <form onSubmit={handleSubmitForm}>
          <Banner banner={formBanner} />
          <p className={styles.sectionSubtitle} style={{ marginBottom: "1rem" }}>
            {t("bo.proprietaireLocataires.createHint")}
          </p>
          <TextField
            label={t("bo.proprietaireLocataires.firstNameLabel")}
            name="prenom"
            value={formDraft.prenom}
            onChange={(e) => setFormDraft((d) => ({ ...d, prenom: e.target.value }))}
            required
          />
          <TextField
            label={t("bo.proprietaireLocataires.lastNameLabel")}
            name="nom"
            value={formDraft.nom}
            onChange={(e) => setFormDraft((d) => ({ ...d, nom: e.target.value }))}
            required
          />
          <TextField
            label={t("bo.proprietaireLocataires.emailLabel")}
            name="email"
            type="email"
            value={formDraft.email}
            onChange={(e) => setFormDraft((d) => ({ ...d, email: e.target.value }))}
            required
          />
          <TextField
            label={t("bo.proprietaireLocataires.passwordLabel")}
            name="mot_de_passe"
            type="password"
            value={formDraft.mot_de_passe}
            onChange={(e) => setFormDraft((d) => ({ ...d, mot_de_passe: e.target.value }))}
            hint={t("bo.proprietaireLocataires.passwordHint")}
            minLength={8}
            required
          />
          <SelectField
            label={t("bo.proprietaireLocataires.accountStatusLabel")}
            name="statut_compte"
            options={STATUS_OPTIONS}
            value={formDraft.statut_compte}
            onChange={(e) => setFormDraft((d) => ({ ...d, statut_compte: e.target.value }))}
          />

          <div className={styles.editActions} style={{ marginTop: "1.2rem" }}>
            <button type="submit" className={styles.btn} disabled={formBusy}>
              <i className="bi bi-check-lg" />
              {formBusy ? t("bo.proprietaireLocataires.creating") : t("bo.proprietaireLocataires.create")}
            </button>
            <button type="button" className={styles.btnOutline} onClick={closeForm} disabled={formBusy}>
              <i className="bi bi-x-lg" />
              {t("bo.common.cancel")}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
