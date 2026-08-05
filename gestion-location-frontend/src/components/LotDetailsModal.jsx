"use client";

import Drawer from "@/components/Drawer";
import StatusBadge from "@/components/StatusBadge";
import PhotoGallery from "@/components/PhotoGallery";
import ChargesSection from "@/components/ChargesSection";
import { API_BASE_URL } from "@/lib/apiClient";
import { LOT_STATUS, LOT_STATUS_LABELS, BAIL_STATUS, BAIL_STATUS_LABELS, FREQUENCE_PAIEMENT_LABELS } from "@/lib/properties";
import styles from "./ui.module.css";

function photoUrl(url) {
  return `${API_BASE_URL}${url}`;
}

function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
}

function formatCurrency(value) {
  if (value === null || value === undefined || value === "") return "—";
  return `${Number(value).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} MAD`;
}

const LOT_STATUS_TONE = {
  [LOT_STATUS.DISPONIBLE]: "success",
  [LOT_STATUS.LOUE]: "info",
  [LOT_STATUS.RESERVE]: "warning",
  [LOT_STATUS.EN_MAINTENANCE]: "warning",
  [LOT_STATUS.HORS_SERVICE]: "danger",
};

const BAIL_STATUS_TONE = {
  [BAIL_STATUS.EN_ATTENTE]: "warning",
  [BAIL_STATUS.ACTIF]: "success",
  [BAIL_STATUS.RESILIE]: "danger",
  [BAIL_STATUS.EXPIRE]: "neutral",
};

/** Vue détaillée d'un lot (lecture seule), dans un panneau glissant depuis la
    droite : galerie photo, bien parent, et bail en cours (locataire, loyer,
    dates) — pour consulter sans passer par le formulaire d'édition. Partagé
    entre les espaces propriétaire et agence.
    `bien` et `categorieName`/`bail` sont fournis par la page appelante, qui a
    déjà les données nécessaires en mémoire (pas de fetch ici). */
export default function LotDetailsModal({ lot, onClose, bien, categorieName, bail, canManageCharges }) {
  if (!lot) return null;

  const photos = lot.photos || [];
  const tenant = bail?.locataire;

  return (
    <Drawer
      isOpen={!!lot}
      onClose={onClose}
      wide
      title={<h3 className={styles.modalTitle}>{lot.reference || `Lot #${lot.id}`}</h3>}
    >
      <div className={styles.bienDetailsMeta}>
        <StatusBadge tone={LOT_STATUS_TONE[lot.statut] || "neutral"}>{LOT_STATUS_LABELS[lot.statut] || "—"}</StatusBadge>
        {categorieName && (
          <span className={styles.bienDetailsCategory}>
            <i className="bi bi-tag" />
            {categorieName}
          </span>
        )}
      </div>

      <PhotoGallery photos={photos} emptyLabel="Aucune photo pour ce lot." />

      {bien?.adresse && (
        <p className={styles.bienDetailsAddress}>
          <i className="bi bi-geo-alt" />
          {bien.adresse}
        </p>
      )}

      {lot.description && <p className={styles.bienDetailsDescription}>{lot.description}</p>}

      <div className={styles.detailsInfoGrid}>
        <div className={styles.detailsInfoItem}>
          <span className={styles.detailsInfoLabel}>Loyer de référence</span>
          <span className={styles.detailsInfoValue}>{formatCurrency(lot.loyer_reference)}</span>
        </div>
        <div className={styles.detailsInfoItem}>
          <span className={styles.detailsInfoLabel}>Créé le</span>
          <span className={styles.detailsInfoValue}>{formatDate(lot.created_at)}</span>
        </div>
        <div className={styles.detailsInfoItem}>
          <span className={styles.detailsInfoLabel}>Bien</span>
          <span className={styles.detailsInfoValue}>{bien?.designation || (bien ? `Bien #${bien.id}` : "—")}</span>
        </div>
        {lot.valorisation != null && (
          <div className={styles.detailsInfoItem}>
            <span className={styles.detailsInfoLabel}>Valorisation</span>
            <span className={styles.detailsInfoValue}>{formatCurrency(lot.valorisation)}</span>
          </div>
        )}
      </div>

      {canManageCharges !== undefined && <ChargesSection lotId={lot.id} canManage={canManageCharges} />}

      <div className={styles.bienDetailsSection}>
        <h3 className={styles.bienDetailsSectionTitle}>
          <i className="bi bi-person-fill" />
          Locataire
        </h3>
        {tenant ? (
          <>
            <div className={styles.tenantCard}>
              {tenant.photo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img className={styles.tenantCardAvatar} src={photoUrl(tenant.photo)} alt="" />
              ) : (
                <span className={styles.tenantCardAvatar}>
                  {tenant.prenom?.[0]}
                  {tenant.nom?.[0]}
                </span>
              )}
              <div className={styles.tenantCardBody}>
                <div className={styles.tenantCardName}>
                  {tenant.prenom} {tenant.nom}
                </div>
                <div className={styles.tenantCardMeta}>{tenant.email}</div>
              </div>
              <StatusBadge tone={BAIL_STATUS_TONE[bail.statut] || "neutral"}>
                {BAIL_STATUS_LABELS[bail.statut] || "—"}
              </StatusBadge>
            </div>
            <div className={styles.detailsInfoGrid} style={{ marginTop: "0.8rem" }}>
              <div className={styles.detailsInfoItem}>
                <span className={styles.detailsInfoLabel}>Loyer actuel</span>
                <span className={styles.detailsInfoValue}>{formatCurrency(bail.loyer)}</span>
              </div>
              <div className={styles.detailsInfoItem}>
                <span className={styles.detailsInfoLabel}>Fréquence</span>
                <span className={styles.detailsInfoValue}>{FREQUENCE_PAIEMENT_LABELS[bail.frequence_paiement] || "—"}</span>
              </div>
              <div className={styles.detailsInfoItem}>
                <span className={styles.detailsInfoLabel}>Début du bail</span>
                <span className={styles.detailsInfoValue}>{formatDate(bail.date_debut)}</span>
              </div>
              <div className={styles.detailsInfoItem}>
                <span className={styles.detailsInfoLabel}>Fin du bail</span>
                <span className={styles.detailsInfoValue}>{bail.date_fin ? formatDate(bail.date_fin) : "—"}</span>
              </div>
            </div>
          </>
        ) : (
          <div className={styles.bienGalleryEmpty}>
            <i className="bi bi-person" />
            Aucun locataire actuellement — lot disponible.
          </div>
        )}
      </div>
    </Drawer>
  );
}
