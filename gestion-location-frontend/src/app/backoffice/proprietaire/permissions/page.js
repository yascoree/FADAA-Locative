"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { extractErrorMessage, isPlanLimitError } from "@/lib/apiClient";
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
  summarizeAccessLevel,
  mandatScopeLabel,
  accessLevelLabel,
  MANDAT_STATUS,
} from "@/lib/mandates";
import { fetchBiens } from "@/lib/properties";
import { fetchAgenceMembers, ROLE_AGENCE } from "@/lib/agences";
import { fetchMyInvitations, acceptInvitation, declineInvitation, INVITATION_CLIENT_STATUS } from "@/lib/invitationsClient";
import StatCard from "@/components/StatCard";
import FilterSelect from "@/components/FilterSelect";
import Modal from "@/components/Modal";
import Drawer from "@/components/Drawer";
import PermissionsMatrix from "@/components/PermissionsMatrix";
import PlanLimitPopup from "@/components/PlanLimitPopup";
import { useLanguage } from "@/context/LanguageContext";
import styles from "./permissions.module.css";

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
  return mandatScopeLabel(mandat, t("bo.proprietairePermissions.allMyBiens"));
}

function accessBadgeClass(level) {
  if (level === "full") return styles.badgeActive;
  if (level === "readonly") return styles.badgeInfo;
  return styles.badgeWarning;
}

const EMPTY_NEW_FORM = { prenom: "", nom: "", email: "", scopeBienId: "all" };

export default function AgencesPage() {
  const { t } = useLanguage();
  const { user } = useAuth();

  const [mandates, setMandates] = useState([]);
  const [biens, setBiens] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [groups, setGroups] = useState([]);
  const [grantedByMandate, setGrantedByMandate] = useState({});
  const [gestionnaires, setGestionnaires] = useState([]);
  const [membersByAgence, setMembersByAgence] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [banner, setBanner] = useState(null);
  const [planLimitMessage, setPlanLimitMessage] = useState(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [inviteMenuOpen, setInviteMenuOpen] = useState(false);
  const inviteMenuRef = useRef(null);

  const [newForm, setNewForm] = useState(EMPTY_NEW_FORM);
  const [newModalOpen, setNewModalOpen] = useState(false);
  const [createBusy, setCreateBusy] = useState(false);
  const [inviteLink, setInviteLink] = useState(null);

  const [existingModalOpen, setExistingModalOpen] = useState(false);
  const [agencySearch, setAgencySearch] = useState("");
  const [selectedAgencyId, setSelectedAgencyId] = useState(null);
  const [scopeBienId, setScopeBienId] = useState("all");
  const [inviteBusy, setInviteBusy] = useState(false);

  const [selectedAgenceId, setSelectedAgenceId] = useState(null);
  const [collaboratorsModalOpen, setCollaboratorsModalOpen] = useState(false);
  const [permissionsModalMandatId, setPermissionsModalMandatId] = useState(null);
  const [savingMandateIds, setSavingMandateIds] = useState(new Set());

  const [invitations, setInvitations] = useState([]);
  const [invitationBusyId, setInvitationBusyId] = useState(null);
  const [invitationBanner, setInvitationBanner] = useState(null);
  const [acceptScopeInvitation, setAcceptScopeInvitation] = useState(null);
  const [acceptScopeBienId, setAcceptScopeBienId] = useState("all");
  const [acceptScopeBusy, setAcceptScopeBusy] = useState(false);
  const [detailsInvitationId, setDetailsInvitationId] = useState(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (inviteMenuRef.current && !inviteMenuRef.current.contains(e.target)) setInviteMenuOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function loadAgenceMembers(mandateList) {
    const activeAgenceIds = [
      ...new Set(mandateList.filter((m) => m.statut === MANDAT_STATUS.ACTIF && m.agence).map((m) => m.agence.id)),
    ];
    const entries = await Promise.all(activeAgenceIds.map(async (id) => [id, await fetchAgenceMembers(id)]));
    setMembersByAgence(Object.fromEntries(entries));
  }

  useEffect(() => {
    async function init() {
      setIsLoading(true);
      try {
        const [mandateList, catalogList, biensList, gestionnairesList, invitationList] = await Promise.all([
          fetchMandates(),
          fetchPermissionCatalog(),
          fetchBiens(),
          fetchGestionnaires(),
          fetchMyInvitations(),
        ]);
        const grantedEntries = await Promise.all(
          mandateList.map(async (mandat) => {
            const granted = await fetchMandatePermissions(mandat.id);
            return [mandat.id, new Set(granted.map((item) => item.permission.code))];
          })
        );
        setMandates(mandateList);
        setCatalog(catalogList);
        setGroups(groupPermissionCatalog(catalogList));
        setGrantedByMandate(Object.fromEntries(grantedEntries));
        setBiens(biensList);
        setGestionnaires(gestionnairesList);
        setInvitations(invitationList);
        await loadAgenceMembers(mandateList);
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
    await loadAgenceMembers(mandateList);
  }

  const agenceGroups = useMemo(() => {
    const map = new Map();
    mandates.forEach((mandat) => {
      const aid = mandat.agence?.id;
      if (aid == null) return;
      if (!map.has(aid)) map.set(aid, { agence: mandat.agence, mandats: [] });
      map.get(aid).mandats.push(mandat);
    });
    return Array.from(map.values()).map((g) => {
      const hasActive = g.mandats.some((m) => m.statut === MANDAT_STATUS.ACTIF);
      const createdAt = g.mandats.reduce(
        (min, m) => (!min || new Date(m.created_at) < new Date(min) ? m.created_at : min),
        null
      );
      const updatedAt = g.mandats.reduce(
        (max, m) => (!max || new Date(m.updated_at) > new Date(max) ? m.updated_at : max),
        null
      );
      return { ...g, hasActive, createdAt, updatedAt };
    });
  }, [mandates]);

  // Répertoire d'agences (pas de personnes individuelles) dérivé de la liste des
  // gestionnaires de la plateforme — /users/gestionnaires les liste à plat, on les
  // regroupe ici par agence pour que le propriétaire choisisse "Atlas Immobilier",
  // pas un membre précis de son équipe. Les agences déjà partenaires sont exclues :
  // ce picker sert à en ajouter une nouvelle, pas à re-sélectionner l'existante.
  const agencyDirectory = useMemo(() => {
    const partnerIds = new Set(agenceGroups.map((g) => g.agence.id));
    const map = new Map();
    gestionnaires.forEach((g) => {
      if (!g.agence_id || partnerIds.has(g.agence_id)) return;
      if (!map.has(g.agence_id)) map.set(g.agence_id, { id: g.agence_id, nom: g.agence_nom, members: [] });
      map.get(g.agence_id).members.push(g);
    });
    return Array.from(map.values()).sort((a, b) => a.nom.localeCompare(b.nom));
  }, [gestionnaires, agenceGroups]);

  const filteredAgencyDirectory = useMemo(() => {
    const term = agencySearch.trim().toLowerCase();
    if (!term) return agencyDirectory;
    return agencyDirectory.filter((a) => a.nom.toLowerCase().includes(term));
  }, [agencyDirectory, agencySearch]);

  const selectedAgencyFromDirectory = agencyDirectory.find((a) => a.id === selectedAgencyId) || null;

  // Taille d'équipe par agence, tous statuts de partenariat confondus (contrairement
  // à agencyDirectory qui exclut volontairement les agences déjà partenaires) — sert
  // uniquement à afficher "X collaborateurs" dans le détail d'une invitation.
  const agencyMemberCounts = useMemo(() => {
    const counts = {};
    gestionnaires.forEach((g) => {
      if (!g.agence_id) return;
      counts[g.agence_id] = (counts[g.agence_id] || 0) + 1;
    });
    return counts;
  }, [gestionnaires]);

  // Invitations qui appellent encore une action : en attente d'une réponse, ou
  // déjà acceptées mais dont le Mandat n'a pas encore été configuré (l'acceptation
  // n'établit que la relation — voir lib/invitationsClient — la portée/permissions
  // restent à choisir ici, comme pour une agence ajoutée spontanément).
  const actionableInvitations = useMemo(
    () =>
      invitations
        .filter((inv) => {
          if (inv.statut === INVITATION_CLIENT_STATUS.EN_ATTENTE) return true;
          if (inv.statut === INVITATION_CLIENT_STATUS.ACCEPTEE) {
            return !agenceGroups.some((g) => g.agence.id === inv.agence.id);
          }
          return false;
        })
        .map((inv) => ({ ...inv, needsScope: inv.statut === INVITATION_CLIENT_STATUS.ACCEPTEE })),
    [invitations, agenceGroups]
  );

  const detailsInvitation = actionableInvitations.find((inv) => inv.id === detailsInvitationId) || null;

  async function handleAcceptInvitation(invitation) {
    setInvitationBanner(null);
    setInvitationBusyId(invitation.id);
    try {
      const updated = await acceptInvitation(invitation.id);
      setInvitations((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
      setAcceptScopeBienId("all");
      setAcceptScopeInvitation(updated);
    } catch (err) {
      setInvitationBanner({ type: "error", message: extractErrorMessage(err) });
    } finally {
      setInvitationBusyId(null);
    }
  }

  async function handleDeclineInvitation(invitation) {
    setInvitationBanner(null);
    setInvitationBusyId(invitation.id);
    try {
      const updated = await declineInvitation(invitation.id);
      setInvitations((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
    } catch (err) {
      setInvitationBanner({ type: "error", message: extractErrorMessage(err) });
    } finally {
      setInvitationBusyId(null);
    }
  }

  async function handleConfirmAcceptScope(e) {
    e.preventDefault();
    if (!acceptScopeInvitation) return;
    setAcceptScopeBusy(true);
    setInvitationBanner(null);
    try {
      const bienId = acceptScopeBienId === "all" ? null : Number(acceptScopeBienId);
      const mandat = await createMandate({ agenceId: acceptScopeInvitation.agence.id, proprietaireId: user.id, bienId });
      const granted = await fetchMandatePermissions(mandat.id);
      setGrantedByMandate((prev) => ({ ...prev, [mandat.id]: new Set(granted.map((item) => item.permission.code)) }));
      await reload();
      setAcceptScopeInvitation(null);
    } catch (err) {
      if (isPlanLimitError(err)) {
        setPlanLimitMessage(extractErrorMessage(err));
      } else {
        setInvitationBanner({ type: "error", message: extractErrorMessage(err) });
      }
    } finally {
      setAcceptScopeBusy(false);
    }
  }

  const filteredAgenceGroups = useMemo(() => {
    const term = search.trim().toLowerCase();
    return agenceGroups.filter((g) => {
      if (term && !g.agence.nom.toLowerCase().includes(term)) return false;
      if (statusFilter === "active" && !g.hasActive) return false;
      if (statusFilter === "revoked" && g.hasActive) return false;
      return true;
    });
  }, [agenceGroups, search, statusFilter]);

  const totalBiensGeres = useMemo(() => {
    const ids = new Set(mandates.filter((m) => m.statut === MANDAT_STATUS.ACTIF && m.bien_id).map((m) => m.bien_id));
    const hasPortfolioWide = mandates.some((m) => m.statut === MANDAT_STATUS.ACTIF && !m.bien_id);
    return hasPortfolioWide ? biens.length : ids.size;
  }, [mandates, biens]);

  const totalCollaborateurs = useMemo(() => {
    const ids = new Set();
    Object.values(membersByAgence).forEach((members) => members.forEach((m) => ids.add(m.utilisateur?.id)));
    return ids.size;
  }, [membersByAgence]);

  function openNewModal() {
    setInviteMenuOpen(false);
    setBanner(null);
    setInviteLink(null);
    setNewForm(EMPTY_NEW_FORM);
    setNewModalOpen(true);
  }

  function openExistingModal() {
    setInviteMenuOpen(false);
    setBanner(null);
    setAgencySearch("");
    setSelectedAgencyId(null);
    setScopeBienId("all");
    setExistingModalOpen(true);
  }

  async function handleCreateGestionnaire(e) {
    e.preventDefault();
    setBanner(null);
    setInviteLink(null);
    setCreateBusy(true);
    try {
      const bienId = newForm.scopeBienId === "all" ? null : Number(newForm.scopeBienId);
      const { utilisateur, mandat, invite_link } = await createGestionnaireInvite({
        nom: newForm.nom,
        prenom: newForm.prenom,
        email: newForm.email,
        bienId,
      });
      setInviteLink(invite_link || null);
      setGestionnaires((prev) => [...prev, { ...utilisateur, agence_id: mandat.agence?.id, agence_nom: mandat.agence?.nom }]);
      const granted = await fetchMandatePermissions(mandat.id);
      setGrantedByMandate((prev) => ({ ...prev, [mandat.id]: new Set(granted.map((item) => item.permission.code)) }));
      await reload();
      if (!invite_link) setNewModalOpen(false);
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

  async function handleInviteExisting(e) {
    e.preventDefault();
    setBanner(null);
    if (!selectedAgencyFromDirectory) return;
    setInviteBusy(true);
    try {
      const bienId = scopeBienId === "all" ? null : Number(scopeBienId);
      const mandat = await createMandate({ agenceId: selectedAgencyFromDirectory.id, proprietaireId: user.id, bienId });
      const granted = await fetchMandatePermissions(mandat.id);
      setGrantedByMandate((prev) => ({ ...prev, [mandat.id]: new Set(granted.map((item) => item.permission.code)) }));
      await reload();
      setExistingModalOpen(false);
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

  async function handleToggleMandatStatus(mandat) {
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
      if (code.startsWith("VIEW_")) {
        const resource = code.slice("VIEW_".length);
        const order = ["PROPERTY", "LOT", "LEASE", "DUE_DATE", "PAYMENT"];
        const idx = order.indexOf(resource);
        const descendants = idx === -1 ? [] : order.slice(idx + 1);
        [resource, ...descendants].forEach((res) => {
          groups.find((g) => g.resource === res)?.permissions.forEach((p) => nextSet.delete(p.code));
        });
      }
    } else {
      nextSet.add(code);
    }
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

  const selectedGroup = agenceGroups.find((g) => g.agence.id === selectedAgenceId) || null;
  const selectedMembers = selectedAgenceId ? membersByAgence[selectedAgenceId] || [] : [];
  const permissionsMandat = mandates.find((m) => m.id === permissionsModalMandatId) || null;

  if (isLoading) {
    return <p>{t("bo.common.loading")}</p>;
  }

  return (
    <div>
      <PlanLimitPopup message={planLimitMessage} onClose={() => setPlanLimitMessage(null)} />

      <div className={styles.pageHeader}>
        <div>
          <h2 className={styles.pageTitle}>
            <i className="bi bi-building" />
            {t("bo.proprietairePermissions.title")}
          </h2>
          <p className={styles.pageSubtitle}>{t("bo.proprietairePermissions.subtitle")}</p>
        </div>
        <div ref={inviteMenuRef} style={{ position: "relative" }}>
          <button type="button" className={styles.inviteButton} onClick={() => setInviteMenuOpen((o) => !o)}>
            <i className="bi bi-plus-lg" />
            {t("bo.proprietairePermissions.inviteButton")}
            <i className="bi bi-chevron-down" style={{ fontSize: "0.7rem" }} />
          </button>
          {inviteMenuOpen && (
            <div className={styles.inviteMenu} role="menu">
              <button type="button" role="menuitem" onClick={openNewModal}>
                <i className="bi bi-person-fill-add" />
                {t("bo.proprietairePermissions.createTab")}
              </button>
              <button type="button" role="menuitem" onClick={openExistingModal}>
                <i className="bi bi-person-check-fill" />
                {t("bo.proprietairePermissions.grantAccessTab")}
              </button>
            </div>
          )}
        </div>
      </div>

      {actionableInvitations.length > 0 && (
        <div className={styles.invitationsBlock}>
          <Banner banner={invitationBanner} />
          {actionableInvitations.map((inv) => (
            <div key={inv.id} className={styles.invitationCard}>
              <div className={styles.invitationCardIcon}>
                <i className="bi bi-building" />
              </div>
              <div className={styles.invitationCardBody}>
                <div className={styles.invitationCardTitle}>
                  {inv.needsScope
                    ? t("bo.proprietairePermissions.invitationNeedsScope", { agence: inv.agence.nom })
                    : t("bo.proprietairePermissions.invitationPrompt", { agence: inv.agence.nom })}
                </div>
                <div className={styles.invitationCardSub}>
                  {inv.needsScope
                    ? t("bo.proprietairePermissions.invitationNeedsScopeSub")
                    : t("bo.proprietairePermissions.invitationPromptSub")}
                </div>
                <button
                  type="button"
                  className={styles.invitationCardDetailsLink}
                  onClick={() => setDetailsInvitationId(inv.id)}
                >
                  <i className="bi bi-info-circle" />
                  {t("bo.proprietairePermissions.invitationSeeDetails")}
                </button>
              </div>
              <div className={styles.invitationCardActions}>
                {inv.needsScope ? (
                  <button
                    type="button"
                    className={styles.btn}
                    onClick={() => {
                      setAcceptScopeBienId("all");
                      setAcceptScopeInvitation(inv);
                    }}
                  >
                    {t("bo.proprietairePermissions.configureAccess")}
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      className={styles.btnOutline}
                      disabled={invitationBusyId === inv.id}
                      onClick={() => handleDeclineInvitation(inv)}
                    >
                      {t("bo.proprietairePermissions.decline")}
                    </button>
                    <button
                      type="button"
                      className={styles.btn}
                      disabled={invitationBusyId === inv.id}
                      onClick={() => handleAcceptInvitation(inv)}
                    >
                      {invitationBusyId === inv.id ? t("bo.proprietairePermissions.accepting") : t("bo.proprietairePermissions.accept")}
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className={styles.statsGrid}>
        <StatCard icon="bi-building" tone="primary" label={t("bo.proprietairePermissions.statAgences")} value={agenceGroups.length} />
        <StatCard icon="bi-house-door-fill" tone="accent" label={t("bo.proprietairePermissions.statBiensGeres")} value={totalBiensGeres} />
        <StatCard icon="bi-people-fill" tone="warning" label={t("bo.proprietairePermissions.statCollaborateurs")} value={totalCollaborateurs} />
      </div>

      <div className={styles.filtersRow}>
        <input
          type="text"
          placeholder={t("bo.proprietairePermissions.searchPlaceholder")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <FilterSelect
          value={statusFilter}
          onChange={setStatusFilter}
          options={[
            { value: "all", label: t("bo.common.allStatuses") },
            { value: "active", label: t("bo.proprietairePermissions.active") },
            { value: "revoked", label: t("bo.proprietairePermissions.revoked") },
          ]}
        />
      </div>

      {filteredAgenceGroups.length === 0 && (
        <p className={styles.empty}>
          <i className="bi bi-building" style={{ display: "block", fontSize: "1.6rem", marginBottom: "0.5rem" }} />
          {t("bo.proprietairePermissions.noManagerYet")}
        </p>
      )}

      <div className={styles.list}>
        {filteredAgenceGroups.map((g) => {
          const members = membersByAgence[g.agence.id] || [];
          const membersLine = members
            .map((m) => (m.role_agence === ROLE_AGENCE.ADMIN ? `${m.utilisateur?.prenom} (${t("bo.agenceCollaborateurs.roleAdmin")})` : m.utilisateur?.prenom))
            .join(", ");
          const singleMandat = g.mandats.length === 1 ? g.mandats[0] : null;
          const singleLevel = singleMandat ? summarizeAccessLevel(grantedByMandate[singleMandat.id], catalog) : null;
          const initials = g.agence.nom
            .split(" ")
            .filter(Boolean)
            .slice(0, 2)
            .map((w) => w[0])
            .join("")
            .toUpperCase();
          return (
            <button
              type="button"
              key={g.agence.id}
              className={styles.agenceRow}
              onClick={() => setSelectedAgenceId(g.agence.id)}
            >
              <span className={styles.avatar}>{initials || "?"}</span>
              <div className={styles.agenceRowBody}>
                <div className={styles.agenceRowTop}>
                  <span className={styles.gestName}>{g.agence.nom}</span>
                  <span className={`${styles.badge} ${g.hasActive ? styles.badgeActive : styles.badgeRevoked}`}>
                    {g.hasActive ? t("bo.proprietairePermissions.active") : t("bo.proprietairePermissions.revoked")}
                  </span>
                </div>
                <div className={styles.gestMeta}>
                  {membersLine || t("bo.proprietairePermissions.noCollaborator")}
                  <span className={styles.gestMetaDot}>·</span>
                  {singleMandat ? (
                    <span className={`${styles.badge} ${accessBadgeClass(singleLevel)}`}>{accessLevelLabel(singleLevel, t)}</span>
                  ) : (
                    t("bo.proprietairePermissions.biensCount", { count: g.mandats.length })
                  )}
                </div>
              </div>
              <i className="bi bi-chevron-right" style={{ color: "var(--text-muted)" }} />
            </button>
          );
        })}
      </div>

      {/* ---- Nouveau gestionnaire ---- */}
      <Modal isOpen={newModalOpen} onClose={() => !createBusy && setNewModalOpen(false)} title={t("bo.proprietairePermissions.createTitle")}>
        <form onSubmit={handleCreateGestionnaire}>
          <Banner banner={banner} />
          <p className={styles.subtitle}>{t("bo.proprietairePermissions.createSubtitle")}</p>
          <div className={styles.inviteField}>
            <label htmlFor="new-gest-prenom">{t("bo.proprietairePermissions.firstNameLabel")}</label>
            <input
              id="new-gest-prenom"
              type="text"
              value={newForm.prenom}
              onChange={(e) => setNewForm((f) => ({ ...f, prenom: e.target.value }))}
              required
            />
          </div>
          <div className={styles.inviteField}>
            <label htmlFor="new-gest-nom">{t("bo.proprietairePermissions.lastNameLabel")}</label>
            <input
              id="new-gest-nom"
              type="text"
              value={newForm.nom}
              onChange={(e) => setNewForm((f) => ({ ...f, nom: e.target.value }))}
              required
            />
          </div>
          <div className={styles.inviteField}>
            <label htmlFor="new-gest-email">{t("bo.proprietairePermissions.emailLabel")}</label>
            <input
              id="new-gest-email"
              type="email"
              value={newForm.email}
              onChange={(e) => setNewForm((f) => ({ ...f, email: e.target.value }))}
              placeholder="gestionnaire@exemple.com"
              required
            />
          </div>
          <div className={styles.inviteField}>
            <label htmlFor="new-gest-scope">{t("bo.proprietairePermissions.accessLabel")}</label>
            <FilterSelect
              id="new-gest-scope"
              value={newForm.scopeBienId}
              onChange={(v) => setNewForm((f) => ({ ...f, scopeBienId: v }))}
              options={[
                { value: "all", label: t("bo.proprietairePermissions.allMyBiens") },
                ...biens.map((b) => ({ value: b.id, label: b.designation || `Bien #${b.id}` })),
              ]}
            />
          </div>

          {inviteLink ? (
            <div className={styles.inviteLinkBox}>
              <i className="bi bi-link-45deg" />
              <div>
                <div className={styles.inviteLinkLabel}>{t("bo.proprietairePermissions.inviteLinkHint")}</div>
                <div className={styles.inviteLinkRow}>
                  <input type="text" readOnly value={inviteLink} onFocus={(e) => e.target.select()} />
                  <button type="button" onClick={() => navigator.clipboard?.writeText(inviteLink)}>
                    <i className="bi bi-clipboard" /> {t("bo.proprietairePermissions.copy")}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className={styles.editActions} style={{ marginTop: "1rem" }}>
              <button type="submit" className={styles.btn} disabled={createBusy}>
                <i className="bi bi-plus-lg" />
                {createBusy ? t("bo.proprietairePermissions.creatingAccount") : t("bo.proprietairePermissions.createAccount")}
              </button>
            </div>
          )}
        </form>
      </Modal>

      {/* ---- Agence existante ---- */}
      <Modal
        isOpen={existingModalOpen}
        onClose={() => !inviteBusy && setExistingModalOpen(false)}
        title={t("bo.proprietairePermissions.existingTitle")}
      >
        <form onSubmit={handleInviteExisting}>
          <Banner banner={banner} />
          <p className={styles.subtitle}>{t("bo.proprietairePermissions.existingSubtitle")}</p>

          {selectedAgencyFromDirectory ? (
            <div className={styles.agencyPickCard}>
              <span className={styles.agencyPickAvatar}>
                <i className="bi bi-building" />
              </span>
              <div className={styles.agencyPickBody}>
                <div className={styles.agencyPickName}>{selectedAgencyFromDirectory.nom}</div>
                <div className={styles.agencyPickMeta}>
                  {t("bo.proprietairePermissions.agencyTeamSize", { count: selectedAgencyFromDirectory.members.length })}
                </div>
              </div>
              <button type="button" className={styles.agencyPickChange} onClick={() => setSelectedAgencyId(null)}>
                {t("bo.proprietairePermissions.changeAgency")}
              </button>
            </div>
          ) : (
            <>
              <div className={styles.agencySearchWrap}>
                <i className={`bi bi-search ${styles.agencySearchIcon}`} />
                <input
                  type="text"
                  className={styles.agencySearchInput}
                  value={agencySearch}
                  onChange={(e) => setAgencySearch(e.target.value)}
                  placeholder={t("bo.proprietairePermissions.searchGestionnaire")}
                  autoFocus
                />
              </div>

              <div className={styles.agencyResultsList}>
                {filteredAgencyDirectory.length === 0 ? (
                  <p className={styles.searchSelectEmpty}>
                    <i className="bi bi-search" />
                    {agencySearch.trim()
                      ? t("bo.proprietairePermissions.noAgencyMatch", { query: agencySearch.trim() })
                      : t("bo.proprietairePermissions.noAgencyAvailable")}
                  </p>
                ) : (
                  filteredAgencyDirectory.map((a) => (
                    <button
                      type="button"
                      key={a.id}
                      className={styles.agencyResultCard}
                      onClick={() => setSelectedAgencyId(a.id)}
                    >
                      <span className={styles.agencyPickAvatar}>
                        <i className="bi bi-building" />
                      </span>
                      <div className={styles.agencyPickBody}>
                        <div className={styles.agencyPickName}>{a.nom}</div>
                        <div className={styles.agencyPickMeta}>
                          {t("bo.proprietairePermissions.agencyTeamSize", { count: a.members.length })}
                        </div>
                      </div>
                      <i className="bi bi-chevron-right" style={{ color: "var(--text-muted)" }} />
                    </button>
                  ))
                )}
              </div>
            </>
          )}

          <div className={styles.inviteField} style={{ marginTop: "1.1rem" }}>
            <label htmlFor="gestionnaire-scope">{t("bo.proprietairePermissions.accessLabel")}</label>
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
          <div className={styles.editActions} style={{ marginTop: "1rem" }}>
            <button type="submit" className={styles.btn} disabled={inviteBusy || !selectedAgencyFromDirectory}>
              <i className="bi bi-plus-lg" />
              {inviteBusy ? t("bo.proprietairePermissions.adding") : t("bo.proprietairePermissions.grantAccess")}
            </button>
          </div>
        </form>
      </Modal>

      {/* ---- Drawer Agence ---- */}
      <Drawer isOpen={!!selectedGroup} onClose={() => setSelectedAgenceId(null)} title={selectedGroup?.agence.nom}>
        {selectedGroup && (
          <>
            <div className={styles.detailBlockTitle}>{t("bo.proprietairePermissions.sectionCollaborateurs")}</div>
            {selectedMembers.length === 0 ? (
              <p className={styles.empty}>{t("bo.proprietairePermissions.noCollaborator")}</p>
            ) : (
              <>
                <p className={styles.subtitle}>
                  {selectedMembers
                    .map((m) => (m.role_agence === ROLE_AGENCE.ADMIN ? `${m.utilisateur?.prenom} ${m.utilisateur?.nom} (${t("bo.agenceCollaborateurs.roleAdmin")})` : `${m.utilisateur?.prenom} ${m.utilisateur?.nom}`))
                    .join(", ")}
                </p>
                <button type="button" className={styles.linkButton} onClick={() => setCollaboratorsModalOpen(true)}>
                  {t("bo.proprietairePermissions.seeCollaboratorsDetail")} <i className="bi bi-arrow-right" />
                </button>
              </>
            )}

            <div className={styles.detailBlockTitle} style={{ marginTop: "1.4rem" }}>
              {t("bo.proprietairePermissions.sectionAcces")}
            </div>
            {selectedGroup.mandats.map((m) => {
              const level = summarizeAccessLevel(grantedByMandate[m.id], catalog);
              const isActive = m.statut === MANDAT_STATUS.ACTIF;
              return (
                <div key={m.id} className={styles.mandatRow}>
                  <div>
                    <div className={styles.mandatRowLabel}>{bienLabel(m, t)}</div>
                    <span className={`${styles.badge} ${accessBadgeClass(level)}`}>{accessLevelLabel(level, t)}</span>
                  </div>
                  <div className={styles.tableActions}>
                    <button
                      type="button"
                      className={styles.btnOutline}
                      onClick={() => setPermissionsModalMandatId(m.id)}
                    >
                      {t("bo.proprietairePermissions.configure")}
                    </button>
                    <button
                      type="button"
                      className={`${styles.statusButton} ${isActive ? styles.statusButtonRevoke : styles.statusButtonReactivate}`}
                      onClick={() => handleToggleMandatStatus(m)}
                    >
                      {isActive ? t("bo.proprietairePermissions.revoke") : t("bo.proprietairePermissions.reactivate")}
                    </button>
                  </div>
                </div>
              );
            })}

            <div className={styles.detailBlockTitle} style={{ marginTop: "1.4rem" }}>
              {t("bo.proprietairePermissions.sectionHistorique")}
            </div>
            <p className={styles.subtitle}>
              {t("bo.proprietairePermissions.relationSince", {
                date: selectedGroup.createdAt
                  ? new Date(selectedGroup.createdAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })
                  : "—",
              })}
              <br />
              {t("bo.proprietairePermissions.lastModified", {
                date: selectedGroup.updatedAt
                  ? new Date(selectedGroup.updatedAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })
                  : "—",
              })}
            </p>
          </>
        )}
      </Drawer>

      {/* ---- Détail des collaborateurs (lecture seule) ---- */}
      <Modal
        isOpen={collaboratorsModalOpen}
        onClose={() => setCollaboratorsModalOpen(false)}
        title={t("bo.proprietairePermissions.collaboratorsModalTitle", { agence: selectedGroup?.agence.nom || "" })}
      >
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>{t("bo.agenceCollaborateurs.colName")}</th>
                <th>{t("bo.agenceCollaborateurs.colEmail")}</th>
                <th>{t("bo.agenceCollaborateurs.colRole")}</th>
              </tr>
            </thead>
            <tbody>
              {selectedMembers.map((m) => (
                <tr key={m.id}>
                  <td>
                    {m.utilisateur?.prenom} {m.utilisateur?.nom}
                  </td>
                  <td>{m.utilisateur?.email}</td>
                  <td>{m.role_agence === ROLE_AGENCE.ADMIN ? t("bo.agenceCollaborateurs.roleAdmin") : t("bo.agenceCollaborateurs.roleMembre")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Modal>

      {/* ---- Configuration des permissions (plein écran) ---- */}
      <Modal
        isOpen={!!permissionsMandat}
        onClose={() => setPermissionsModalMandatId(null)}
        size="full"
        title={
          permissionsMandat
            ? t("bo.proprietairePermissions.permissionsFor", { bien: bienLabel(permissionsMandat, t) })
            : ""
        }
      >
        {permissionsMandat && (
          <>
            {permissionsMandat.statut !== MANDAT_STATUS.ACTIF && (
              <p className={styles.revokedNotice}>
                <i className="bi bi-lock-fill" />
                {t("bo.proprietairePermissions.revokedNotice")}
              </p>
            )}
            <PermissionsMatrix
              groups={groups}
              granted={grantedByMandate[permissionsMandat.id] || new Set()}
              onToggle={(code) => handleTogglePermission(permissionsMandat.id, code)}
              disabled={savingMandateIds.has(permissionsMandat.id) || permissionsMandat.statut !== MANDAT_STATUS.ACTIF}
            />
          </>
        )}
      </Modal>

      {/* ---- Détail d'une invitation d'agence ---- */}
      <Modal
        isOpen={!!detailsInvitation}
        onClose={() => setDetailsInvitationId(null)}
        title={detailsInvitation ? detailsInvitation.agence.nom : ""}
      >
        {detailsInvitation && (
          <>
            <div className={styles.invitationDetailsRow}>
              <span className={styles.invitationCardIcon}>
                <i className="bi bi-building" />
              </span>
              <div>
                <div className={styles.invitationCardTitle}>{detailsInvitation.agence.nom}</div>
                <div className={styles.invitationCardSub}>
                  {t("bo.proprietairePermissions.invitationTeamSize", {
                    count: agencyMemberCounts[detailsInvitation.agence.id] || 1,
                  })}
                </div>
              </div>
            </div>

            <p className={styles.invitationDetailsMeta}>
              <i className="bi bi-calendar-event" />
              {t("bo.proprietairePermissions.invitationSentOn", {
                date: new Date(detailsInvitation.created_at).toLocaleDateString("fr-FR", {
                  day: "2-digit",
                  month: "long",
                  year: "numeric",
                }),
              })}
            </p>

            <p className={styles.subtitle}>
              {detailsInvitation.needsScope
                ? t("bo.proprietairePermissions.invitationNeedsScopeSub")
                : t("bo.proprietairePermissions.invitationPromptSub")}
            </p>

            <div className={styles.editActions}>
              {detailsInvitation.needsScope ? (
                <button
                  type="button"
                  className={styles.btn}
                  onClick={() => {
                    setDetailsInvitationId(null);
                    setAcceptScopeBienId("all");
                    setAcceptScopeInvitation(detailsInvitation);
                  }}
                >
                  {t("bo.proprietairePermissions.configureAccess")}
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    className={styles.btnOutline}
                    disabled={invitationBusyId === detailsInvitation.id}
                    onClick={() => {
                      setDetailsInvitationId(null);
                      handleDeclineInvitation(detailsInvitation);
                    }}
                  >
                    {t("bo.proprietairePermissions.decline")}
                  </button>
                  <button
                    type="button"
                    className={styles.btn}
                    disabled={invitationBusyId === detailsInvitation.id}
                    onClick={() => {
                      setDetailsInvitationId(null);
                      handleAcceptInvitation(detailsInvitation);
                    }}
                  >
                    {t("bo.proprietairePermissions.accept")}
                  </button>
                </>
              )}
            </div>
          </>
        )}
      </Modal>

      {/* ---- Configurer l'accès après acceptation d'une invitation ---- */}
      <Modal
        isOpen={!!acceptScopeInvitation}
        onClose={() => !acceptScopeBusy && setAcceptScopeInvitation(null)}
        title={acceptScopeInvitation ? t("bo.proprietairePermissions.configureAccessTitle", { agence: acceptScopeInvitation.agence.nom }) : ""}
      >
        {acceptScopeInvitation && (
          <form onSubmit={handleConfirmAcceptScope}>
            <Banner banner={invitationBanner} />
            <p className={styles.subtitle}>{t("bo.proprietairePermissions.configureAccessSubtitle")}</p>
            <div className={styles.inviteField}>
              <label htmlFor="accept-scope-bien">{t("bo.proprietairePermissions.accessLabel")}</label>
              <FilterSelect
                id="accept-scope-bien"
                value={acceptScopeBienId}
                onChange={setAcceptScopeBienId}
                options={[
                  { value: "all", label: t("bo.proprietairePermissions.allMyBiens") },
                  ...biens.map((b) => ({ value: b.id, label: b.designation || `Bien #${b.id}` })),
                ]}
              />
            </div>
            <div className={styles.editActions} style={{ marginTop: "1rem" }}>
              <button type="submit" className={styles.btn} disabled={acceptScopeBusy}>
                <i className="bi bi-check-lg" />
                {acceptScopeBusy ? t("bo.proprietairePermissions.adding") : t("bo.proprietairePermissions.grantAccess")}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
