"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { extractErrorMessage } from "@/lib/apiClient";
import { useAuth } from "@/context/AuthContext";
import {
  fetchMyAgence,
  fetchAgenceMembers,
  inviteAgenceMember,
  removeAgenceMember,
  updateAgenceMember,
  ROLE_AGENCE,
  AGENCE_MEMBRE_STATUS,
} from "@/lib/agences";
import {
  fetchMandates,
  fetchPermissionCatalog,
  fetchMandatePermissions,
  groupPermissionCatalog,
  MANDAT_STATUS,
} from "@/lib/mandates";
import { fetchBiens } from "@/lib/properties";
import { ACCOUNT_STATUS, accountStatusLabels } from "@/lib/users";
import { timeAgo } from "@/lib/formatRelativeTime";
import StatCard from "@/components/StatCard";
import TextField from "@/components/TextField";
import SelectField from "@/components/SelectField";
import FilterSelect from "@/components/FilterSelect";
import Modal from "@/components/Modal";
import Drawer from "@/components/Drawer";
import ConfirmationDialog from "@/components/ConfirmationDialog";
import EmptyState from "@/components/EmptyState";
import LoadingState from "@/components/LoadingState";
import { useLanguage } from "@/context/LanguageContext";
import styles from "../agence.module.css";

const RESOURCE_ICONS = {
  PROPERTY: "bi-house-door",
  LOT: "bi-grid-3x3-gap",
  LEASE: "bi-file-earmark-text",
  DUE_DATE: "bi-calendar-check",
  PAYMENT: "bi-cash-stack",
  CHARGE: "bi-wallet2",
};

const RESOURCE_LABEL_KEYS = {
  PROPERTY: "bo.permissionCatalog.resourceProperty",
  LOT: "bo.permissionCatalog.resourceLot",
  LEASE: "bo.permissionCatalog.resourceLease",
  DUE_DATE: "bo.permissionCatalog.resourceDueDate",
  PAYMENT: "bo.permissionCatalog.resourcePayment",
  CHARGE: "bo.permissionCatalog.resourceCharge",
};

function Banner({ banner }) {
  if (!banner) return null;
  return (
    <div className={`${styles.banner} ${banner.type === "success" ? styles.bannerSuccess : styles.bannerError}`}>
      {banner.message}
    </div>
  );
}

function roleLabel(roleAgence, t) {
  return roleAgence === ROLE_AGENCE.ADMIN ? t("bo.agenceCollaborateurs.roleAdmin") : t("bo.agenceCollaborateurs.roleMembre");
}

function memberStatusBadge(membre) {
  if (membre.statut === AGENCE_MEMBRE_STATUS.REVOQUE) return `${styles.badge} ${styles.badgeDanger}`;
  if (membre.utilisateur?.statut_compte === ACCOUNT_STATUS.INVITE_EN_ATTENTE) return `${styles.badge} ${styles.badgeWarning}`;
  return `${styles.badge} ${styles.badgeActive}`;
}

const EMPTY_INVITE = { nom: "", prenom: "", email: "", roleAgence: ROLE_AGENCE.MEMBRE };

export default function AgenceCollaborateursPage() {
  const { t } = useLanguage();
  const { user } = useAuth();

  const [agence, setAgence] = useState(null);
  const [members, setMembers] = useState([]);
  const [mandates, setMandates] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [grantedByMandate, setGrantedByMandate] = useState({});
  const [biens, setBiens] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [inviteForm, setInviteForm] = useState(EMPTY_INVITE);
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteLink, setInviteLink] = useState(null);
  const [banner, setBanner] = useState(null);
  const [formOpen, setFormOpen] = useState(false);

  const [selectedMembre, setSelectedMembre] = useState(null);

  const [editingMembre, setEditingMembre] = useState(null);
  const [editRole, setEditRole] = useState(ROLE_AGENCE.MEMBRE);
  const [editNom, setEditNom] = useState("");
  const [editPrenom, setEditPrenom] = useState("");
  const [editBusy, setEditBusy] = useState(false);
  const [editBanner, setEditBanner] = useState(null);

  const [removeTarget, setRemoveTarget] = useState(null);
  const [removeBusy, setRemoveBusy] = useState(false);
  const [removeError, setRemoveError] = useState(null);

  useEffect(() => {
    async function init() {
      setIsLoading(true);
      try {
        const agenceData = await fetchMyAgence();
        const [membersList, mandateList, catalogList, biensList] = await Promise.all([
          fetchAgenceMembers(agenceData.id),
          fetchMandates(),
          fetchPermissionCatalog(),
          fetchBiens(),
        ]);
        const grantedEntries = await Promise.all(
          mandateList.map(async (mandat) => {
            const granted = await fetchMandatePermissions(mandat.id);
            return [mandat.id, new Set(granted.map((item) => item.permission.code))];
          })
        );
        setAgence(agenceData);
        setMembers(membersList);
        setMandates(mandateList);
        setCatalog(catalogList);
        setGrantedByMandate(Object.fromEntries(grantedEntries));
        setBiens(biensList);
      } catch (err) {
        setLoadError(extractErrorMessage(err));
      } finally {
        setIsLoading(false);
      }
    }
    init();
  }, []);

  const myMembership = members.find((m) => m.utilisateur?.id === user?.id);
  const isAdmin = myMembership?.role_agence === ROLE_AGENCE.ADMIN;

  const activeMembers = useMemo(() => members.filter((m) => m.statut === AGENCE_MEMBRE_STATUS.ACTIF), [members]);
  const activeCount = activeMembers.length;
  const adminCount = activeMembers.filter((m) => m.role_agence === ROLE_AGENCE.ADMIN).length;
  const pendingCount = activeMembers.filter((m) => m.utilisateur?.statut_compte === ACCOUNT_STATUS.INVITE_EN_ATTENTE).length;

  const STATUT_LABELS = accountStatusLabels(t);

  const activeMandates = useMemo(() => mandates.filter((m) => m.statut === MANDAT_STATUS.ACTIF), [mandates]);
  const clientsAccessibles = useMemo(
    () => new Set(activeMandates.map((m) => m.proprietaire?.id).filter((id) => id != null)).size,
    [activeMandates]
  );
  const biensAccessibles = biens.length;

  const groups = useMemo(() => groupPermissionCatalog(catalog), [catalog]);
  const resourceAccess = useMemo(() => {
    return groups.map((group) => {
      const viewCode = `VIEW_${group.resource}`;
      const granted = activeMandates.some((m) => grantedByMandate[m.id]?.has(viewCode));
      return { resource: group.resource, granted };
    });
  }, [groups, activeMandates, grantedByMandate]);

  const filteredMembers = useMemo(() => {
    const term = search.trim().toLowerCase();
    return members.filter((m) => {
      if (term) {
        const haystack = `${m.utilisateur?.prenom || ""} ${m.utilisateur?.nom || ""} ${m.utilisateur?.email || ""}`.toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      if (statusFilter === "active" && m.statut !== AGENCE_MEMBRE_STATUS.ACTIF) return false;
      if (statusFilter === "revoked" && m.statut !== AGENCE_MEMBRE_STATUS.REVOQUE) return false;
      return true;
    });
  }, [members, search, statusFilter]);

  function openForm() {
    setBanner(null);
    setInviteLink(null);
    setInviteForm(EMPTY_INVITE);
    setFormOpen(true);
  }

  function closeForm() {
    if (inviteBusy) return;
    setFormOpen(false);
  }

  async function handleInvite(e) {
    e.preventDefault();
    setBanner(null);
    setInviteLink(null);
    setInviteBusy(true);
    try {
      const { membre, invite_link } = await inviteAgenceMember(agence.id, inviteForm);
      setMembers((prev) => [...prev, membre]);
      setInviteForm(EMPTY_INVITE);
      setInviteLink(invite_link || null);
      if (!invite_link) setFormOpen(false);
    } catch (err) {
      setBanner({ type: "error", message: extractErrorMessage(err) });
    } finally {
      setInviteBusy(false);
    }
  }

  function openRemoveConfirm(membre) {
    setRemoveError(null);
    setRemoveTarget(membre);
  }

  async function handleConfirmRemove() {
    if (!removeTarget) return;
    setRemoveBusy(true);
    setRemoveError(null);
    try {
      await removeAgenceMember(agence.id, removeTarget.utilisateur.id);
      setMembers((prev) => prev.map((m) => (m.id === removeTarget.id ? { ...m, statut: AGENCE_MEMBRE_STATUS.REVOQUE } : m)));
      setRemoveTarget(null);
      setSelectedMembre(null);
    } catch (err) {
      setRemoveError(extractErrorMessage(err));
    } finally {
      setRemoveBusy(false);
    }
  }

  function openEdit(membre) {
    setEditBanner(null);
    setEditRole(membre.role_agence);
    setEditNom(membre.utilisateur?.nom || "");
    setEditPrenom(membre.utilisateur?.prenom || "");
    setEditingMembre(membre);
  }

  function closeEdit() {
    if (editBusy) return;
    setEditingMembre(null);
  }

  async function handleUpdateMember(e) {
    e.preventDefault();
    setEditBanner(null);
    setEditBusy(true);
    try {
      const isPending = editingMembre.utilisateur?.statut_compte === ACCOUNT_STATUS.INVITE_EN_ATTENTE;
      const updated = await updateAgenceMember(agence.id, editingMembre.utilisateur.id, {
        roleAgence: editRole,
        ...(isPending ? { nom: editNom, prenom: editPrenom } : {}),
      });
      setMembers((prev) => prev.map((m) => (m.id === updated.id ? { ...m, ...updated } : m)));
      setEditingMembre(null);
    } catch (err) {
      setEditBanner({ type: "error", message: extractErrorMessage(err) });
    } finally {
      setEditBusy(false);
    }
  }

  if (isLoading) {
    return <LoadingState label={t("bo.common.loading")} />;
  }

  if (loadError || !agence) {
    return <Banner banner={{ type: "error", message: loadError || t("bo.agenceCollaborateurs.noAgence") }} />;
  }

  return (
    <div>
      <div
        className={styles.section}
        style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}
      >
        <div>
          <h2 className={styles.sectionTitle}>
            <i className="bi bi-people-fill" style={{ marginRight: "0.5rem", color: "var(--primary)" }} />
            {t("bo.agenceCollaborateurs.title", { agence: agence.nom })}
          </h2>
          <p className={styles.sectionSubtitle}>{t("bo.agenceCollaborateurs.subtitle")}</p>
        </div>
        {isAdmin && (
          <button type="button" className={styles.btn} onClick={openForm}>
            <i className="bi bi-plus-lg" />
            {t("bo.agenceCollaborateurs.inviteButton")}
          </button>
        )}
      </div>

      <div className={styles.statsGrid}>
        <StatCard icon="bi-people-fill" tone="primary" label={t("bo.agenceCollaborateurs.statMembers")} value={activeCount} />
        <StatCard icon="bi-shield-check" tone="accent" label={t("bo.agenceCollaborateurs.statAdmins")} value={adminCount} />
        <StatCard icon="bi-hourglass-split" tone="warning" label={t("bo.agenceCollaborateurs.statPending")} value={pendingCount} />
      </div>

      <div className={styles.filtersRow}>
        <input
          type="text"
          placeholder={t("bo.agenceCollaborateurs.searchPlaceholder")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <FilterSelect
          value={statusFilter}
          onChange={setStatusFilter}
          options={[
            { value: "all", label: t("bo.common.allStatuses") },
            { value: "active", label: t("bo.agenceCollaborateurs.filterActive") },
            { value: "revoked", label: t("bo.agenceCollaborateurs.filterRevoked") },
          ]}
        />
      </div>

      {isAdmin && (
        <Modal isOpen={formOpen} onClose={closeForm} title={t("bo.agenceCollaborateurs.inviteTitle")}>
          <form onSubmit={handleInvite}>
            <Banner banner={banner} />
            <TextField
              label={t("bo.agenceCollaborateurs.firstNameLabel")}
              name="prenom"
              value={inviteForm.prenom}
              onChange={(e) => setInviteForm((f) => ({ ...f, prenom: e.target.value }))}
              required
            />
            <TextField
              label={t("bo.agenceCollaborateurs.lastNameLabel")}
              name="nom"
              value={inviteForm.nom}
              onChange={(e) => setInviteForm((f) => ({ ...f, nom: e.target.value }))}
              required
            />
            <TextField
              label={t("bo.agenceCollaborateurs.emailLabel")}
              name="email"
              type="email"
              value={inviteForm.email}
              onChange={(e) => setInviteForm((f) => ({ ...f, email: e.target.value }))}
              placeholder="collaborateur@exemple.com"
              required
            />
            <SelectField
              label={t("bo.agenceCollaborateurs.roleLabel")}
              name="roleAgence"
              value={inviteForm.roleAgence}
              onChange={(e) => setInviteForm((f) => ({ ...f, roleAgence: Number(e.target.value) }))}
              options={[
                { value: ROLE_AGENCE.MEMBRE, label: t("bo.agenceCollaborateurs.roleMembre") },
                { value: ROLE_AGENCE.ADMIN, label: t("bo.agenceCollaborateurs.roleAdmin") },
              ]}
            />

            {inviteLink ? (
              <div style={{ display: "flex", gap: "0.6rem", alignItems: "flex-start", marginTop: "1rem" }}>
                <i className="bi bi-link-45deg" />
                <div style={{ flex: 1 }}>
                  <div>{t("bo.agenceCollaborateurs.inviteLinkHint")}</div>
                  <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.4rem" }}>
                    <input type="text" readOnly value={inviteLink} onFocus={(e) => e.target.select()} style={{ flex: 1 }} />
                    <button type="button" className={styles.btnOutline} onClick={() => navigator.clipboard?.writeText(inviteLink)}>
                      <i className="bi bi-clipboard" /> {t("bo.agenceCollaborateurs.copy")}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className={styles.editActions} style={{ marginTop: "1rem" }}>
                <button type="submit" className={styles.btn} disabled={inviteBusy}>
                  <i className="bi bi-plus-lg" />
                  {inviteBusy ? t("bo.agenceCollaborateurs.inviting") : t("bo.agenceCollaborateurs.invite")}
                </button>
              </div>
            )}
          </form>
        </Modal>
      )}

      {isAdmin && (
        <Modal isOpen={!!editingMembre} onClose={closeEdit} title={t("bo.agenceCollaborateurs.editTitle")}>
          {editingMembre && (
            <form onSubmit={handleUpdateMember}>
              <Banner banner={editBanner} />
              {editingMembre.utilisateur?.statut_compte === ACCOUNT_STATUS.INVITE_EN_ATTENTE ? (
                <>
                  <p className={styles.sectionSubtitle} style={{ margin: "0 0 1rem" }}>
                    {t("bo.agenceCollaborateurs.editPendingHint")}
                  </p>
                  <TextField
                    label={t("bo.agenceCollaborateurs.firstNameLabel")}
                    name="editPrenom"
                    value={editPrenom}
                    onChange={(e) => setEditPrenom(e.target.value)}
                    required
                  />
                  <TextField
                    label={t("bo.agenceCollaborateurs.lastNameLabel")}
                    name="editNom"
                    value={editNom}
                    onChange={(e) => setEditNom(e.target.value)}
                    required
                  />
                </>
              ) : (
                <p className={styles.sectionSubtitle} style={{ margin: "0 0 1rem" }}>
                  {editingMembre.utilisateur?.prenom} {editingMembre.utilisateur?.nom}
                </p>
              )}
              <SelectField
                label={t("bo.agenceCollaborateurs.roleLabel")}
                name="editRoleAgence"
                value={editRole}
                onChange={(e) => setEditRole(Number(e.target.value))}
                options={[
                  { value: ROLE_AGENCE.MEMBRE, label: t("bo.agenceCollaborateurs.roleMembre") },
                  { value: ROLE_AGENCE.ADMIN, label: t("bo.agenceCollaborateurs.roleAdmin") },
                ]}
              />
              <div className={styles.editActions} style={{ marginTop: "1rem" }}>
                <button type="submit" className={styles.btn} disabled={editBusy}>
                  <i className="bi bi-check-lg" />
                  {editBusy ? t("bo.common.saving") : t("bo.common.save")}
                </button>
              </div>
            </form>
          )}
        </Modal>
      )}

      {filteredMembers.length === 0 ? (
        <EmptyState icon="bi-people" title={t("bo.agenceCollaborateurs.noMembers")} />
      ) : (
        <div className={styles.memberGrid}>
          {filteredMembers.map((membre) => {
            const isRevoked = membre.statut === AGENCE_MEMBRE_STATUS.REVOQUE;
            const statusText = isRevoked
              ? t("bo.agenceCollaborateurs.filterRevoked")
              : STATUT_LABELS[membre.utilisateur?.statut_compte] || "—";
            const initials = `${membre.utilisateur?.prenom?.[0] || ""}${membre.utilisateur?.nom?.[0] || ""}`.toUpperCase();
            return (
              <button
                type="button"
                key={membre.id}
                className={styles.memberCard}
                onClick={() => setSelectedMembre(membre)}
              >
                <div className={styles.memberCardHeader}>
                  <span className={styles.avatar}>{initials || "?"}</span>
                  <div className={styles.memberCardBody}>
                    <div className={styles.memberCardName}>
                      {membre.utilisateur?.prenom} {membre.utilisateur?.nom}
                    </div>
                    <div className={styles.memberCardBadges}>
                      <span className={`${styles.badge} ${membre.role_agence === ROLE_AGENCE.ADMIN ? styles.badgeActive : styles.badgeWarning}`}>
                        {roleLabel(membre.role_agence, t)}
                      </span>
                      <span className={memberStatusBadge(membre)}>{statusText}</span>
                    </div>
                  </div>
                </div>
                <div className={styles.memberCardEmail}>{membre.utilisateur?.email}</div>
                {!isRevoked && (
                  <div className={styles.memberCardCounts}>
                    <div className={styles.memberCardCount}>
                      <span className={styles.memberCardCountValue}>{clientsAccessibles}</span>
                      <span className={styles.memberCardCountLabel}>{t("bo.agenceCollaborateurs.clientsAccessible")}</span>
                    </div>
                    <div className={styles.memberCardCount}>
                      <span className={styles.memberCardCountValue}>{biensAccessibles}</span>
                      <span className={styles.memberCardCountLabel}>{t("bo.agenceCollaborateurs.biensAccessible")}</span>
                    </div>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* ---- Détail d'un collaborateur ---- */}
      <Drawer
        isOpen={!!selectedMembre}
        onClose={() => setSelectedMembre(null)}
        title={selectedMembre ? `${selectedMembre.utilisateur?.prenom} ${selectedMembre.utilisateur?.nom}` : ""}
      >
        {selectedMembre && (
          <>
            <div className={styles.memberCardBadges} style={{ marginBottom: "1rem" }}>
              <span className={`${styles.badge} ${selectedMembre.role_agence === ROLE_AGENCE.ADMIN ? styles.badgeActive : styles.badgeWarning}`}>
                {roleLabel(selectedMembre.role_agence, t)}
              </span>
              <span className={memberStatusBadge(selectedMembre)}>
                {selectedMembre.statut === AGENCE_MEMBRE_STATUS.REVOQUE
                  ? t("bo.agenceCollaborateurs.filterRevoked")
                  : STATUT_LABELS[selectedMembre.utilisateur?.statut_compte] || "—"}
              </span>
            </div>

            <div className={styles.detailBlockTitle}>{t("bo.agenceClients.sectionInfos")}</div>
            <p className={styles.sectionSubtitle} style={{ margin: "0 0 0.4rem" }}>{selectedMembre.utilisateur?.email}</p>
            <p className={styles.sectionSubtitle} style={{ margin: "0 0 1rem" }}>
              {t("bo.agenceCollaborateurs.lastConnection")}:{" "}
              {selectedMembre.utilisateur?.derniere_connexion
                ? timeAgo(selectedMembre.utilisateur.derniere_connexion, t)
                : t("bo.common.neverConnected")}
            </p>

            {selectedMembre.statut !== AGENCE_MEMBRE_STATUS.REVOQUE && (
              <>
                <div className={styles.detailBlockTitle}>{t("bo.agenceCollaborateurs.accessSummaryTitle")}</div>
                <p className={styles.transitionalNotice}>
                  <i className="bi bi-info-circle" />
                  {t("bo.agenceCollaborateurs.viaAgenceMandate")}
                </p>
                <div className={styles.memberAccessList}>
                  {resourceAccess.map((r) => (
                    <div key={r.resource} className={styles.memberAccessItem}>
                      <i className={`bi ${r.granted ? "bi-check-circle-fill" : "bi-x-circle"}`} />
                      <i className={`bi ${RESOURCE_ICONS[r.resource] || "bi-dot"}`} />
                      {t(RESOURCE_LABEL_KEYS[r.resource] || r.resource)}
                    </div>
                  ))}
                </div>
                <Link href="/backoffice/agence/clients" className={styles.btnOutline} style={{ display: "inline-flex", marginTop: "1rem" }}>
                  {t("bo.agenceCollaborateurs.seeFullAccessDetail")}
                  <i className="bi bi-arrow-right" />
                </Link>
              </>
            )}

            {isAdmin && selectedMembre.statut !== AGENCE_MEMBRE_STATUS.REVOQUE && (
              <div className={styles.memberDrawerActions}>
                <button type="button" className={styles.btnOutline} onClick={() => openEdit(selectedMembre)}>
                  <i className="bi bi-pencil" />
                  {t("bo.agenceCollaborateurs.edit")}
                </button>
                <button type="button" className={styles.btnOutline} onClick={() => openRemoveConfirm(selectedMembre)}>
                  <i className="bi bi-person-dash" />
                  {t("bo.agenceCollaborateurs.remove")}
                </button>
              </div>
            )}
          </>
        )}
      </Drawer>

      {/* ---- Confirmation de retrait ---- */}
      <ConfirmationDialog
        isOpen={!!removeTarget}
        onClose={() => {
          setRemoveTarget(null);
          setRemoveError(null);
        }}
        onConfirm={handleConfirmRemove}
        title={t("bo.agenceCollaborateurs.removeConfirmTitle")}
        message={
          removeTarget
            ? t("bo.agenceCollaborateurs.removeConfirmMessage", {
                name: `${removeTarget.utilisateur?.prenom} ${removeTarget.utilisateur?.nom}`,
              })
            : ""
        }
        confirmLabel={t("bo.agenceCollaborateurs.removeConfirmLabel")}
        danger
        isBusy={removeBusy}
        error={removeError}
      />
    </div>
  );
}
