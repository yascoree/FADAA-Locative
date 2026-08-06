"use client";

import { useLanguage } from "@/context/LanguageContext";
import styles from "./PermissionsMatrix.module.css";

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

/** Matrice Voir/Créer/Modifier/Supprimer par ressource, groupée par le catalogue
    du backend (voir lib/mandates.groupPermissionCatalog). Utilisée en édition
    (propriétaire, sur son propre mandat) et en lecture seule (agence, consultant
    ce que son mandat avec un client lui autorise). */
export default function PermissionsMatrix({ groups, granted, onToggle, disabled, readOnly }) {
  const { t } = useLanguage();
  const RESOURCE_LABELS = {
    PROPERTY: t("bo.permissionCatalog.resourceProperty"),
    LOT: t("bo.permissionCatalog.resourceLot"),
    LEASE: t("bo.permissionCatalog.resourceLease"),
    DUE_DATE: t("bo.permissionCatalog.resourceDueDate"),
    PAYMENT: t("bo.permissionCatalog.resourcePayment"),
  };
  const ACTION_LABELS = {
    VIEW: t("bo.permissionCatalog.actionView"),
    CREATE: t("bo.permissionCatalog.actionCreate"),
    UPDATE: t("bo.permissionCatalog.actionUpdate"),
    DELETE: t("bo.permissionCatalog.actionDelete"),
  };

  return (
    <div className={styles.grid}>
      {groups.map((group) => {
        const viewCode = `VIEW_${group.resource}`;
        const viewGranted = granted.has(viewCode);
        const blockedByAncestor = ancestorsOf(group.resource).some((ancestor) => !granted.has(`VIEW_${ancestor}`));
        return (
          <div key={group.resource} className={styles.group}>
            <div className={styles.groupLabel}>
              <i className={`bi ${RESOURCE_ICONS[group.resource] || "bi-gear"}`} />
              {RESOURCE_LABELS[group.resource] || group.resource}
            </div>
            {!readOnly && blockedByAncestor && (
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
              const rowDisabled =
                readOnly || disabled || blockedByAncestor || (!isViewPermission && !viewGranted);
              const checked = granted.has(permission.code);
              return (
                <label
                  key={permission.code}
                  className={`${styles.switchRow} ${rowDisabled ? styles.switchRowDisabled : ""}`}
                >
                  <span className={styles.switchRowLabel}>{actionLabel}</span>
                  <span style={{ position: "relative", display: "inline-flex" }}>
                    <input
                      type="checkbox"
                      className={styles.switchInput}
                      checked={checked}
                      disabled={rowDisabled}
                      onChange={() => onToggle?.(permission.code)}
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
  );
}
