"use client";

import { useEffect, useMemo, useState } from "react";
import { extractErrorMessage } from "@/lib/apiClient";
import {
  fetchMandates,
  fetchPermissionCatalog,
  fetchMandatePermissions,
  groupPermissionCatalog,
  summarizeAccessLevel,
  mandatScopeLabel,
  accessLevelLabel,
  MANDAT_STATUS,
} from "@/lib/mandates";
import { fetchBiens, fetchLots, fetchBaux, BAIL_STATUS } from "@/lib/properties";
import { fetchMyAgence, fetchAgenceMembers, ROLE_AGENCE } from "@/lib/agences";
import {
  fetchAgenceInvitations,
  createAgenceInvitation,
  cancelAgenceInvitation,
  INVITATION_CLIENT_STATUS,
} from "@/lib/invitationsClient";
import StatCard from "@/components/StatCard";
import FilterSelect from "@/components/FilterSelect";
import Drawer from "@/components/Drawer";
import Modal from "@/components/Modal";
import PermissionsMatrix from "@/components/PermissionsMatrix";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import styles from "../agence.module.css";

function invitationStatusMeta(statut, t) {
  switch (statut) {
    case INVITATION_CLIENT_STATUS.ACCEPTEE:
      return { label: t("bo.agenceClients.invitationAccepted"), badge: styles.badgeActive };
    case INVITATION_CLIENT_STATUS.REFUSEE:
      return { label: t("bo.agenceClients.invitationDeclined"), badge: styles.badgeDanger };
    case INVITATION_CLIENT_STATUS.EXPIREE:
      return { label: t("bo.agenceClients.invitationExpired"), badge: styles.badgeWarning };
    default:
      return { label: t("bo.agenceClients.invitationPending"), badge: styles.badgeInfo };
  }
}

function Banner({ banner }) {
  if (!banner) return null;
  return (
    <div className={`${styles.banner} ${banner.type === "success" ? styles.bannerSuccess : styles.bannerError}`}>
      {banner.message}
    </div>
  );
}

function bienLabel(mandat, t) {
  return mandatScopeLabel(mandat, t("bo.agenceClients.allBiens"));
}

function accessBadgeClass(level) {
  if (level === "full") return styles.badgeActive;
  if (level === "readonly") return styles.badgeInfo;
  return styles.badgeWarning;
}

export default function AgenceClientsPage() {
  const { t } = useLanguage();
  const { user } = useAuth();

  const [mandates, setMandates] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [groups, setGroups] = useState([]);
  const [grantedByMandate, setGrantedByMandate] = useState({});
  const [biens, setBiens] = useState([]);
  const [lots, setLots] = useState([]);
  const [baux, setBaux] = useState([]);
  const [agence, setAgence] = useState(null);
  const [members, setMembers] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [banner, setBanner] = useState(null);

  const [activeTab, setActiveTab] = useState("clients");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedProprietaireId, setSelectedProprietaireId] = useState(null);
  const [viewMandatId, setViewMandatId] = useState(null);

  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteBanner, setInviteBanner] = useState(null);
  const [inviteLink, setInviteLink] = useState(null);
  const [cancelBusyId, setCancelBusyId] = useState(null);

  const isAdmin = members.find((m) => m.utilisateur?.id === user?.id)?.role_agence === ROLE_AGENCE.ADMIN;

  async function loadInvitations(agenceId) {
    setInvitations(await fetchAgenceInvitations(agenceId));
  }

  useEffect(() => {
    async function init() {
      setIsLoading(true);
      try {
        const [mandateList, catalogList, biensList, lotsList, bauxList, agenceData] = await Promise.all([
          fetchMandates(),
          fetchPermissionCatalog(),
          fetchBiens(),
          fetchLots(),
          fetchBaux(),
          fetchMyAgence(),
        ]);
        const grantedEntries = await Promise.all(
          mandateList.map(async (mandat) => {
            const granted = await fetchMandatePermissions(mandat.id);
            return [mandat.id, new Set(granted.map((item) => item.permission.code))];
          })
        );
        setAgence(agenceData);
        setMembers(await fetchAgenceMembers(agenceData.id));
        await loadInvitations(agenceData.id);
        setMandates(mandateList);
        setCatalog(catalogList);
        setGroups(groupPermissionCatalog(catalogList));
        setGrantedByMandate(Object.fromEntries(grantedEntries));
        setBiens(biensList);
        setLots(lotsList);
        setBaux(bauxList);
      } catch (err) {
        setBanner({ type: "error", message: extractErrorMessage(err) });
      } finally {
        setIsLoading(false);
      }
    }
    init();
  }, []);

  const countsByProprietaire = useMemo(() => {
    const bienToProp = new Map(biens.map((b) => [b.id, b.proprietaire_id]));
    const lotToProp = new Map(lots.map((l) => [l.id, bienToProp.get(l.bien_id)]));
    const counts = {};
    const bump = (pid, key) => {
      if (pid == null) return;
      if (!counts[pid]) counts[pid] = { biens: 0, lots: 0, baux: 0 };
      counts[pid][key] += 1;
    };
    biens.forEach((b) => bump(b.proprietaire_id, "biens"));
    lots.forEach((l) => bump(bienToProp.get(l.bien_id), "lots"));
    baux.forEach((b) => bump(lotToProp.get(b.lot_id), "baux"));
    return counts;
  }, [biens, lots, baux]);

  const clientGroups = useMemo(() => {
    const map = new Map();
    mandates.forEach((mandat) => {
      const pid = mandat.proprietaire?.id;
      if (pid == null) return;
      if (!map.has(pid)) map.set(pid, { proprietaire: mandat.proprietaire, mandats: [] });
      map.get(pid).mandats.push(mandat);
    });
    return Array.from(map.values()).map((g) => ({
      ...g,
      hasActive: g.mandats.some((m) => m.statut === MANDAT_STATUS.ACTIF),
      counts: countsByProprietaire[g.proprietaire.id] || { biens: 0, lots: 0, baux: 0 },
    }));
  }, [mandates, countsByProprietaire]);

  const filteredClientGroups = useMemo(() => {
    const term = search.trim().toLowerCase();
    return clientGroups.filter((g) => {
      if (term) {
        const name = `${g.proprietaire.prenom} ${g.proprietaire.nom}`.toLowerCase();
        if (!name.includes(term)) return false;
      }
      if (statusFilter === "active" && !g.hasActive) return false;
      if (statusFilter === "revoked" && g.hasActive) return false;
      return true;
    });
  }, [clientGroups, search, statusFilter]);

  const totalBiensGeres = biens.length;
  const totalBauxActifs = baux.filter((b) => b.statut === BAIL_STATUS.ACTIF).length;

  const selectedGroup = clientGroups.find((g) => g.proprietaire.id === selectedProprietaireId) || null;
  const viewMandat = mandates.find((m) => m.id === viewMandatId) || null;

  function openInviteModal() {
    setInviteEmail("");
    setInviteBanner(null);
    setInviteLink(null);
    setInviteModalOpen(true);
  }

  async function handleInvite(e) {
    e.preventDefault();
    setInviteBanner(null);
    setInviteBusy(true);
    try {
      const { invitation, invite_link } = await createAgenceInvitation(agence.id, inviteEmail.trim());
      setInvitations((prev) => [invitation, ...prev]);
      if (invite_link) {
        setInviteLink(invite_link);
      } else {
        setInviteModalOpen(false);
      }
    } catch (err) {
      setInviteBanner({ type: "error", message: extractErrorMessage(err) });
    } finally {
      setInviteBusy(false);
    }
  }

  async function handleCancelInvitation(invitationId) {
    setCancelBusyId(invitationId);
    try {
      await cancelAgenceInvitation(agence.id, invitationId);
      await loadInvitations(agence.id);
    } catch (err) {
      setBanner({ type: "error", message: extractErrorMessage(err) });
    } finally {
      setCancelBusyId(null);
    }
  }

  if (isLoading) {
    return <p>{t("bo.common.loading")}</p>;
  }

  return (
    <div>
      <Banner banner={banner} />

      <div className={`${styles.section} ${styles.pageHeaderRow}`}>
        <div>
          <h2 className={styles.sectionTitle}>
            <i className="bi bi-person-vcard" style={{ marginRight: "0.5rem", color: "var(--primary)" }} />
            {t("bo.agenceClients.title")}
          </h2>
          <p className={styles.sectionSubtitle} style={{ margin: 0 }}>
            {t("bo.agenceClients.subtitle")}
          </p>
        </div>
        {isAdmin && (
          <button type="button" className={styles.inviteButton} onClick={openInviteModal}>
            <i className="bi bi-person-plus-fill" />
            {t("bo.agenceClients.inviteButton")}
          </button>
        )}
      </div>

      <div className={styles.statsGrid}>
        <StatCard icon="bi-people-fill" tone="primary" label={t("bo.agenceClients.statProprietaires")} value={clientGroups.length} />
        <StatCard icon="bi-house-door-fill" tone="accent" label={t("bo.agenceClients.statBiensGeres")} value={totalBiensGeres} />
        <StatCard icon="bi-file-earmark-text-fill" tone="warning" label={t("bo.agenceClients.statBauxActifs")} value={totalBauxActifs} />
      </div>

      <div className={styles.tabSwitch} role="tablist">
        <button
          type="button"
          role="tab"
          className={`${styles.tabBtn} ${activeTab === "clients" ? styles.tabBtnActive : ""}`}
          onClick={() => setActiveTab("clients")}
        >
          {t("bo.agenceClients.tabClients")}
        </button>
        <button
          type="button"
          role="tab"
          className={`${styles.tabBtn} ${activeTab === "invitations" ? styles.tabBtnActive : ""}`}
          onClick={() => setActiveTab("invitations")}
        >
          {t("bo.agenceClients.tabInvitations")}
          {invitations.filter((i) => i.statut === INVITATION_CLIENT_STATUS.EN_ATTENTE).length > 0 && (
            <span className={styles.badge} style={{ marginLeft: "0.4rem" }}>
              {invitations.filter((i) => i.statut === INVITATION_CLIENT_STATUS.EN_ATTENTE).length}
            </span>
          )}
        </button>
      </div>

      {activeTab === "clients" && (
        <>
          <div className={styles.filtersRow}>
            <input
              type="text"
              placeholder={t("bo.agenceClients.searchPlaceholder")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <FilterSelect
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { value: "all", label: t("bo.common.allStatuses") },
                { value: "active", label: t("bo.agenceClients.filterActive") },
                { value: "revoked", label: t("bo.agenceClients.filterRevoked") },
              ]}
            />
          </div>

          {filteredClientGroups.length === 0 && (
            <p className={styles.empty}>
              <i className="bi bi-person-vcard" style={{ display: "block", fontSize: "1.6rem", marginBottom: "0.5rem" }} />
              {t("bo.agenceClients.noClientYet")}
            </p>
          )}

          <div className={styles.list}>
            {filteredClientGroups.map((g) => {
          const singleMandat = g.mandats.length === 1 ? g.mandats[0] : null;
          const singleLevel = singleMandat ? summarizeAccessLevel(grantedByMandate[singleMandat.id], catalog) : null;
          const initials = `${g.proprietaire.prenom?.[0] || ""}${g.proprietaire.nom?.[0] || ""}`.toUpperCase();
          return (
            <button
              type="button"
              key={g.proprietaire.id}
              className={styles.clientRow}
              onClick={() => setSelectedProprietaireId(g.proprietaire.id)}
            >
              <span className={styles.avatar}>{initials || "?"}</span>
              <div className={styles.clientRowBody}>
                <div className={styles.clientRowTop}>
                  <span style={{ fontWeight: 650 }}>
                    {g.proprietaire.prenom} {g.proprietaire.nom}
                  </span>
                  <span className={`${styles.badge} ${g.hasActive ? styles.badgeActive : styles.badgeWarning}`}>
                    {g.hasActive ? t("bo.agenceClients.filterActive") : t("bo.agenceClients.filterRevoked")}
                  </span>
                </div>
                <div style={{ fontSize: "0.82rem", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  {singleMandat ? (
                    <span className={`${styles.badge} ${accessBadgeClass(singleLevel)}`}>{accessLevelLabel(singleLevel, t)}</span>
                  ) : (
                    t("bo.agenceClients.mandatsCount", { count: g.mandats.length })
                  )}
                  <span>·</span>
                  {t("bo.agenceClients.countsSummary", { biens: g.counts.biens, lots: g.counts.lots, baux: g.counts.baux })}
                </div>
              </div>
              <i className="bi bi-chevron-right" style={{ color: "var(--text-muted)" }} />
            </button>
          );
        })}
          </div>
        </>
      )}

      {activeTab === "invitations" && (
        <>
          {invitations.length === 0 ? (
            <p className={styles.empty}>
              <i className="bi bi-envelope-paper" style={{ display: "block", fontSize: "1.6rem", marginBottom: "0.5rem" }} />
              {t("bo.agenceClients.noInvitationYet")}
            </p>
          ) : (
            <div className={styles.list}>
              {invitations.map((inv) => {
                const meta = invitationStatusMeta(inv.statut, t);
                const initials = inv.email.slice(0, 2).toUpperCase();
                return (
                  <div key={inv.id} className={styles.clientRow} style={{ cursor: "default" }}>
                    <span className={styles.avatar}>{initials}</span>
                    <div className={styles.clientRowBody}>
                      <div className={styles.clientRowTop}>
                        <span style={{ fontWeight: 650 }}>{inv.email}</span>
                        <span className={`${styles.badge} ${meta.badge}`}>{meta.label}</span>
                      </div>
                      <div style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>
                        {t("bo.agenceClients.invitationSentOn", {
                          date: new Date(inv.created_at).toLocaleDateString("fr-FR", {
                            day: "2-digit",
                            month: "long",
                            year: "numeric",
                          }),
                        })}
                      </div>
                    </div>
                    {isAdmin && inv.statut === INVITATION_CLIENT_STATUS.EN_ATTENTE && (
                      <button
                        type="button"
                        className={styles.btnOutline}
                        disabled={cancelBusyId === inv.id}
                        onClick={() => handleCancelInvitation(inv.id)}
                      >
                        {cancelBusyId === inv.id ? t("bo.agenceClients.cancelling") : t("bo.agenceClients.cancelInvitation")}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ---- Drawer client (lecture seule) ---- */}
      <Drawer
        isOpen={!!selectedGroup}
        onClose={() => setSelectedProprietaireId(null)}
        title={selectedGroup ? `${selectedGroup.proprietaire.prenom} ${selectedGroup.proprietaire.nom}` : ""}
      >
        {selectedGroup && (
          <>
            <div className={styles.detailBlockTitle}>{t("bo.agenceClients.sectionInfos")}</div>
            <p className={styles.sectionSubtitle} style={{ margin: "0 0 1rem" }}>
              {t("bo.agenceClients.countsSummary", {
                biens: selectedGroup.counts.biens,
                lots: selectedGroup.counts.lots,
                baux: selectedGroup.counts.baux,
              })}
            </p>

            <div className={styles.detailBlockTitle}>{t("bo.agenceClients.sectionAcces")}</div>
            {selectedGroup.mandats.map((m) => {
              const level = summarizeAccessLevel(grantedByMandate[m.id], catalog);
              return (
                <div key={m.id} className={styles.mandatRow}>
                  <div>
                    <div className={styles.mandatRowLabel}>{bienLabel(m, t)}</div>
                    <span className={`${styles.badge} ${accessBadgeClass(level)}`}>{accessLevelLabel(level, t)}</span>
                  </div>
                  <button type="button" className={styles.btnOutline} onClick={() => setViewMandatId(m.id)}>
                    {t("bo.agenceClients.seeAccess")}
                  </button>
                </div>
              );
            })}
          </>
        )}
      </Drawer>

      {/* ---- Détail des permissions (lecture seule, plein écran) ---- */}
      <Modal
        isOpen={!!viewMandat}
        onClose={() => setViewMandatId(null)}
        size="full"
        title={viewMandat ? t("bo.agenceClients.permissionsFor", { bien: bienLabel(viewMandat, t) }) : ""}
      >
        {viewMandat && (
          <PermissionsMatrix groups={groups} granted={grantedByMandate[viewMandat.id] || new Set()} readOnly />
        )}
      </Modal>

      {/* ---- Inviter un client ---- */}
      <Modal isOpen={inviteModalOpen} onClose={() => !inviteBusy && setInviteModalOpen(false)} title={t("bo.agenceClients.inviteTitle")}>
        <form onSubmit={handleInvite}>
          <Banner banner={inviteBanner} />
          <p className={styles.subtitle}>{t("bo.agenceClients.inviteSubtitle")}</p>
          <div className={styles.inviteField}>
            <label htmlFor="invite-client-email">{t("bo.agenceClients.inviteEmailLabel")}</label>
            <input
              id="invite-client-email"
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="proprietaire@exemple.com"
              required
            />
          </div>

          {inviteLink ? (
            <div className={styles.inviteLinkBox}>
              <i className="bi bi-link-45deg" />
              <div>
                <div className={styles.inviteLinkLabel}>{t("bo.agenceClients.inviteLinkHint")}</div>
                <div className={styles.inviteLinkRow}>
                  <input type="text" readOnly value={inviteLink} onFocus={(e) => e.target.select()} />
                  <button type="button" onClick={() => navigator.clipboard?.writeText(inviteLink)}>
                    <i className="bi bi-clipboard" /> {t("bo.agenceClients.copy")}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ marginTop: "1rem", display: "flex", justifyContent: "flex-end" }}>
              <button type="submit" className={styles.inviteButton} disabled={inviteBusy}>
                <i className="bi bi-send-fill" />
                {inviteBusy ? t("bo.agenceClients.sending") : t("bo.agenceClients.sendInvite")}
              </button>
            </div>
          )}
        </form>
      </Modal>
    </div>
  );
}
