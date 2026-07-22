"use client";

import { useEffect, useState } from "react";
import { extractErrorMessage } from "@/lib/apiClient";
import { useAuth } from "@/context/AuthContext";
import { fetchDashboardStats } from "@/lib/stats";
import StatCard from "@/components/StatCard";
import CountUp from "@/components/CountUp";
import styles from "./agence.module.css";

function formatCurrency(value) {
  return `${Number(value || 0).toLocaleString("fr-FR", { maximumFractionDigits: 0 })} MAD`;
}

export default function AgenceDashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    async function init() {
      setIsLoading(true);
      try {
        const data = await fetchDashboardStats();
        setStats(data);
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

  return (
    <div>
      {/* ---- Header ---- */}
      <div className={styles.dashboardHeader}>
        <div>
          <h2 className={styles.dashboardGreeting}>Bonjour, {user?.prenom || ""}</h2>
          <p className={styles.dashboardSubtitle}>Voici l&apos;aperçu des portefeuilles que vous gérez.</p>
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
            icon="bi-person-badge-fill"
            tone="primary"
            label="Propriétaires gérés"
            value={<CountUp value={stats.proprietaires_geres} />}
          />
          <StatCard icon="bi-house-door-fill" tone="accent" label="Biens gérés" value={<CountUp value={stats.total_biens} />} />
          <StatCard icon="bi-grid-3x3-gap-fill" tone="primary" label="Lots gérés" value={<CountUp value={stats.total_lots} />} />
          <StatCard
            icon="bi-file-earmark-text-fill"
            tone="accent"
            label="Baux actifs"
            value={<CountUp value={stats.baux_actifs} />}
          />
          <StatCard
            icon="bi-exclamation-octagon-fill"
            tone={stats.echeances_en_retard > 0 ? "danger" : "primary"}
            label="Loyers en retard"
            value={<CountUp value={stats.echeances_en_retard} />}
          />
          <StatCard
            icon="bi-cash-stack"
            tone="accent"
            label="Revenu collecté ce mois"
            value={<CountUp value={stats.revenu_mois} formatter={formatCurrency} />}
          />
        </div>
      </div>

      {stats.proprietaires_geres === 0 && (
        <p className={styles.empty}>
          Aucun mandat actif pour l&apos;instant. Un propriétaire doit vous inviter pour que ses biens apparaissent ici.
        </p>
      )}
    </div>
  );
}
