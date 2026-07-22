"use client";

import { useEffect, useState } from "react";
import { extractErrorMessage } from "@/lib/apiClient";
import { useAuth } from "@/context/AuthContext";
import { fetchDashboardStats } from "@/lib/stats";
import { fetchBaux, fetchBiens, BAIL_STATUS, BAIL_STATUS_LABELS } from "@/lib/properties";
import StatCard from "@/components/StatCard";
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

function badgeClass(statut) {
  if (statut === BAIL_STATUS.ACTIF) return styles.badgeActive;
  if (statut === BAIL_STATUS.EN_ATTENTE) return styles.badgeWarning;
  if (statut === BAIL_STATUS.RESILIE) return styles.badgeDanger;
  return styles.badgeNeutral;
}

export default function LocataireDashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [baux, setBaux] = useState([]);
  const [biens, setBiens] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    async function init() {
      setIsLoading(true);
      try {
        const [statsData, bauxList, biensList] = await Promise.all([fetchDashboardStats(), fetchBaux(), fetchBiens()]);
        setStats(statsData);
        setBaux(bauxList);
        setBiens(biensList);
      } catch (err) {
        setLoadError(extractErrorMessage(err));
      } finally {
        setIsLoading(false);
      }
    }
    init();
  }, []);

  const today = new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });

  if (isLoading) {
    return <p>Chargement...</p>;
  }

  if (loadError || !stats) {
    return <div className={`${styles.banner} ${styles.bannerError}`}>{loadError || "Impossible de charger les statistiques."}</div>;
  }

  const activeBaux = baux.filter((b) => b.statut === BAIL_STATUS.ACTIF);

  function bienLotLabel(bail) {
    const bien = biens.find((b) => b.id === bail.lot?.bien_id);
    const bienName = bien?.designation || `Bien #${bail.lot?.bien_id}`;
    return `${bienName} — ${bail.lot?.reference || `Lot #${bail.lot_id}`}`;
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

      {/* ---- Stats ---- */}
      <div className={styles.section}>
        <div className={styles.statsGrid}>
          <StatCard
            icon="bi-calendar-event"
            tone="primary"
            label="Prochaine échéance"
            value={stats.prochaine_echeance_date ? formatDate(stats.prochaine_echeance_date) : "Aucune"}
          />
          <StatCard
            icon="bi-cash-stack"
            tone="accent"
            label="Montant à payer"
            value={
              stats.prochaine_echeance_montant != null ? (
                <CountUp value={stats.prochaine_echeance_montant} formatter={formatCurrency} />
              ) : (
                "—"
              )
            }
          />
          <StatCard
            icon="bi-exclamation-octagon-fill"
            tone={stats.echeances_en_retard > 0 ? "danger" : "primary"}
            label="Échéances en retard"
            value={<CountUp value={stats.echeances_en_retard} />}
          />
          <StatCard
            icon="bi-graph-up-arrow"
            tone="accent"
            label="Payé cette année"
            value={<CountUp value={stats.total_paye_cette_annee} formatter={formatCurrency} />}
          />
        </div>
      </div>

      {/* ---- Mon logement ---- */}
      <div className={styles.section} style={{ marginBottom: 0 }}>
        <div className={styles.card}>
          <h3 className={styles.cardTitle}>
            <i className="bi bi-house-door-fill" style={{ color: "var(--primary)" }} />
            Mon logement
          </h3>
          {activeBaux.length === 0 && <p className={styles.empty}>Aucun bail actif pour le moment.</p>}
          {activeBaux.map((bail) => (
            <div key={bail.id} style={{ marginBottom: "1rem", paddingBottom: "1rem", borderBottom: "1px solid var(--border)" }}>
              <div className={styles.detailLine}>
                <strong>Logement :</strong> {bienLotLabel(bail)}
              </div>
              <div className={styles.detailLine}>
                <strong>Loyer :</strong> {formatCurrency(bail.loyer)}
                {bail.charges ? ` + ${formatCurrency(bail.charges)} charges` : ""}
              </div>
              <div className={styles.detailLine}>
                <strong>Période :</strong> {formatDate(bail.date_debut)} → {formatDate(bail.date_fin)}
              </div>
              <div className={styles.detailLine}>
                <strong>Statut :</strong>{" "}
                <span className={`${styles.badge} ${badgeClass(bail.statut)}`}>{BAIL_STATUS_LABELS[bail.statut]}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
