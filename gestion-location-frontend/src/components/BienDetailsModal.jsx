"use client";

import Drawer from "@/components/Drawer";
import StatusBadge from "@/components/StatusBadge";
import MapPicker from "@/components/MapPicker";
import PhotoGallery from "@/components/PhotoGallery";
import ChargesSection from "@/components/ChargesSection";
import { API_BASE_URL } from "@/lib/apiClient";
import { BIEN_STATUS, BIEN_STATUS_LABELS, TYPE_BIEN_LABELS, LOT_STATUS_LABELS } from "@/lib/properties";
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

const STATUS_TONE = {
  [BIEN_STATUS.ACTIF]: "success",
  [BIEN_STATUS.INACTIF]: "warning",
  [BIEN_STATUS.ARCHIVE]: "danger",
};

function lotThumb(lot) {
  const cover = lot.photos?.[0];
  return cover ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img className={styles.detailsListRowThumb} src={photoUrl(cover.url)} alt="" />
  ) : (
    <span className={styles.detailsListRowThumbPlaceholder}>
      <i className="bi bi-grid-3x3-gap" />
    </span>
  );
}

/** Vue détaillée d'un bien (lecture seule), dans un panneau glissant depuis la
    droite : galerie photo complète, localisation sur carte, et la liste de ses
    lots — pour consulter sans passer par le formulaire d'édition. Partagé entre
    les espaces propriétaire et agence.
    `ownerName` et `lots`/`onSelectLot` sont optionnels : `ownerName` n'a de sens
    que côté agence (le propriétaire est déjà l'utilisateur courant), `lots` est
    fourni par la page qui sait déjà lesquels appartiennent à ce bien. */
export default function BienDetailsModal({ bien, onClose, ownerName, lots, onSelectLot, canManageCharges }) {
  if (!bien) return null;

  const photos = bien.photos || [];
  const hasLocation = bien.latitude != null && bien.longitude != null;
  const bienLots = lots || [];

  return (
    <Drawer
      isOpen={!!bien}
      onClose={onClose}
      wide
      title={<h3 className={styles.modalTitle}>{bien.designation || `Bien #${bien.id}`}</h3>}
    >
      <div className={styles.bienDetailsMeta}>
        <StatusBadge tone={STATUS_TONE[bien.statut] || "neutral"}>{BIEN_STATUS_LABELS[bien.statut] || "—"}</StatusBadge>
        <span className={styles.bienDetailsCategory}>
          <i className="bi bi-tag" />
          {TYPE_BIEN_LABELS[bien.type] || "—"}
        </span>
      </div>

      <PhotoGallery photos={photos} emptyLabel="Aucune photo pour ce bien." />

      {bien.adresse && (
        <p className={styles.bienDetailsAddress}>
          <i className="bi bi-geo-alt" />
          {bien.adresse}
        </p>
      )}

      {bien.description && <p className={styles.bienDetailsDescription}>{bien.description}</p>}

      <div className={styles.detailsInfoGrid}>
        <div className={styles.detailsInfoItem}>
          <span className={styles.detailsInfoLabel}>Créé le</span>
          <span className={styles.detailsInfoValue}>{formatDate(bien.created_at)}</span>
        </div>
        <div className={styles.detailsInfoItem}>
          <span className={styles.detailsInfoLabel}>Lots</span>
          <span className={styles.detailsInfoValue}>{bienLots.length}</span>
        </div>
        {bien.valorisation != null && (
          <div className={styles.detailsInfoItem}>
            <span className={styles.detailsInfoLabel}>Valorisation</span>
            <span className={styles.detailsInfoValue}>{formatCurrency(bien.valorisation)}</span>
          </div>
        )}
        {ownerName && (
          <div className={styles.detailsInfoItem}>
            <span className={styles.detailsInfoLabel}>Propriétaire</span>
            <span className={styles.detailsInfoValue}>{ownerName}</span>
          </div>
        )}
      </div>

      <div className={styles.bienDetailsSection}>
        <h3 className={styles.bienDetailsSectionTitle}>
          <i className="bi bi-map" />
          Localisation
        </h3>
        {hasLocation ? (
          <MapPicker readOnly label="" latitude={bien.latitude} longitude={bien.longitude} adresse={bien.adresse} />
        ) : (
          <div className={styles.bienGalleryEmpty}>
            <i className="bi bi-geo" />
            Aucune localisation enregistrée pour ce bien.
          </div>
        )}
      </div>

      {canManageCharges !== undefined && <ChargesSection bienId={bien.id} canManage={canManageCharges} />}

      {lots && (
        <div className={styles.bienDetailsSection}>
          <h3 className={styles.bienDetailsSectionTitle}>
            <i className="bi bi-grid-3x3-gap-fill" />
            Lots ({bienLots.length})
          </h3>
          {bienLots.length === 0 ? (
            <div className={styles.bienGalleryEmpty}>
              <i className="bi bi-grid-3x3-gap" />
              Aucun lot pour ce bien.
            </div>
          ) : (
            bienLots.map((lot) => (
              <button
                key={lot.id}
                type="button"
                className={styles.detailsListRow}
                onClick={() => onSelectLot?.(lot)}
                disabled={!onSelectLot}
              >
                {lotThumb(lot)}
                <div className={styles.detailsListRowBody}>
                  <div className={styles.detailsListRowTitle}>{lot.reference || `Lot #${lot.id}`}</div>
                  <div className={styles.detailsListRowSub}>{formatCurrency(lot.loyer_reference)}</div>
                </div>
                <StatusBadge tone="neutral">{LOT_STATUS_LABELS[lot.statut] || "—"}</StatusBadge>
              </button>
            ))
          )}
        </div>
      )}
    </Drawer>
  );
}
