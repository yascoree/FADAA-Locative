"use client";

import { useEffect, useMemo, useState } from "react";
import { extractErrorMessage } from "@/lib/apiClient";
import { useAuth } from "@/context/AuthContext";
import { fetchDashboardStats } from "@/lib/stats";
import { fetchBaux, fetchBiens, fetchEcheances, BAIL_STATUS, BAIL_STATUS_LABELS, ECHEANCE_STATUS, ECHEANCE_STATUS_LABELS } from "@/lib/properties";
import CountUp from "@/components/CountUp";
import styles from "./locataire.module.css";

function formatCurrency(value) {
  if (value === null || value === undefined) return "—";
  return `${Number(value).toLocaleString("fr-FR", { maximumFractionDigits: 0 })} MAD`;
}

function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
}

function formatDateShort(value) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

function badgeClass(statut) {
  if (statut === BAIL_STATUS.ACTIF) return styles.badgeActive;
  if (statut === BAIL_STATUS.EN_ATTENTE) return styles.badgeWarning;
  if (statut === BAIL_STATUS.RESILIE) return styles.badgeDanger;
  return styles.badgeNeutral;
}

function echeanceBadgeClass(echeance) {
  if (echeance.statut === ECHEANCE_STATUS.PAYE) return styles.badgeActive;
  if (echeance.statut === ECHEANCE_STATUS.PARTIEL) return styles.badgeWarning;
  const isLate = new Date(echeance.date_echeance) < new Date();
  return isLate ? styles.badgeDanger : styles.badgeNeutral;
}

function leaseProgressPercent(bail) {
  if (!bail?.date_debut || !bail?.date_fin) return null;
  const start = new Date(bail.date_debut).getTime();
  const end = new Date(bail.date_fin).getTime();
  if (!(end > start)) return null;
  return Math.max(0, Math.min(100, ((Date.now() - start) / (end - start)) * 100));
}

/** Jauge circulaire (meter) : le remplissage porte la valeur, la piste est un
    palier plus clair de la même teinte (voir skill dataviz — jamais un donut nominal). */
function RadialMeter({ percent, label, sublabel, tone }) {
  const size = 118;
  const stroke = 11;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = percent === null ? 0 : Math.max(0, Math.min(100, percent));
  const offset = c * (1 - clamped / 100);
  return (
    <div className={styles.meterCard}>
      <div className={styles.meterWrap}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} fill="none" className={styles[`meterTrack${tone}`]} />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            strokeWidth={stroke}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={offset}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            className={styles[`meterFill${tone}`]}
          />
        </svg>
        <div className={styles.meterCenter}>
          <div className={styles.meterValue}>{percent === null ? "—" : `${clamped.toFixed(0)}%`}</div>
        </div>
      </div>
      <div className={styles.meterLabel}>{label}</div>
      {sublabel && <div className={styles.meterSublabel}>{sublabel}</div>}
    </div>
  );
}

export default function LocataireDashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [baux, setBaux] = useState([]);
  const [biens, setBiens] = useState([]);
  const [echeances, setEcheances] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    async function init() {
      setIsLoading(true);
      try {
        const [statsData, bauxList, biensList, echeancesList] = await Promise.all([
          fetchDashboardStats(),
          fetchBaux(),
          fetchBiens(),
          fetchEcheances(),
        ]);
        setStats(statsData);
        setBaux(bauxList);
        setBiens(biensList);
        setEcheances(echeancesList);
      } catch (err) {
        setLoadError(extractErrorMessage(err));
      } finally {
        setIsLoading(false);
      }
    }
    init();
  }, []);

  const today = new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });

  const activeBaux = useMemo(() => baux.filter((b) => b.statut === BAIL_STATUS.ACTIF), [baux]);
  const activeBail = activeBaux[0] || null;

  const bailEcheances = useMemo(
    () => (activeBail ? echeances.filter((e) => e.bail_id === activeBail.id) : []),
    [echeances, activeBail]
  );

  const paymentRate = useMemo(() => {
    if (bailEcheances.length === 0) return null;
    const paid = bailEcheances.filter((e) => e.statut === ECHEANCE_STATUS.PAYE).length;
    return (paid / bailEcheances.length) * 100;
  }, [bailEcheances]);

  const leaseProgress = leaseProgressPercent(activeBail);

  const upcomingEcheances = useMemo(() => {
    const sorted = [...bailEcheances].sort((a, b) => new Date(a.date_echeance) - new Date(b.date_echeance));
    const unpaid = sorted.filter((e) => e.statut !== ECHEANCE_STATUS.PAYE);
    const paidRecent = sorted.filter((e) => e.statut === ECHEANCE_STATUS.PAYE).reverse();
    return [...unpaid, ...paidRecent].slice(0, 4);
  }, [bailEcheances]);

  function bienLotLabel(bail) {
    const bien = biens.find((b) => b.id === bail.lot?.bien_id);
    const bienName = bien?.designation || `Bien #${bail.lot?.bien_id}`;
    return `${bienName} — ${bail.lot?.reference || `Lot #${bail.lot_id}`}`;
  }

  if (isLoading) {
    return <p>Chargement...</p>;
  }

  if (loadError || !stats) {
    return <div className={`${styles.banner} ${styles.bannerError}`}>{loadError || "Impossible de charger les statistiques."}</div>;
  }

  return (
    <div>
      {/* ---- Header ---- */}
      <div className={styles.dashboardHeader}>
        <div>
          <h2 className={styles.dashboardGreeting}>Bonjour, {user?.prenom || ""}</h2>
          <p className={styles.dashboardSubtitle}>Voici l&apos;aperçu de votre location.</p>
        </div>
        <span className={styles.dashboardDate}>
          <i className="bi bi-calendar3" />
          {today}
        </span>
      </div>

      {/* ---- Tuiles ---- */}
      <div className={styles.heroTilesGrid}>
        <div className={`${styles.heroTile} ${styles.heroTileInfo}`}>
          <div className={styles.heroTileTop}>
            <span className={styles.heroTileIcon}>
              <i className="bi bi-calendar-event" />
            </span>
          </div>
          <div>
            <div className={styles.heroTileLabel}>Prochaine échéance</div>
            <div className={styles.heroTileValue}>
              {stats.prochaine_echeance_date ? formatDateShort(stats.prochaine_echeance_date) : "Aucune"}
            </div>
          </div>
        </div>

        <div className={`${styles.heroTile} ${styles.heroTilePrimary}`}>
          <div className={styles.heroTileTop}>
            <span className={styles.heroTileIcon}>
              <i className="bi bi-cash-stack" />
            </span>
          </div>
          <div>
            <div className={styles.heroTileLabel}>Montant à payer</div>
            <div className={styles.heroTileValue}>
              {stats.prochaine_echeance_montant != null ? (
                <CountUp value={stats.prochaine_echeance_montant} formatter={formatCurrency} />
              ) : (
                "—"
              )}
            </div>
          </div>
        </div>

        <div className={`${styles.heroTile} ${styles.heroTileDanger}`}>
          <div className={styles.heroTileTop}>
            <span className={styles.heroTileIcon}>
              <i className="bi bi-exclamation-octagon-fill" />
            </span>
          </div>
          <div>
            <div className={styles.heroTileLabel}>Échéances en retard</div>
            <div className={styles.heroTileValue}>
              <CountUp value={stats.echeances_en_retard} />
            </div>
          </div>
        </div>

        <div className={`${styles.heroTile} ${styles.heroTileGold}`}>
          <div className={styles.heroTileTop}>
            <span className={styles.heroTileIcon}>
              <i className="bi bi-graph-up-arrow" />
            </span>
          </div>
          <div>
            <div className={styles.heroTileLabel}>Payé cette année</div>
            <div className={styles.heroTileValue}>
              <CountUp value={stats.total_paye_cette_annee} formatter={formatCurrency} />
            </div>
          </div>
        </div>
      </div>

      {activeBaux.length === 0 ? (
        <div className={styles.section} style={{ marginBottom: 0 }}>
          <div className={styles.card}>
            <div className={styles.emptyState}>
              <i className="bi bi-house-slash" />
              <p>Aucun bail actif pour le moment.</p>
            </div>
          </div>
        </div>
      ) : (
        <div className={styles.heroGrid}>
          {/* ---- Mon logement ---- */}
          <div className={styles.card}>
            <div className={styles.logementHeader}>
              <span className={styles.logementIcon}>
                <i className="bi bi-house-door-fill" />
              </span>
              <div>
                <div className={styles.logementTitle}>{bienLotLabel(activeBail)}</div>
                <span className={`${styles.badge} ${badgeClass(activeBail.statut)}`}>{BAIL_STATUS_LABELS[activeBail.statut]}</span>
              </div>
            </div>

            <div className={styles.detailsGrid}>
              <div className={styles.detailItem}>
                <span className={styles.detailItemLabel}>Loyer mensuel</span>
                <span className={styles.detailItemValue}>
                  {formatCurrency(activeBail.loyer)}
                  {activeBail.charges ? ` + ${formatCurrency(activeBail.charges)} charges` : ""}
                </span>
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
            </div>
          </div>

          {/* ---- Jauges ---- */}
          <div className={styles.metersRow}>
            <RadialMeter percent={leaseProgress} tone="Navy" label="Progression du bail" sublabel="Durée écoulée" />
            <RadialMeter
              percent={paymentRate}
              tone={paymentRate === null || paymentRate >= 90 ? "Olive" : "Terracotta"}
              label="Échéances réglées"
              sublabel={`${bailEcheances.filter((e) => e.statut === ECHEANCE_STATUS.PAYE).length}/${bailEcheances.length} échéance(s)`}
            />
          </div>
        </div>
      )}

      {/* ---- Prochaines échéances ---- */}
      {upcomingEcheances.length > 0 && (
        <div className={styles.section} style={{ marginBottom: 0 }}>
          <div className={styles.card}>
            <h3 className={styles.cardTitle}>
              <i className="bi bi-list-check" style={{ color: "var(--primary)" }} />
              Échéances
            </h3>
            <div className={styles.echeanceList}>
              {upcomingEcheances.map((e) => (
                <div className={styles.echeanceRow} key={e.id}>
                  <div>
                    <div className={styles.echeanceDate}>{formatDateShort(e.date_echeance)}</div>
                    <div className={styles.echeanceMontant}>{formatCurrency(e.montant_du)}</div>
                  </div>
                  <span className={`${styles.badge} ${echeanceBadgeClass(e)}`}>{ECHEANCE_STATUS_LABELS[e.statut] || "—"}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
