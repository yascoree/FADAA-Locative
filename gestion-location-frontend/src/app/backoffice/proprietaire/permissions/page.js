"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { extractErrorMessage, API_BASE_URL } from "@/lib/apiClient";
import {
  fetchMandates,
  fetchPermissionCatalog,
  fetchMandatePermissions,
  saveMandatePermissions,
  fetchGestionnaires,
  createMandate,
  setMandateStatus,
  groupPermissionCatalog,
  formatMandateStatusLine,
  MANDAT_STATUS,
} from "@/lib/mandates";
import { fetchBiens } from "@/lib/properties";
import StatCard from "@/components/StatCard";
import SearchableSelect from "@/components/SearchableSelect";
import styles from "./permissions.module.css";

const RESOURCE_ICONS = {
  PROPERTY: "bi-house-door",
  LOT: "bi-grid-3x3-gap",
  LEASE: "bi-file-earmark-text",
  DUE_DATE: "bi-calendar-check",
  PAYMENT: "bi-cash-stack",
};

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

function bienLabel(mandat) {
  if (!mandat.bien_id) return "Tous mes biens";
  return mandat.bien?.designation || `Bien #${mandat.bien_id}`;
}

export default function GestionPermissionPage() {
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
  const [inviteBusy, setInviteBusy] = useState(false);
  const [banner, setBanner] = useState(null);

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
      setBanner({ type: "error", message: "Sélectionnez un gestionnaire dans la liste." });
      return;
    }
    setInviteBusy(true);
    try {
      const gestionnaire = selectedGestionnaire;
      const bienId = scopeBienId === "all" ? null : Number(scopeBienId);
      const mandat = await createMandate({ gestionnaireId: gestionnaire.id, proprietaireId: user.id, bienId });
      const scopeLabel = bienId ? biens.find((b) => b.id === bienId)?.designation || `bien #${bienId}` : "tous vos biens";
      setBanner({
        type: "success",
        message: `${gestionnaire.prenom} ${gestionnaire.nom} a été ajouté comme gestionnaire pour ${scopeLabel}.`,
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
      setBanner({ type: "error", message: extractErrorMessage(err) });
    } finally {
      setInviteBusy(false);
    }
  }

  async function handleToggleStatus(mandat) {
    const isRevoked = mandat.statut === MANDAT_STATUS.REVOQUE;
    try {
      await setMandateStatus(mandat.id, isRevoked ? MANDAT_STATUS.ACTIF : MANDAT_STATUS.REVOQUE);
      await reload();
    } catch (err) {
      setBanner({ type: "error", message: extractErrorMessage(err) });
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
    return Array.from(map.values());
  }, [mandates]);

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
      <div className={styles.pageHeader}>
        <div>
          <h2 className={styles.pageTitle}>
            <i className="bi bi-people-fill" />
            Gestionnaires
          </h2>
          <p className={styles.pageSubtitle}>
            Donnez l&apos;accès à un gestionnaire et définissez précisément ce qu&apos;il a le droit de faire sur vos
            biens.
          </p>
        </div>
      </div>

      <div className={styles.statsGrid}>
        <StatCard icon="bi-person-badge-fill" tone="primary" label="Gestionnaires" value={gestionnaireGroups.length} />
        <StatCard icon="bi-check-circle-fill" tone="accent" label="Mandats actifs" value={activeCount} />
        <StatCard icon="bi-slash-circle-fill" tone="warning" label="Mandats révoqués" value={revokedCount} />
      </div>

      <div className={styles.card}>
        <h3 className={styles.cardTitle}>
          <i className="bi bi-person-plus-fill" />
          Donner l&apos;accès à un gestionnaire
        </h3>
        <p className={styles.subtitle}>Recherchez un gestionnaire déjà inscrit sur la plateforme pour lui donner accès.</p>

        <form onSubmit={handleInvite}>
          <div className={styles.inviteRow}>
            <div className={styles.inviteField}>
              <label htmlFor="gestionnaire-search">Gestionnaire</label>
              <SearchableSelect
                id="gestionnaire-search"
                items={gestionnaires}
                getId={(g) => g.id}
                getLabel={(g) => `${g.prenom} ${g.nom} (${g.email})`}
                value={selectedGestionnaire}
                onSelect={setSelectedGestionnaire}
                placeholder="Rechercher un gestionnaire..."
              />
            </div>
            <div className={`${styles.inviteField} ${styles.scopeField}`}>
              <label htmlFor="gestionnaire-scope">Portée</label>
              <select id="gestionnaire-scope" value={scopeBienId} onChange={(e) => setScopeBienId(e.target.value)}>
                <option value="all">Tous mes biens</option>
                {biens.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.designation || `Bien #${b.id}`}
                  </option>
                ))}
              </select>
            </div>
            <button type="submit" className={styles.inviteButton} disabled={inviteBusy || !selectedGestionnaire}>
              <i className="bi bi-plus-lg" />
              {inviteBusy ? "Ajout..." : "Donner l'accès"}
            </button>
          </div>
        </form>

        <p className={styles.note}>
          <i className="bi bi-info-circle-fill" />
          Un nouveau mandat reçoit automatiquement le droit de <strong>voir</strong> le(s) bien(s) concerné(s). Pour
          ajouter un autre bien à un gestionnaire déjà présent, réinvitez-le ci-dessus avec une portée différente,
          puis ouvrez ses permissions pour choisir le bien à configurer.
        </p>

        <Banner banner={banner} />
      </div>

      {!isLoading && gestionnaireGroups.length === 0 && (
        <p className={styles.empty}>
          <i className="bi bi-person-x" style={{ display: "block", fontSize: "1.6rem", marginBottom: "0.5rem" }} />
          Vous n&apos;avez pas encore de gestionnaire. Ajoutez-en un ci-dessus.
        </p>
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
                      {mandats.length} bien{mandats.length > 1 ? "s" : ""} ({activeMandatsCount} actif
                      {activeMandatsCount > 1 ? "s" : ""})
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
                    Permissions
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
                          {bienLabel(m)}
                          <span className={mActive ? styles.bienChipDotActive : styles.bienChipDotRevoked} />
                        </button>
                      );
                    })}
                  </div>

                  <div className={styles.permHeader}>
                    <span className={styles.permHeaderLabel}>
                      Permissions pour « {bienLabel(selectedMandat)} »
                    </span>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.7rem" }}>
                      {isSaving && (
                        <span className={styles.savingTag}>
                          <span className={styles.savingDot} />
                          Enregistrement...
                        </span>
                      )}
                      <span className={`${styles.badge} ${isActive ? styles.badgeActive : styles.badgeRevoked}`}>
                        {isActive ? "Actif" : "Révoqué"}
                      </span>
                      <button
                        type="button"
                        className={`${styles.statusButton} ${isActive ? styles.statusButtonRevoke : styles.statusButtonReactivate}`}
                        onClick={() => handleToggleStatus(selectedMandat)}
                      >
                        <i className={`bi ${isActive ? "bi-slash-circle" : "bi-arrow-counterclockwise"}`} />
                        {isActive ? "Révoquer" : "Réactiver"}
                      </button>
                    </div>
                  </div>

                  {!isActive && (
                    <p className={styles.revokedNotice}>
                      <i className="bi bi-lock-fill" />
                      Réactivez ce mandat pour modifier ses permissions.
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
                          {group.label}
                        </div>
                        {blockedByAncestor && (
                          <p className={styles.groupBlockedHint}>
                            <i className="bi bi-arrow-up-circle" /> Nécessite « Voir » sur{" "}
                            {ancestorsOf(group.resource)
                              .map((r) => groups.find((g) => g.resource === r)?.label || r)
                              .join(", ")}
                          </p>
                        )}
                        {group.permissions.map((permission) => {
                          const actionLabel = permission.libelle.split(" ")[0];
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
