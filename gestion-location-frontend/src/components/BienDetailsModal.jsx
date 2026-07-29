"use client";

import { useState } from "react";
import Modal from "@/components/Modal";
import StatusBadge from "@/components/StatusBadge";
import MapPicker from "@/components/MapPicker";
import { API_BASE_URL } from "@/lib/apiClient";
import { BIEN_STATUS, BIEN_STATUS_LABELS } from "@/lib/properties";
import styles from "./ui.module.css";

function photoUrl(url) {
  return `${API_BASE_URL}${url}`;
}

const STATUS_TONE = {
  [BIEN_STATUS.ACTIF]: "success",
  [BIEN_STATUS.INACTIF]: "warning",
  [BIEN_STATUS.ARCHIVE]: "danger",
};

function Gallery({ photos }) {
  const [activeIndex, setActiveIndex] = useState(0);

  if (photos.length === 0) {
    return (
      <div className={styles.bienGalleryEmpty}>
        <i className="bi bi-image" />
        Aucune photo pour ce bien.
      </div>
    );
  }

  const active = photos[Math.min(activeIndex, photos.length - 1)];

  return (
    <div className={styles.bienGallery}>
      <div className={styles.bienGalleryMain}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photoUrl(active.url)} alt="" />
        {photos.length > 1 && (
          <>
            <button
              type="button"
              className={`${styles.bienGalleryNav} ${styles.bienGalleryNavPrev}`}
              onClick={() => setActiveIndex((i) => (i - 1 + photos.length) % photos.length)}
              aria-label="Photo précédente"
            >
              <i className="bi bi-chevron-left" />
            </button>
            <button
              type="button"
              className={`${styles.bienGalleryNav} ${styles.bienGalleryNavNext}`}
              onClick={() => setActiveIndex((i) => (i + 1) % photos.length)}
              aria-label="Photo suivante"
            >
              <i className="bi bi-chevron-right" />
            </button>
            <span className={styles.bienGalleryCount}>
              {activeIndex + 1} / {photos.length}
            </span>
          </>
        )}
      </div>

      {photos.length > 1 && (
        <div className={styles.bienGalleryThumbs}>
          {photos.map((p, i) => (
            <button
              key={p.id}
              type="button"
              className={`${styles.bienGalleryThumb} ${i === activeIndex ? styles.bienGalleryThumbActive : ""}`}
              onClick={() => setActiveIndex(i)}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photoUrl(p.url)} alt="" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Vue détaillée d'un bien (lecture seule) : galerie photo complète et
    localisation sur carte — pour consulter sans passer par le formulaire
    d'édition. Partagé entre les espaces propriétaire et agence. */
export default function BienDetailsModal({ bien, categoryName, onClose }) {
  if (!bien) return null;

  const photos = bien.photos || [];
  const hasLocation = bien.latitude != null && bien.longitude != null;

  return (
    <Modal isOpen={!!bien} onClose={onClose} title={bien.designation || `Bien #${bien.id}`} size="lg">
      <div className={styles.bienDetailsMeta}>
        <StatusBadge tone={STATUS_TONE[bien.statut] || "neutral"}>{BIEN_STATUS_LABELS[bien.statut] || "—"}</StatusBadge>
        <span className={styles.bienDetailsCategory}>
          <i className="bi bi-tag" />
          {categoryName ? categoryName(bien.categorie_id) : "—"}
        </span>
      </div>

      <Gallery photos={photos} />

      {bien.adresse && (
        <p className={styles.bienDetailsAddress}>
          <i className="bi bi-geo-alt" />
          {bien.adresse}
        </p>
      )}

      {bien.description && <p className={styles.bienDetailsDescription}>{bien.description}</p>}

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
    </Modal>
  );
}
