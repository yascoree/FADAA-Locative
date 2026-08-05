"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { extractErrorMessage, isPlanLimitError, API_BASE_URL } from "@/lib/apiClient";
import {
  fetchMandates,
  fetchPermissionCatalog,
  fetchMandatePermissions,
  saveMandatePermissions,
  fetchGestionnaires,
  createMandate,
  createGestionnaireInvite,
  setMandateStatus,
  groupPermissionCatalog,
  formatMandateStatusLine,
  MANDAT_STATUS,
} from "@/lib/mandates";
import { fetchBiens } from "@/lib/properties";
import { SORT_OPTIONS, sortList } from "@/lib/sort";
import StatCard from "@/components/StatCard";
import SearchableSelect from "@/components/SearchableSelect";
import FilterSelect from "@/components/FilterSelect";
import PlanLimitPopup from "@/components/PlanLimitPopup";
import { useLanguage } from "@/context/LanguageContext";
import styles from "./permissions.module.css";

const RESOURCE_ICONS = {
  PROPERTY: "bi-house-door",
  LOT: "bi-grid-3x3-gap",
  LEASE: "bi-file-earmark-text",
  DUE_DATE: "bi-calendar-check",
  PAYMENT: "bi-cash-stack",
};

function resourceLabels(t) {
  return {
    PROPERTY: t("bo.permissionCatalog.resourceProperty"),
    LOT: t("bo.permissionCatalog.resourceLot"),
    LEASE: t("bo.permissionCatalog.resourceLease"),
    DUE_DATE: t("bo.permissionCatalog.resourceDueDate"),
    PAYMENT: t("bo.permissionCatalog.resourcePayment"),
  };
}

function actionLabels(t) {
  return {
    VIEW: t("bo.permissionCatalog.actionView"),
    CREATE: t("bo.permissionCatalog.actionCreate"),
    UPDATE: t("bo.permissionCatalog.actionUpdate"),
    DELETE: t("bo.permissionCatalog.actionDelete"),
  };
}

// Reflète la hiérarchie réelle des données (un bien contient des lots, qui
// contiennent des baux, qui ont des échéances, qui ont des paiements) : voir un
// niveau nécessite de voir tous les niveaux au-dessus dans cette liste.
const RESOURCE_HIERARCHY = ["PROPERTY", "LOT", "LEASE", "DUE_DATE", "PAYMENT"];

function ancestorsOf(resource) {
  const idx = RESOURCE_HIERARCHY.indexOf(resource);
  return idx <= 0 ? [] : RESOURCE_HIERARCHY.slice(0, idx);
}

function descendantsOf(resource) {
  const idx = RESOURCE_HIERARCHY.indexOf(resource);
  return idx === -1 ? [] : RESOURCE_HIERARCHY.slice(idx + 1);
}

function Banner({ banner }) {
  if (!banner) return null;
  return (
    <div className={`${styles.banner} ${banner.type === "success" ? styles.bannerSuccess : styles.bannerError}`}>
      <i className={`bi ${banner.type === "success" ? "bi-check-circle-fill" : "bi-exclamation-triangle-fill"}`} />
      {banner.message}
    </div>
  );
}

function bienLabel(mandat, t) {
  if (!mandat.bien_id) return t("bo.proprietairePermissions.allMyBiens");
  return mandat.bien?.designation || `Bien #${mandat.bien_id}`;
}

export default function GestionPermissionPage() {
  const { t } = useLanguage();
  const RESOURCE_LABELS = useMemo(() => resourceLabels(t), [t]);
  const ACTION_LABELS = useMemo(() => actionLabels(t), [t]);
  const { user } = useAuth();
  const [mandates, setMandates] = useState([]);
  const [biens, setBiens] = useState([]);
  const [groups, setGroups] = useState([]);
  const [grantedByMandate, setGrantedByMandate] = useState({});
  const [savingMandateIds, setSavingMandateIds] = useState(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [gestionnaires, setGestionnaires] = useState([]);
  const [selectedGestionnaire, setSelectedGestionnaire] = useState(null);
  const [scopeBienId, setScopeBienId] = useState("all");
  const [sortBy, setSortBy] = useState("recent");
  const [inviteBusy, setInviteBusy] = useState(false);
  const [banner, setBanner] = useState(null);
  const [planLimitMessage, setPlanLimitMessage] = useState(null);

  // "new" = créer un tout nouveau compte gestionnaire (seul moyen désormais,
  // un gestionnaire ne pouvant plus s'inscrire lui-même) ; "existing" = donner
  // l'accès à un gestionnaire déjà présent sur la plateforme.
  const [addMode, setAddMode] = useState("new");
  const [newPrenom, setNewPrenom] = useState("");
  const [newNom, setNewNom] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newScopeBienId, setNewScopeBienId] = useState("all");
  const [createBusy, setCreateBusy] = useState(false);
  const [inviteLink, setInviteLink] = useState(null);

  const [expandedGestionnaireId, setExpandedGestionnaireId] = useState(null);
  const [selectedMandatByGestionnaire, setSelectedMandatByGestionnaire] = useState({});

  useEffect(() => {
    async function init() {
      setIsLoading(true);
      try {
        const [mandateList, catalog, biensList, gestionnairesList] = await Promise.all([
          fetchMandates(),
          fetchPermissionCatalog(),
          fetchBiens(),
          fetchGestionnaires(),
        ]);
        const grantedEntries = await Promise.all(
          mandateList.map(async (mandat) => {
            const granted = await fetchMandatePermissions(mandat.id);
            return [mandat.id, new Set(granted.map((item) => item.permission.code))];
          })
        );
        setMandates(mandateList);
        setGroups(groupPermissionCatalog(catalog));
        setGrantedByMandate(Object.fromEntries(grantedEntries));
        setBiens(biensList);
        setGestionnaires(gestionnairesList);
      } catch (err) {
        setBanner({ type: "error", message: extractErrorMessage(err) });
      } finally {
        setIsLoading(false);
      }
    }
    init();
  }, []);

  async function reload() {
    const mandateList = await fetchMandates();
    setMandates(mandateList);
  }

  async function handleInvite(e) {
    e.preventDefault();
    setBanner(null);
    if (!selectedGestionnaire) {
      setBanner({ type: "error", message: t("bo.proprietairePermissions.selectGestionnaire") });
      return;
    }
    setInviteBusy(true);
    try {
      const gestionnaire = selectedGestionnaire;
      const bienId = scopeBienId === "all" ? null : Number(scopeBienId);
      const mandat = await createMandate({ gestionnaireId: gestionnaire.id, proprietaireId: user.id, bienId });
      const scopeLabel = bienId
        ? biens.find((b) => b.id === bienId)?.designation || `bien #${bienId}`
        : t("bo.proprietairePermissions.allMyBiens").toLowerCase();
      setBanner({
        type: "success",
        message: t("bo.proprietairePermissions.addedAs", { name: `${gestionnaire.prenom} ${gestionnaire.nom}`, scope: scopeLabel }),
      });
      setSelectedGestionnaire(null);
      setScopeBienId("all");
      // Le backend accorde automatiquement les permissions "Voir" par défaut : on
      // récupère l'état réel plutôt que de supposer un mandat vide.
      const granted = await fetchMandatePermissions(mandat.id);
      setGrantedByMandate((prev) => ({ ...prev, [mandat.id]: new Set(granted.map((item) => item.permission.code)) }));
      setExpandedGestionnaireId(gestionnaire.id);
      setSelectedMandatByGestionnaire((prev) => ({ ...prev, [gestionnaire.id]: mandat.id }));
      await reload();
    } catch (err) {
      if (isPlanLimitError(err)) {
        setPlanLimitMessage(extractErrorMessage(err));
      } else {
        setBanner({ type: "error", message: extractErrorMessage(err) });
      }
    } finally {
      setInviteBusy(false);
    }
  }

  async function handleCreateGestionnaire(e) {
    e.preventDefault();
    setBanner(null);
    setInviteLink(null);
    setCreateBusy(true);
    try {
      const bienId = newScopeBienId === "all" ? null : Number(newScopeBienId);
      const { utilisateur, mandat, invite_link } = await createGestionnaireInvite({
        nom: newNom,
        prenom: newPrenom,
        email: newEmail,
        bienId,
      });
      const scopeLabel = bienId
        ? biens.find((b) => b.id === bienId)?.designation || `bien #${bienId}`
        : t("bo.proprietairePermissions.allMyBiens").toLowerCase();
      setBanner({
        type: "success",
        message: t("bo.proprietairePermissions.accountCreatedFor", { name: `${utilisateur.prenom} ${utilisateur.nom}`, scope: scopeLabel }),
      });
      setInviteLink(invite_link || null);
      setNewPrenom("");
      setNewNom("");
      setNewEmail("");
      setNewScopeBienId("all");
      setGestionnaires((prev) => [...prev, utilisateur]);
      const granted = await fetchMandatePermissions(mandat.id);
      setGrantedByMandate((prev) => ({ ...prev, [mandat.id]: new Set(granted.map((item) => item.permission.code)) }));
      setExpandedGestionnaireId(utilisateur.id);
      setSelectedMandatByGestionnaire((prev) => ({ ...prev, [utilisateur.id]: mandat.id }));
      await reload();
    } catch (err) {
      if (isPlanLimitError(err)) {
        setPlanLimitMessage(extractErrorMessage(err));
      } else {
        setBanner({ type: "error", message: extractErrorMessage(err) });
      }
    } finally {
      setCreateBusy(false);
    }
  }

  async function handleToggleStatus(mandat) {
    const isRevoked = mandat.statut === MANDAT_STATUS.REVOQUE;
    try {
      await setMandateStatus(mandat.id, isRevoked ? MANDAT_STATUS.ACTIF : MANDAT_STATUS.REVOQUE);
      await reload();
    } catch (err) {
      if (isPlanLimitError(err)) {
        setPlanLimitMessage(extractErrorMessage(err));
      } else {
        setBanner({ type: "error", message: extractErrorMessage(err) });
      }
    }
  }

  async function handleTogglePermission(mandatId, code) {
    const currentSet = grantedByMandate[mandatId] || new Set();
    const nextSet = new Set(currentSet);
    if (nextSet.has(code)) {
      nextSet.delete(code);
      // Écriture sans lecture n'a pas de sens : désactiver "Voir" retire aussi
      // Créer/Modifier/Supprimer pour la même ressource. Et comme un bien contient
      // des lots, qui contiennent des baux, etc., ça retire aussi TOUTES les
      // permissions des ressources en dessous dans la hiérarchie.
      if (code.startsWith("VIEW_")) {
        const resource = code.slice("VIEW_".length);
        [resource, ...descendantsOf(resource)].forEach((res) => {
          groups.find((g) => g.resource === res)?.permissions.forEach((p) => nextSet.delete(p.code));
        });
      }
    } else {
      nextSet.add(code);
    }

    // Optimistic update + auto-save immédiat (pas de bouton "Enregistrer").
    setGrantedByMandate((prev) => ({ ...prev, [mandatId]: nextSet }));
    setSavingMandateIds((prev) => new Set(prev).add(mandatId));
    try {
      await saveMandatePermissions(mandatId, Array.from(nextSet));
    } catch (err) {
      setGrantedByMandate((prev) => ({ ...prev, [mandatId]: currentSet }));
      setBanner({ type: "error", message: extractErrorMessage(err) });
    } finally {
      setSavingMandateIds((prev) => {
        const next = new Set(prev);
        next.delete(mandatId);
        return next;
      });
    }
  }

  const gestionnaireGroups = useMemo(() => {
    const map = new Map();
    mandates.forEach((mandat) => {
      const gid = mandat.gestionnaire?.id;
      if (gid == null) return;
      if (!map.has(gid)) {
        map.set(gid, { gestionnaire: mandat.gestionnaire, mandats: [] });
      }
      map.get(gid).mandats.push(mandat);
    });
    const groups = Array.from(map.values());
    return sortList(groups, sortBy, {
      // Le plus récent mandat du groupe (date de début, ou date de mise à jour à
      // défaut) sert de date de référence pour le gestionnaire dans son ensemble.
      dateOf: (g) =>
        g.mandats.reduce((latest, m) => {
          const d = m.date_debut || m.updated_at;
          return d && (!latest || new Date(d) > new Date(latest)) ? d : latest;
        }, null),
      nameOf: (g) => `${g.gestionnaire?.prenom || ""} ${g.gestionnaire?.nom || ""}`,
    });
  }, [mandates, sortBy]);

  function toggleExpand(gestionnaireId, firstMandatId) {
    setExpandedGestionnaireId((prev) => (prev === gestionnaireId ? null : gestionnaireId));
    setSelectedMandatByGestionnaire((prev) =>
      prev[gestionnaireId] ? prev : { ...prev, [gestionnaireId]: firstMandatId }
    );
  }

  const activeCount = mandates.filter((m) => m.statut === MANDAT_STATUS.ACTIF).length;
  const revokedCount = mandates.length - activeCount;

  return (
    <div>
      <PlanLimitPopup message={planLimitMessage} onClose={() => setPlanLimitMessage(null)} />
      <div className={styles.pageHeader}>
        <div>
          <h2 className={styles.pageTitle}>
            <i className="bi bi-people-fill" />
            {t("bo.proprietairePermissions.title")}
          </h2>
          <p className={styles.pageSubtitle}>{t("bo.proprietairePermissions.subtitle")}</p>
        </div>
      </div>

      <div className={styles.statsGrid}>
        <StatCard icon="bi-person-badge-fill" tone="primary" label={t("bo.proprietairePermissions.statManagers")} value={gestionnaireGroups.length} />
        <StatCard icon="bi-check-circle-fill" tone="accent" label={t("bo.proprietairePermissions.statActiveMandates")} value={activeCount} />
        <StatCard icon="bi-slash-circle-fill" tone="warning" label={t("bo.proprietairePermissions.statRevokedMandates")} value={revokedCount} />
      </div>

      <div className={styles.card}>
        <div className={styles.modeSwitch} role="tablist" aria-label={t("bo.proprietairePermissions.addTabsLabel")}>
          <span
            className={styles.modeSwitchIndicator}
            style={{ transform: addMode === "existing" ? "translateX(100%)" : "translateX(0%)" }}
            aria-hidden="true"
          />
          <button
            type="button"
            role="tab"
            aria-selected={addMode === "new"}
            className={`${styles.modeSwitchBtn} ${addMode === "new" ? styles.modeSwitchBtnActive : ""}`}
            onClick={() => {
              setAddMode("new");
              setBanner(null);
              setInviteLink(null);
            }}
          >
            <i className="bi bi-person-fill-add" />
            {t("bo.proprietairePermissions.createTab")}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={addMode === "existing"}
            className={`${styles.modeSwitchBtn} ${addMode === "existing" ? styles.modeSwitchBtnActive : ""}`}
            onClick={() => {
              setAddMode("existing");
              setBanner(null);
              setInviteLink(null);
            }}
          >
            <i className="bi bi-person-check-fill" />
            {t("bo.proprietairePermissions.grantAccessTab")}
          </button>
        </div>

        <div key={addMode} className={styles.formPane}>
          {addMode === "new" ? (
            <>
              <h3 className={styles.cardTitle}>
                <i className="bi bi-person-fill-add" />
                {t("bo.proprietairePermissions.createTitle")}
              </h3>
              <p className={styles.subtitle}>{t("bo.proprietairePermissions.createSubtitle")}</p>

              <form onSubmit={handleCreateGestionnaire}>
                <div className={styles.inviteRow}>
                  <div className={styles.inviteField} style={{ flex: 1, minWidth: 160 }}>
                    <label htmlFor="new-gest-prenom">{t("bo.proprietairePermissions.firstNameLabel")}</label>
                    <input
                      id="new-gest-prenom"
                      type="text"
                      value={newPrenom}
                      onChange={(e) => setNewPrenom(e.target.value)}
                      placeholder={t("bo.proprietairePermissions.firstNameLabel")}
                      required
                    />
                  </div>
                  <div className={styles.inviteField} style={{ flex: 1, minWidth: 160 }}>
                    <label htmlFor="new-gest-nom">{t("bo.proprietairePermissions.lastNameLabel")}</label>
                    <input
                      id="new-gest-nom"
                      type="text"
                      value={newNom}
                      onChange={(e) => setNewNom(e.target.value)}
                      placeholder={t("bo.proprietairePermissions.lastNameLabel")}
                      required
                    />
                  </div>
                  <div className={styles.inviteField}>
                    <label htmlFor="new-gest-email">{t("bo.proprietairePermissions.emailLabel")}</label>
                    <input
                      id="new-gest-email"
                      type="email"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      placeholder="gestionnaire@exemple.com"
                      required
                    />
                  </div>
                  <div className={`${styles.inviteField} ${styles.scopeField}`}>
                    <label htmlFor="new-gest-scope">{t("bo.proprietairePermissions.scopeLabel")}</label>
                    <FilterSelect
                      id="new-gest-scope"
                      value={newScopeBienId}
                      onChange={setNewScopeBienId}
                      options={[
                        { value: "all", label: t("bo.proprietairePermissions.allMyBiens") },
                        ...biens.map((b) => ({ value: b.id, label: b.designation || `Bien #${b.id}` })),
                      ]}
                    />
                  </div>
                  <button type="submit" className={styles.inviteButton} disabled={createBusy}>
                    <i className="bi bi-plus-lg" />
                    {createBusy ? t("bo.proprietairePermissions.creatingAccount") : t("bo.proprietairePermissions.createAccount")}
                  </button>
                </div>
              </form>

              <p className={styles.note}>
                <i className="bi bi-info-circle-fill" />
                {t("bo.proprietairePermissions.autoViewHint")}
              </p>

              {inviteLink && (
                <div className={styles.inviteLinkBox}>
                  <i className="bi bi-link-45deg" />
                  <div>
                    <div className={styles.inviteLinkLabel}>{t("bo.proprietairePermissions.inviteLinkHint")}</div>
                    <div className={styles.inviteLinkRow}>
                      <input type="text" readOnly value={inviteLink} onFocus={(e) => e.target.select()} />
                      <button
                        type="button"
                        onClick={() => navigator.clipboard?.writeText(inviteLink)}
                      >
                        <i className="bi bi-clipboard" /> {t("bo.proprietairePermissions.copy")}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <Banner banner={banner} />
            </>
          ) : (
            <>
              <h3 className={styles.cardTitle}>
                <i className="bi bi-person-check-fill" />
                {t("bo.proprietairePermissions.existingTitle")}
              </h3>
              <p className={styles.subtitle}>{t("bo.proprietairePermissions.existingSubtitle")}</p>

              <form onSubmit={handleInvite}>
                <div className={styles.inviteRow}>
                  <div className={styles.inviteField}>
                    <label htmlFor="gestionnaire-search">{t("bo.proprietairePermissions.gestionnaireLabel")}</label>
                    <SearchableSelect
                      id="gestionnaire-search"
                      items={gestionnaires}
                      getId={(g) => g.id}
                      getLabel={(g) => `${g.prenom} ${g.nom}`}
                      getMeta={(g) => g.email}
                      value={selectedGestionnaire}
                      onSelect={setSelectedGestionnaire}
                      placeholder={t("bo.proprietairePermissions.searchGestionnaire")}
                    />
                  </div>
                  <div className={`${styles.inviteField} ${styles.scopeField}`}>
                    <label htmlFor="gestionnaire-scope">{t("bo.proprietairePermissions.scopeLabel")}</label>
                    <FilterSelect
                      id="gestionnaire-scope"
                      value={scopeBienId}
                      onChange={setScopeBienId}
                      options={[
                        { value: "all", label: t("bo.proprietairePermissions.allMyBiens") },
                        ...biens.map((b) => ({ value: b.id, label: b.designation || `Bien #${b.id}` })),
                      ]}
                    />
                  </div>
                  <button type="submit" className={styles.inviteButton} disabled={inviteBusy || !selectedGestionnaire}>
                    <i className="bi bi-plus-lg" />
                    {inviteBusy ? t("bo.proprietairePermissions.adding") : t("bo.proprietairePermissions.grantAccess")}
                  </button>
                </div>
              </form>

              <p className={styles.note}>
                <i className="bi bi-info-circle-fill" />
                {t("bo.proprietairePermissions.existingHint")}
              </p>

              <Banner banner={banner} />
            </>
          )}
        </div>
      </div>

      {!isLoading && gestionnaireGroups.length === 0 && (
        <p className={styles.empty}>
          <i className="bi bi-person-x" style={{ display: "block", fontSize: "1.6rem", marginBottom: "0.5rem" }} />
          {t("bo.proprietairePermissions.noManagerYet")}
        </p>
      )}

      {gestionnaireGroups.length > 0 && (
        <div className={styles.listToolbar}>
          <span className={styles.listCount}>
            {t("bo.proprietairePermissions.managersCount", { count: gestionnaireGroups.length })}
          </span>
          <FilterSelect value={sortBy} onChange={setSortBy} options={SORT_OPTIONS} />
        </div>
      )}

      <div className={styles.list}>
        {gestionnaireGroups.map(({ gestionnaire, mandats }) => {
          const isExpanded = expandedGestionnaireId === gestionnaire.id;
          const selectedMandatId = selectedMandatByGestionnaire[gestionnaire.id] || mandats[0].id;
          const selectedMandat = mandats.find((m) => m.id === selectedMandatId) || mandats[0];
          const isActive = selectedMandat.statut === MANDAT_STATUS.ACTIF;
          const granted = grantedByMandate[selectedMandat.id] || new Set();
          const isSaving = savingMandateIds.has(selectedMandat.id);
          const initials = `${gestionnaire.prenom?.[0] || ""}${gestionnaire.nom?.[0] || ""}`.toUpperCase();
          const activeMandatsCount = mandats.filter((m) => m.statut === MANDAT_STATUS.ACTIF).length;

          return (
            <div className={styles.gestCard} key={gestionnaire.id}>
              <div className={styles.gestHeader}>
                <div className={styles.gestIdentity}>
                  {gestionnaire.photo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`${API_BASE_URL}${gestionnaire.photo}`}
                      alt=""
                      className={styles.avatar}
                      style={{ objectFit: "cover" }}
                    />
                  ) : (
                    <span className={styles.avatar}>{initials || "?"}</span>
                  )}
                  <div>
                    <div className={styles.gestName}>
                      {gestionnaire.prenom} {gestionnaire.nom}
                    </div>
                    <div className={styles.gestMeta}>
                      <i className="bi bi-envelope" />
                      {gestionnaire.email}
                      <span className={styles.gestMetaDot}>·</span>
                      <i className="bi bi-house-door" />
                      {t("bo.proprietairePermissions.biensCount", { count: mandats.length, active: activeMandatsCount })}
                    </div>
                  </div>
                </div>
                <div className={styles.gestHeaderRight}>
                  <button
                    type="button"
                    className={styles.permissionsButton}
                    onClick={() => toggleExpand(gestionnaire.id, mandats[0].id)}
                  >
                    <i className={`bi ${isExpanded ? "bi-chevron-up" : "bi-shield-lock"}`} />
                    {t("bo.proprietairePermissions.permissionsButton")}
                  </button>
                </div>
              </div>

              {isExpanded && (
                <>
                  <div className={styles.bienPickerRow}>
                    {mandats.map((m) => {
                      const mActive = m.statut === MANDAT_STATUS.ACTIF;
                      const isSelected = m.id === selectedMandatId;
                      return (
                        <button
                          type="button"
                          key={m.id}
                          className={`${styles.bienChip} ${isSelected ? styles.bienChipActive : ""}`}
                          onClick={() =>
                            setSelectedMandatByGestionnaire((prev) => ({ ...prev, [gestionnaire.id]: m.id }))
                          }
                        >
                          <i className="bi bi-house-door" />
                          {bienLabel(m, t)}
                          <span className={mActive ? styles.bienChipDotActive : styles.bienChipDotRevoked} />
                        </button>
                      );
                    })}
                  </div>

                  <div className={styles.permHeader}>
                    <span className={styles.permHeaderLabel}>
                      {t("bo.proprietairePermissions.permissionsFor", { bien: bienLabel(selectedMandat, t) })}
                    </span>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.7rem" }}>
                      {isSaving && (
                        <span className={styles.savingTag}>
                          <span className={styles.savingDot} />
                          {t("bo.proprietairePermissions.saving")}
                        </span>
                      )}
                      <span className={`${styles.badge} ${isActive ? styles.badgeActive : styles.badgeRevoked}`}>
                        {isActive ? t("bo.proprietairePermissions.active") : t("bo.proprietairePermissions.revoked")}
                      </span>
                      <button
                        type="button"
                        className={`${styles.statusButton} ${isActive ? styles.statusButtonRevoke : styles.statusButtonReactivate}`}
                        onClick={() => handleToggleStatus(selectedMandat)}
                      >
                        <i className={`bi ${isActive ? "bi-slash-circle" : "bi-arrow-counterclockwise"}`} />
                        {isActive ? t("bo.proprietairePermissions.revoke") : t("bo.proprietairePermissions.reactivate")}
                      </button>
                    </div>
                  </div>

                  {!isActive && (
                    <p className={styles.revokedNotice}>
                      <i className="bi bi-lock-fill" />
                      {t("bo.proprietairePermissions.revokedNotice")}
                    </p>
                  )}

                  <div className={styles.grid}>
                    {groups.map((group) => {
                      const viewCode = `VIEW_${group.resource}`;
                      const viewGranted = granted.has(viewCode);
                      const blockedByAncestor = ancestorsOf(group.resource).some(
                        (ancestor) => !granted.has(`VIEW_${ancestor}`)
                      );
                      return (
                      <div key={group.resource} className={styles.group}>
                        <div className={styles.groupLabel}>
                          <i className={`bi ${RESOURCE_ICONS[group.resource] || "bi-gear"}`} />
                          {RESOURCE_LABELS[group.resource] || group.resource}
                        </div>
                        {blockedByAncestor && (
                          <p className={styles.groupBlockedHint}>
                            <i className="bi bi-arrow-up-circle" />{" "}
                            {t("bo.proprietairePermissions.requiresView", {
                              resources: ancestorsOf(group.resource)
                                .map((r) => RESOURCE_LABELS[r] || r)
                                .join(", "),
                            })}
                          </p>
                        )}
                        {group.permissions.map((permission) => {
                          const actionLabel = ACTION_LABELS[permission._action] || permission.libelle.split(" ")[0];
                          const isViewPermission = permission.code === viewCode;
                          const disabled =
                            !isActive ||
                            isSaving ||
                            blockedByAncestor ||
                            (!isViewPermission && !viewGranted);
                          const checked = granted.has(permission.code);
                          return (
                            <label
                              key={permission.code}
                              className={`${styles.switchRow} ${disabled ? styles.switchRowDisabled : ""}`}
                            >
                              <span className={styles.switchRowLabel}>{actionLabel}</span>
                              <span style={{ position: "relative", display: "inline-flex" }}>
                                <input
                                  type="checkbox"
                                  className={styles.switchInput}
                                  checked={checked}
                                  disabled={disabled}
                                  onChange={() => handleTogglePermission(selectedMandat.id, permission.code)}
                                />
                                <span className={styles.switchTrack} />
                              </span>
                            </label>
                          );
                        })}
                      </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
