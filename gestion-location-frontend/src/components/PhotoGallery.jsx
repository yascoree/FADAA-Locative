"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { API_BASE_URL } from "@/lib/apiClient";
import styles from "./PhotoGallery.module.css";

function photoUrl(url) {
  return `${API_BASE_URL}${url}`;
}

function Lightbox({ photos, index, onClose, onPrev, onNext }) {
  useEffect(() => {
    function handleKeyDown(e) {
      // Capture phase + stopPropagation : cette vue s'ouvre par-dessus un Drawer
      // qui a lui-même un handler Échap sur window, enregistré AVANT le nôtre
      // (bulle par défaut, donc invoqué en premier). Un stopImmediatePropagation
      // classique en phase bulle arrive trop tard pour l'empêcher. En interceptant
      // en phase de capture (qui s'exécute avant toute phase bulle sur window,
      // quel que soit l'ordre d'enregistrement), on coupe la propagation avant
      // qu'elle n'atteigne le handler du Drawer — Échap ne ferme alors que la
      // lightbox, pas le panneau détail dessous.
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      } else if (e.key === "ArrowRight" && photos.length > 1) {
        onNext();
      } else if (e.key === "ArrowLeft" && photos.length > 1) {
        onPrev();
      }
    }
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [photos.length, onClose, onPrev, onNext]);

  const photo = photos[index];

  return createPortal(
    <div className={styles.lightboxOverlay} onClick={onClose}>
      <button type="button" className={styles.lightboxClose} onClick={onClose} aria-label="Fermer">
        <i className="bi bi-x-lg" />
      </button>

      {photos.length > 1 && (
        <button
          type="button"
          className={`${styles.lightboxNav} ${styles.lightboxNavPrev}`}
          onClick={(e) => {
            e.stopPropagation();
            onPrev();
          }}
          aria-label="Photo précédente"
        >
          <i className="bi bi-chevron-left" />
        </button>
      )}

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={photoUrl(photo.url)} alt="" className={styles.lightboxImage} onClick={(e) => e.stopPropagation()} />

      {photos.length > 1 && (
        <button
          type="button"
          className={`${styles.lightboxNav} ${styles.lightboxNavNext}`}
          onClick={(e) => {
            e.stopPropagation();
            onNext();
          }}
          aria-label="Photo suivante"
        >
          <i className="bi bi-chevron-right" />
        </button>
      )}

      {photos.length > 1 && (
        <span className={styles.lightboxCount}>
          {index + 1} / {photos.length}
        </span>
      )}
    </div>,
    document.getElementById("portal-root") || document.body
  );
}

/** Galerie photo compacte (grille de vignettes, pas une grande image héro qui
    monopolise l'espace) pour les vues détail lecture-seule (Bien, Lot). Cliquer
    une vignette ouvre une visionneuse plein écran avec navigation clavier/flèches
    — c'est là que l'utilisateur voit l'image en grand, pas dans la grille elle-même. */
export default function PhotoGallery({ photos, emptyLabel = "Aucune photo." }) {
  const [lightboxIndex, setLightboxIndex] = useState(null);
  const list = photos || [];

  if (list.length === 0) {
    return (
      <div className={styles.empty}>
        <i className="bi bi-image" />
        {emptyLabel}
      </div>
    );
  }

  return (
    <>
      <div className={styles.grid}>
        {list.map((p, i) => (
          <button
            type="button"
            key={p.id}
            className={styles.thumb}
            onClick={() => setLightboxIndex(i)}
            aria-label="Agrandir la photo"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photoUrl(p.url)} alt="" />
            <span className={styles.thumbZoom}>
              <i className="bi bi-arrows-fullscreen" />
            </span>
          </button>
        ))}
      </div>

      {lightboxIndex !== null && (
        <Lightbox
          photos={list}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onPrev={() => setLightboxIndex((i) => (i - 1 + list.length) % list.length)}
          onNext={() => setLightboxIndex((i) => (i + 1) % list.length)}
        />
      )}
    </>
  );
}
