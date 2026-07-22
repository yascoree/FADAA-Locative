"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { extractErrorMessage } from "@/lib/apiClient";
import {
  fetchMandates,
  fetchPermissionCatalog,
  fetchMandatePermissions,
  saveMandatePermissions,
  lookupGestionnaireByEmail,
  createMandate,
  setMandateStatus,
  groupPermissionCatalog,
  formatMandateStatusLine,
  MANDAT_STATUS,
} from "@/lib/mandates";
import styles from "./permissions.module.css";

export default function GestionPermissionPage() {
  const { user } = useAuth();
  const [mandates, setMandates] = useState([]);
  const [groups, setGroups] = useState([]);
  const [grantedByMandate, setGrantedByMandate] = useState({});
  const [savingMandateIds, setSavingMandateIds] = useState(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [inviteBusy, setInviteBusy] = useState(false);
  const [banner, setBanner] = useState(null);

  useEffect(() => {
    async function init() {
      setIsLoading(true);
      try {
        const [mandateList, catalog] = await Promise.all([fetchMandates(), fetchPermissionCatalog()]);
        const grantedEntries = await Promise.all(
          mandateList.map(async (mandat) => {
            const granted = await fetchMandatePermissions(mandat.id);
            return [mandat.id, new Set(granted.map((item) => item.permission.code))];
          })
        );
        setMandates(mandateList);
        setGroups(groupPermissionCatalog(catalog));
        setGrantedByMandate(Object.fromEntries(grantedEntries));
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
    setInviteBusy(true);
    try {
      const gestionnaire = await lookupGestionnaireByEmail(email);
      const mandat = await createMandate({ gestionnaireId: gestionnaire.id, proprietaireId: user.id });
      setBanner({ type: "success", message: `${gestionnaire.prenom} ${gestionnaire.nom} a été ajouté comme gestionnaire.` });
      setEmail("");
      setGrantedByMandate((prev) => ({ ...prev, [mandat.id]: new Set() }));
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

  return (
    <div>
      <div className={styles.card}>
        <h2 className={styles.title}>Gestion des permissions</h2>
        <p className={styles.subtitle}>
          Donnez l&apos;accès à un gestionnaire et cochez précisément ce qu&apos;il a le droit de faire sur vos biens.
        </p>

        <form className={styles.inviteRow} onSubmit={handleInvite}>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email du gestionnaire (ex: contact@atlas-immo.ma)"
            required
          />
          <select className={styles.scopeSelect} disabled defaultValue="all">
            <option value="all">Tous mes biens</option>
          </select>
          <button type="submit" className={styles.inviteButton} disabled={inviteBusy}>
            {inviteBusy ? "Ajout..." : "+ Donner l'accès"}
          </button>
        </form>

        <p className={styles.note}>
          La lecture (biens, lots, baux, échéances, paiements, quittances) est automatique dès qu&apos;un mandat est
          actif. Seules les actions d&apos;écriture ci-dessous sont à cocher.
        </p>

        {banner && (
          <div className={`${styles.banner} ${banner.type === "success" ? styles.bannerSuccess : styles.bannerError}`}>
            {banner.message}
          </div>
        )}
      </div>

      {!isLoading && mandates.length === 0 && (
        <p className={styles.empty}>Vous n&apos;avez pas encore de gestionnaire. Ajoutez-en un ci-dessus.</p>
      )}

      <div className={styles.list}>
        {mandates.map((mandat) => {
          const isActive = mandat.statut === MANDAT_STATUS.ACTIF;
          const granted = grantedByMandate[mandat.id] || new Set();
          const isSaving = savingMandateIds.has(mandat.id);
          return (
            <div className={`${styles.gestCard} ${isActive ? "" : styles.gestCardRevoked}`} key={mandat.id}>
              <div className={styles.gestHeader}>
                <div>
                  <div className={styles.gestName}>
                    {mandat.gestionnaire?.prenom} {mandat.gestionnaire?.nom}
                  </div>
                  <div className={styles.gestMeta}>
                    {mandat.gestionnaire?.email} · Tous mes biens · {formatMandateStatusLine(mandat)}
                  </div>
                </div>
                <div className={styles.gestHeaderRight}>
                  <span className={`${styles.badge} ${isActive ? styles.badgeActive : styles.badgeRevoked}`}>
                    {isActive ? "Actif" : "Révoqué"}
                  </span>
                  <button
                    type="button"
                    className={`${styles.statusLink} ${isActive ? styles.statusLinkRevoke : styles.statusLinkReactivate}`}
                    onClick={() => handleToggleStatus(mandat)}
                  >
                    {isActive ? "Révoquer" : "Réactiver"}
                  </button>
                </div>
              </div>

              <div className={styles.grid}>
                {groups.map((group) => (
                  <div key={group.resource}>
                    <div className={styles.groupLabel}>{group.label}</div>
                    {group.permissions.map((permission) => {
                      const actionLabel = permission.libelle.split(" ")[0];
                      const disabled = !isActive || isSaving;
                      return (
                        <label
                          key={permission.code}
                          className={`${styles.checkRow} ${disabled ? styles.checkRowDisabled : ""}`}
                        >
                          <input
                            type="checkbox"
                            checked={granted.has(permission.code)}
                            disabled={disabled}
                            onChange={() => handleTogglePermission(mandat.id, permission.code)}
                          />
                          {actionLabel}
                        </label>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
