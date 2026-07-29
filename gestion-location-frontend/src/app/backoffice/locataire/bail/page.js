"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { extractErrorMessage, API_BASE_URL } from "@/lib/apiClient";
import { fetchBaux, fetchBiens, fetchCategories, BAIL_STATUS, BAIL_STATUS_LABELS } from "@/lib/properties";
import styles from "../locataire.module.css";

function formatCurrency(value) {
  if (value === null || value === undefined || value === "") return "—";
  return `${Number(value).toLocaleString("fr-FR", { maximumFractionDigits: 0 })} MAD`;
}

function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
}

function photoUrl(url) {
  return `${API_BASE_URL}${url}`;
}

function badgeClass(statut) {
  if (statut === BAIL_STATUS.ACTIF) return styles.badgeActive;
  if (statut === BAIL_STATUS.EN_ATTENTE) return styles.badgeWarning;
  if (statut === BAIL_STATUS.RESILIE) return styles.badgeDanger;
  return styles.badgeNeutral;
}

function leaseProgress(bail) {
  if (!bail?.date_debut || !bail?.date_fin) return null;
  const start = new Date(bail.date_debut).getTime();
  const end = new Date(bail.date_fin).getTime();
  if (!(end > start)) return null;
  return Math.max(0, Math.min(100, ((Date.now() - start) / (end - start)) * 100));
}

function daysRemaining(bail) {
  if (!bail?.date_fin) return null;
  const diff = new Date(bail.date_fin).getTime() - Date.now();
  return Math.ceil(diff / 86400000);
}

export default function LocataireBailPage() {
  const [baux, setBaux] = useState([]);
  const [biens, setBiens] = useState([]);
  const [categories, setCategories] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    async function init() {
      setIsLoading(true);
      try {
        const [bauxList, biensList, categoriesList] = await Promise.all([fetchBaux(), fetchBiens(), fetchCategories()]);
        setBaux(bauxList);
        setBiens(biensList);
        setCategories(categoriesList);
      } catch (err) {
        setLoadError(extractErrorMessage(err));
      } finally {
        setIsLoading(false);
      }
    }
    init();
  }, []);

  const sortedBaux = useMemo(
    () => [...baux].sort((a, b) => new Date(b.date_debut || 0) - new Date(a.date_debut || 0)),
    [baux]
  );
  const activeBail = sortedBaux.find((b) => b.statut === BAIL_STATUS.ACTIF) || sortedBaux[0] || null;
  const historyBaux = sortedBaux.filter((b) => b.id !== activeBail?.id);

  function bienFor(bail) {
    return biens.find((b) => b.id === bail?.lot?.bien_id);
  }

  function categoryName(categorieId) {
    return categories.find((c) => c.id === categorieId)?.libelle;
  }

  if (isLoading) {
    return <p>Chargement...</p>;
  }

  if (loadError) {
    return <div className={`${styles.banner} ${styles.bannerError}`}>{loadError}</div>;
  }

  if (!activeBail) {
    return (
      <div className={styles.card}>
        <div className={styles.emptyState}>
          <i className="bi bi-house-slash" />
          <p>Vous n&apos;avez pas encore de bail enregistré.</p>
        </div>
      </div>
    );
  }

  const bien = bienFor(activeBail);
  const progress = leaseProgress(activeBail);
  const remaining = daysRemaining(activeBail);
  const category = categoryName(activeBail?.lot?.categorie_id);
  const photos = bien?.photos || [];

  return (
    <div>
      {/* ---- Photos ---- */}
      {photos.length > 0 && (
        <div className={styles.section} style={{ marginBottom: "1.5rem" }}>
          <div className={`${styles.photoGallery} ${photos.length === 1 ? styles.photoGallerySingle : ""}`}>
            <div className={styles.photoCover}>
              <img src={photoUrl(photos[0].url)} alt="" />
            </div>
            {photos.length > 1 && (
              <div className={styles.photoStrip}>
                {photos.slice(1, 5).map((p) => (
                  <div className={styles.photoThumbSm} key={p.id}>
                    <img src={photoUrl(p.url)} alt="" />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ---- En-tête logement ---- */}
      <div className={styles.card} style={{ marginBottom: "1.5rem" }}>
        <div className={styles.logementHeader}>
          <span className={styles.logementIcon}>
            <i className="bi bi-house-door-fill" />
          </span>
          <div style={{ flex: 1 }}>
            <div className={styles.logementTitle}>{bien?.designation || `Bien #${activeBail.lot?.bien_id}`}</div>
            <div className={styles.logementMetaRow}>
              <span className={`${styles.badge} ${badgeClass(activeBail.statut)}`}>
                {BAIL_STATUS_LABELS[activeBail.statut]}
              </span>
              {category && <span className={styles.tagPill}>{category}</span>}
              <span className={styles.tagPill}>{activeBail.lot?.reference || `Lot #${activeBail.lot_id}`}</span>
            </div>
          </div>
        </div>

        <div className={styles.detailsGrid}>
          <div className={styles.detailItem}>
            <span className={styles.detailItemLabel}>Loyer mensuel</span>
            <span className={styles.detailItemValue}>{formatCurrency(activeBail.loyer)}</span>
          </div>
          <div className={styles.detailItem}>
            <span className={styles.detailItemLabel}>Charges</span>
            <span className={styles.detailItemValue}>{formatCurrency(activeBail.charges)}</span>
          </div>
          <div className={styles.detailItem}>
            <span className={styles.detailItemLabel}>Dépôt de garantie</span>
            <span className={styles.detailItemValue}>{formatCurrency(activeBail.depot)}</span>
          </div>
          <div className={styles.detailItem}>
            <span className={styles.detailItemLabel}>Début du bail</span>
            <span className={styles.detailItemValue}>{formatDate(activeBail.date_debut)}</span>
          </div>
          <div className={styles.detailItem}>
            <span className={styles.detailItemLabel}>Fin du bail</span>
            <span className={styles.detailItemValue}>{formatDate(activeBail.date_fin)}</span>
          </div>
          <div className={styles.detailItem}>
            <span className={styles.detailItemLabel}>Temps restant</span>
            <span className={styles.detailItemValue}>
              {remaining === null ? "—" : remaining >= 0 ? `${remaining} jour(s)` : "Échu"}
            </span>
          </div>
        </div>

        {progress !== null && activeBail.statut === BAIL_STATUS.ACTIF && (
          <div className={styles.progressBlock}>
            <div className={styles.progressLabelRow}>
              <span>Durée écoulée</span>
              <span>{progress.toFixed(0)}%</span>
            </div>
            <div className={styles.progressTrack}>
              <div className={styles.progressFill} style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}

        <div className={styles.quickActions}>
          <Link href="/backoffice/locataire/echeances" className={styles.btn}>
            <i className="bi bi-calendar-check" />
            Voir mes échéances
          </Link>
          <Link href="/backoffice/locataire/discussions" className={styles.btnOutline}>
            <i className="bi bi-chat-dots" />
            Contacter le propriétaire
          </Link>
        </div>
      </div>

      {/* ---- Historique ---- */}
      {historyBaux.length > 0 && (
        <div className={styles.section} style={{ marginBottom: 0 }}>
          <div className={styles.card}>
            <h3 className={styles.cardTitle}>
              <i className="bi bi-clock-history" style={{ color: "var(--primary)" }} />
              Historique de mes baux
            </h3>
            <div className={styles.echeanceList}>
              {historyBaux.map((b) => {
                const b2 = bienFor(b);
                return (
                  <div className={styles.echeanceRow} key={b.id}>
                    <div>
                      <div className={styles.echeanceDate}>{b2?.designation || `Bien #${b.lot?.bien_id}`}</div>
                      <div className={styles.echeanceMontant}>
                        {formatDate(b.date_debut)} → {formatDate(b.date_fin)}
                      </div>
                    </div>
                    <span className={`${styles.badge} ${badgeClass(b.statut)}`}>{BAIL_STATUS_LABELS[b.statut]}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
