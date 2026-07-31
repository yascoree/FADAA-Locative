"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { extractErrorMessage, API_BASE_URL } from "@/lib/apiClient";
import { fetchBaux, fetchBiens, fetchCategories, BAIL_STATUS, BAIL_STATUS_LABELS } from "@/lib/properties";
import MapPicker from "@/components/MapPicker";
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

function heroStatusClass(statut) {
  if (statut === BAIL_STATUS.ACTIF) return styles.leaseHeroStatusActive;
  if (statut === BAIL_STATUS.EN_ATTENTE) return styles.leaseHeroStatusWarning;
  if (statut === BAIL_STATUS.RESILIE) return styles.leaseHeroStatusDanger;
  return styles.leaseHeroStatusNeutral;
}

/** Anneau de progression SVG (durée écoulée du bail) — le pourcentage est
    affiché au centre, superposé au cercle via un positionnement absolu. */
function ProgressRing({ percent }) {
  const size = 128;
  const stroke = 10;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, percent));
  const offset = c * (1 - clamped / 100);
  return (
    <div className={styles.leaseProgressRingWrap}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--border)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--tone-navy)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className={styles.leaseProgressRingCenter}>
        <span className={styles.leaseProgressPercent}>{clamped.toFixed(0)}%</span>
        <span className={styles.leaseProgressPercentLabel}>écoulé</span>
      </div>
    </div>
  );
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
  const [selectedBailId, setSelectedBailId] = useState(null);

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
  const defaultBail = sortedBaux.find((b) => b.statut === BAIL_STATUS.ACTIF) || sortedBaux[0] || null;
  const selectedBail = sortedBaux.find((b) => b.id === selectedBailId) || defaultBail;

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

  if (!selectedBail) {
    return (
      <div className={styles.card}>
        <div className={styles.emptyState}>
          <i className="bi bi-house-slash" />
          <p>Vous n&apos;avez pas encore de bail enregistré.</p>
        </div>
      </div>
    );
  }

  const bien = bienFor(selectedBail);
  const progress = leaseProgress(selectedBail);
  const remaining = daysRemaining(selectedBail);
  const category = categoryName(selectedBail?.lot?.categorie_id);
  const photos = bien?.photos || [];

  return (
    <div>
      {/* ---- Sélecteur de bail (si plusieurs) ---- */}
      {sortedBaux.length > 1 && (
        <div className={styles.bailPickerRow}>
          {sortedBaux.map((b) => {
            const b2 = bienFor(b);
            const isSelected = b.id === selectedBail.id;
            const isActive = b.statut === BAIL_STATUS.ACTIF;
            return (
              <button
                type="button"
                key={b.id}
                className={`${styles.bailChip} ${isSelected ? styles.bailChipActive : ""}`}
                onClick={() => setSelectedBailId(b.id)}
              >
                <span
                  className={`${styles.bailChipDot} ${isActive ? styles.bailChipDotActive : styles.bailChipDotEnded}`}
                />
                <span className={styles.bailChipText}>
                  <span className={styles.bailChipName}>{b2?.designation || `Bien #${b.lot?.bien_id}`}</span>
                  <span className={styles.bailChipMeta}>
                    {BAIL_STATUS_LABELS[b.statut]} · {formatDate(b.date_debut)}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* ---- Carte hero : photo, identité, stats, progression, actions ---- */}
      <div className={styles.leaseCard}>
        <div className={styles.leaseHero}>
          {photos[0] ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className={styles.leaseHeroImg} src={photoUrl(photos[0].url)} alt="" />
          ) : (
            <div className={styles.leaseHeroPlaceholder}>
              <i className="bi bi-house-door-fill" />
            </div>
          )}
          <div className={styles.leaseHeroOverlay} />
          <span className={`${styles.leaseHeroStatus} ${heroStatusClass(selectedBail.statut)}`}>
            <i className="bi bi-circle-fill" />
            {BAIL_STATUS_LABELS[selectedBail.statut]}
          </span>
          {photos.length > 1 && (
            <span className={styles.leaseHeroPhotoCount}>
              <i className="bi bi-images" />
              {photos.length}
            </span>
          )}
          <div className={styles.leaseHeroContent}>
            <h2 className={styles.leaseHeroTitle}>{bien?.designation || `Bien #${selectedBail.lot?.bien_id}`}</h2>
            {bien?.adresse && (
              <div className={styles.leaseHeroAddress}>
                <i className="bi bi-geo-alt-fill" />
                {bien.adresse}
              </div>
            )}
          </div>
        </div>

        <div className={styles.leaseBody}>
          <div className={styles.leaseTagsRow}>
            {category && <span className={styles.tagPill}>{category}</span>}
            <span className={styles.tagPill}>{selectedBail.lot?.reference || `Lot #${selectedBail.lot_id}`}</span>
          </div>

          <div className={styles.leaseStatsGrid}>
            <div className={styles.leaseStatTile}>
              <span className={styles.leaseStatIcon}>
                <i className="bi bi-cash-stack" />
              </span>
              <div>
                <div className={styles.leaseStatLabel}>Loyer mensuel</div>
                <div className={styles.leaseStatValue}>{formatCurrency(selectedBail.loyer)}</div>
              </div>
            </div>
            <div className={styles.leaseStatTile}>
              <span className={styles.leaseStatIcon}>
                <i className="bi bi-receipt" />
              </span>
              <div>
                <div className={styles.leaseStatLabel}>Charges</div>
                <div className={styles.leaseStatValue}>{formatCurrency(selectedBail.charges)}</div>
              </div>
            </div>
            <div className={styles.leaseStatTile}>
              <span className={styles.leaseStatIcon}>
                <i className="bi bi-shield-check" />
              </span>
              <div>
                <div className={styles.leaseStatLabel}>Dépôt de garantie</div>
                <div className={styles.leaseStatValue}>{formatCurrency(selectedBail.depot)}</div>
              </div>
            </div>
            <div className={styles.leaseStatTile}>
              <span className={styles.leaseStatIcon}>
                <i className="bi bi-calendar-event" />
              </span>
              <div>
                <div className={styles.leaseStatLabel}>Début du bail</div>
                <div className={styles.leaseStatValue}>{formatDate(selectedBail.date_debut)}</div>
              </div>
            </div>
            <div className={styles.leaseStatTile}>
              <span className={styles.leaseStatIcon}>
                <i className="bi bi-calendar-x" />
              </span>
              <div>
                <div className={styles.leaseStatLabel}>Fin du bail</div>
                <div className={styles.leaseStatValue}>{formatDate(selectedBail.date_fin)}</div>
              </div>
            </div>
          </div>

          {progress !== null && selectedBail.statut === BAIL_STATUS.ACTIF && (
            <div className={styles.leaseProgressCard}>
              <ProgressRing percent={progress} />
              <div className={styles.leaseProgressInfo}>
                <div className={styles.leaseProgressInfoTitle}>Durée du bail</div>
                <div className={styles.leaseTimelineRow}>
                  <span>{formatDate(selectedBail.date_debut)}</span>
                  <span className={styles.leaseTimelineTrack}>
                    <span className={styles.leaseTimelineFill} style={{ width: `${progress}%` }} />
                  </span>
                  <span>{formatDate(selectedBail.date_fin)}</span>
                </div>
                <div className={styles.leaseProgressRemaining}>
                  {remaining === null ? "—" : remaining >= 0 ? `${remaining} jour(s) restant(s)` : "Bail échu"}
                </div>
              </div>
            </div>
          )}

          <div className={styles.leaseActionsGrid}>
            <Link href="/backoffice/locataire/echeances" className={styles.leaseActionCard}>
              <span className={styles.leaseActionIcon}>
                <i className="bi bi-calendar-check" />
              </span>
              <span className={styles.leaseActionText}>
                <span className={styles.leaseActionTitle}>Mes échéances</span>
                <span className={styles.leaseActionSub}>Voir le calendrier de paiement</span>
              </span>
              <i className={`bi bi-chevron-right ${styles.leaseActionChevron}`} />
            </Link>
            <Link href="/backoffice/locataire/discussions" className={styles.leaseActionCard}>
              <span className={styles.leaseActionIcon}>
                <i className="bi bi-chat-dots" />
              </span>
              <span className={styles.leaseActionText}>
                <span className={styles.leaseActionTitle}>Contacter le propriétaire</span>
                <span className={styles.leaseActionSub}>Ouvrir la discussion</span>
              </span>
              <i className={`bi bi-chevron-right ${styles.leaseActionChevron}`} />
            </Link>
          </div>
        </div>
      </div>

      {/* ---- Localisation ---- */}
      {bien?.latitude != null && bien?.longitude != null && (
        <div className={styles.section} style={{ marginBottom: 0 }}>
          <div className={styles.card}>
            <h3 className={styles.cardTitle}>
              <i className="bi bi-geo-alt-fill" style={{ color: "var(--primary)" }} />
              Localisation
            </h3>
            <MapPicker readOnly label="" latitude={bien.latitude} longitude={bien.longitude} adresse={bien.adresse} />
          </div>
        </div>
      )}
    </div>
  );
}
