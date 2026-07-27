"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { extractErrorMessage } from "@/lib/apiClient";
import { useAuth } from "@/context/AuthContext";
import { fetchDashboardStats } from "@/lib/stats";
import { SUBSCRIPTION_STATUS_LABELS } from "@/lib/subscriptions";
import CountUp from "@/components/CountUp";
import styles from "./admin.module.css";

function formatCurrency(value, compact = false) {
  const num = Number(value || 0);
  if (compact) {
    return `${num.toLocaleString("fr-FR", { maximumFractionDigits: 1, notation: "compact" })} MAD`;
  }
  return `${num.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} MAD`;
}

function shortMonthLabel(year, month) {
  const label = new Date(year, month - 1, 1).toLocaleDateString("fr-FR", { month: "short" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function fullMonthLabel(year, month) {
  const label = new Date(year, month - 1, 1).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function niceMax(value) {
  if (value <= 0) return 10;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const residual = value / magnitude;
  let niceResidual = 10;
  if (residual <= 1) niceResidual = 1;
  else if (residual <= 2) niceResidual = 2;
  else if (residual <= 5) niceResidual = 5;
  return niceResidual * magnitude;
}

const CHART_WIDTH = 520;
const CHART_HEIGHT = 200;
const PAD_LEFT = 34;
const PAD_RIGHT = 8;
const PAD_TOP = 16;
const PAD_BOTTOM = 24;
const INNER_WIDTH = CHART_WIDTH - PAD_LEFT - PAD_RIGHT;
const INNER_HEIGHT = CHART_HEIGHT - PAD_TOP - PAD_BOTTOM;

const DONUT_RADIUS = 64;
const DONUT_CIRCUMFERENCE = 2 * Math.PI * DONUT_RADIUS;

const PLAN_TONE_CYCLE = ["Olive", "Navy", "Charcoal"];

function planTone(plan, nonTrialIndex) {
  if (plan.is_trial) return "Terracotta";
  return PLAN_TONE_CYCLE[nonTrialIndex % PLAN_TONE_CYCLE.length];
}

/** Jauge circulaire (meter) : le remplissage porte la valeur, la piste est un
    palier plus clair de la même teinte (voir skill dataviz). */
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

export default function AdminDashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [hoverIndex, setHoverIndex] = useState(null);
  const svgRef = useRef(null);

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

  const signups = useMemo(() => {
    if (!stats) return { points: [], max: 10, linePath: "", areaPath: "" };
    const months = stats.signups_last_6_months;
    const stepX = INNER_WIDTH / (months.length - 1);
    const raw = months.map((m, i) => ({
      key: `${m.year}-${m.month}`,
      label: shortMonthLabel(m.year, m.month),
      fullLabel: fullMonthLabel(m.year, m.month),
      total: m.count,
      x: PAD_LEFT + i * stepX,
    }));
    const max = niceMax(Math.max(...raw.map((p) => p.total), 1));
    const points = raw.map((p) => ({ ...p, y: PAD_TOP + INNER_HEIGHT - (p.total / max) * INNER_HEIGHT }));
    const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
    const baseline = PAD_TOP + INNER_HEIGHT;
    const areaPath = `${linePath} L ${points[points.length - 1].x.toFixed(1)} ${baseline} L ${points[0].x.toFixed(1)} ${baseline} Z`;
    return { points, max, linePath, areaPath };
  }, [stats]);

  const planTones = useMemo(() => {
    if (!stats) return {};
    const map = {};
    let nonTrialIndex = 0;
    stats.subscriptions_by_plan.forEach((p) => {
      map[p.plan_id] = planTone(p, nonTrialIndex);
      if (!p.is_trial) nonTrialIndex += 1;
    });
    return map;
  }, [stats]);

  const planDistTotal = useMemo(() => {
    if (!stats) return 0;
    return stats.subscriptions_by_plan.reduce((sum, p) => sum + p.count, 0);
  }, [stats]);

  const donutSegments = useMemo(() => {
    if (!stats || planDistTotal === 0) return [];
    const GAP_PCT = 1.5;
    let cumulative = 0;
    return stats.subscriptions_by_plan
      .filter((p) => p.count > 0)
      .map((p) => {
        const pct = (p.count / planDistTotal) * 100;
        const startPct = cumulative;
        cumulative += pct;
        const midAngleDeg = -90 + ((startPct + cumulative) / 2) * 3.6;
        return {
          planId: p.plan_id,
          planName: p.plan_name,
          count: p.count,
          pct,
          startPct,
          dashPct: Math.max(0, pct - GAP_PCT),
          midAngleDeg,
          tone: (planTones[p.plan_id] || "Charcoal").toLowerCase(),
        };
      });
  }, [stats, planTones, planDistTotal]);

  function handlePointerMove(e) {
    if (!svgRef.current || signups.points.length === 0) return;
    const rect = svgRef.current.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    const dataX = ratio * CHART_WIDTH;
    const stepX = INNER_WIDTH / (signups.points.length - 1);
    const idx = Math.max(0, Math.min(signups.points.length - 1, Math.round((dataX - PAD_LEFT) / stepX)));
    setHoverIndex(idx);
  }

  const today = new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });

  if (isLoading) {
    return <p>Chargement...</p>;
  }

  if (loadError || !stats) {
    return <div className={`${styles.banner} ${styles.bannerError}`}>{loadError || "Impossible de charger les statistiques."}</div>;
  }

  const statusLabels = stats.subscriptions_by_status.map((s) => ({
    ...s,
    label: SUBSCRIPTION_STATUS_LABELS[s.status] || `Statut ${s.status}`,
  }));
  const statusMax = Math.max(1, ...statusLabels.map((s) => s.count));
  const gridLines = [0, 0.5, 1];
  const lastPoint = signups.points[signups.points.length - 1];
  const hoverPoint = hoverIndex !== null ? signups.points[hoverIndex] : null;
  const couvertureAbonnements = stats.total_users > 0 ? (stats.active_subscriptions / stats.total_users) * 100 : null;

  return (
    <div>
      {/* ---- Header ---- */}
      <div className={styles.dashboardHeader}>
        <div>
          <h2 className={styles.dashboardGreeting}>Bonjour, {user?.prenom || "Admin"}</h2>
          <p className={styles.dashboardSubtitle}>Voici l&apos;aperçu global de la plateforme FADAA Locative.</p>
        </div>
        <span className={styles.dashboardDate}>
          <i className="bi bi-calendar3" />
          {today}
        </span>
      </div>

      {/* ---- Tuiles ---- */}
      <div className={styles.heroTilesGrid}>
        <Link href="/backoffice/admin/abonnements" className={`${styles.heroTile} ${styles.heroTilePrimary}`}>
          <div className={styles.heroTileTop}>
            <span className={styles.heroTileIcon}>
              <i className="bi bi-cash-stack" />
            </span>
          </div>
          <div>
            <div className={styles.heroTileLabel}>Revenu mensuel (MRR)</div>
            <div className={styles.heroTileValue}>
              <CountUp value={stats.mrr} formatter={formatCurrency} />
            </div>
          </div>
        </Link>

        <Link href="/backoffice/admin/utilisateurs" className={`${styles.heroTile} ${styles.heroTileGold}`}>
          <div className={styles.heroTileTop}>
            <span className={styles.heroTileIcon}>
              <i className="bi bi-people-fill" />
            </span>
          </div>
          <div>
            <div className={styles.heroTileLabel}>Utilisateurs totaux</div>
            <div className={styles.heroTileValue}>
              <CountUp value={stats.total_users} />
            </div>
          </div>
        </Link>

        <Link href="/backoffice/admin/abonnements" className={`${styles.heroTile} ${styles.heroTileInfo}`}>
          <div className={styles.heroTileTop}>
            <span className={styles.heroTileIcon}>
              <i className="bi bi-credit-card-fill" />
            </span>
          </div>
          <div>
            <div className={styles.heroTileLabel}>Abonnements actifs</div>
            <div className={styles.heroTileValue}>
              <CountUp value={stats.active_subscriptions} />
            </div>
          </div>
        </Link>

        <Link href="/backoffice/admin/abonnements" className={`${styles.heroTile} ${styles.heroTileDanger}`}>
          <div className={styles.heroTileTop}>
            <span className={styles.heroTileIcon}>
              <i className="bi bi-graph-up-arrow" />
            </span>
          </div>
          <div>
            <div className={styles.heroTileLabel}>Revenu moyen / compte</div>
            <div className={styles.heroTileValue}>
              <CountUp value={stats.arpu} formatter={formatCurrency} />
            </div>
          </div>
        </Link>
      </div>

      {/* ---- Courbe + jauges ---- */}
      <div className={styles.section}>
        <div className={styles.heroGrid}>
          <div className={styles.card}>
            <div className={styles.chartHeader}>
              <h2 className={styles.cardTitle} style={{ marginBottom: 0 }}>
                <i className="bi bi-graph-up" style={{ color: "var(--primary)" }} />
                Nouvelles inscriptions — 6 derniers mois
              </h2>
              <div className={styles.chartEndValue}>
                <div className={styles.chartEndLabel}>{lastPoint?.label}</div>
                <div className={styles.chartEndAmount}>{lastPoint?.total ?? 0}</div>
              </div>
            </div>

            <div className={styles.chartWrap}>
              <svg
                ref={svgRef}
                className={styles.chartSvg}
                viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
                preserveAspectRatio="none"
                onMouseMove={handlePointerMove}
                onMouseLeave={() => setHoverIndex(null)}
                role="img"
                aria-label="Courbe des nouvelles inscriptions sur les 6 derniers mois"
              >
                {gridLines.map((frac) => {
                  const y = PAD_TOP + INNER_HEIGHT * (1 - frac);
                  return (
                    <g key={frac}>
                      <line x1={PAD_LEFT} y1={y} x2={CHART_WIDTH - PAD_RIGHT} y2={y} className={styles.chartGrid} />
                      <text x={PAD_LEFT - 8} y={y + 3} textAnchor="end" className={styles.chartAxisText}>
                        {Math.round(signups.max * frac)}
                      </text>
                    </g>
                  );
                })}

                <path d={signups.areaPath} className={styles.chartArea} />
                <path d={signups.linePath} className={styles.chartLine} />

                {signups.points.map((p) => (
                  <text key={p.key} x={p.x} y={CHART_HEIGHT - 4} textAnchor="middle" className={styles.chartAxisText}>
                    {p.label}
                  </text>
                ))}

                {lastPoint && <circle cx={lastPoint.x} cy={lastPoint.y} r={4} className={styles.chartDotEnd} />}

                {hoverPoint && (
                  <>
                    <line x1={hoverPoint.x} y1={PAD_TOP} x2={hoverPoint.x} y2={PAD_TOP + INNER_HEIGHT} className={styles.chartCrosshair} />
                    <circle cx={hoverPoint.x} cy={hoverPoint.y} r={4.5} className={styles.chartDot} />
                  </>
                )}

                <rect x={PAD_LEFT} y={PAD_TOP} width={INNER_WIDTH} height={INNER_HEIGHT} className={styles.chartHit} onMouseMove={handlePointerMove} />
              </svg>

              {hoverPoint && (
                <div
                  className={styles.chartTooltip}
                  style={{ left: `${(hoverPoint.x / CHART_WIDTH) * 100}%`, top: `${(hoverPoint.y / CHART_HEIGHT) * 100}%` }}
                >
                  <div className={styles.chartTooltipLabel}>{hoverPoint.fullLabel}</div>
                  <div className={styles.chartTooltipValue}>{hoverPoint.total} inscription(s)</div>
                </div>
              )}
            </div>
          </div>

          <div className={styles.metersRow}>
            <RadialMeter percent={stats.activation_rate} tone="Navy" label="Taux d'activation" sublabel="Comptes actifs / total" />
            <RadialMeter
              percent={couvertureAbonnements}
              tone={couvertureAbonnements === null || couvertureAbonnements >= 50 ? "Olive" : "Terracotta"}
              label="Couverture abonnements"
              sublabel="Abonnés / utilisateurs"
            />
          </div>
        </div>
      </div>

      {/* ---- Abonnements par statut / Répartition des plans ---- */}
      <div className={styles.section} style={{ marginBottom: 0 }}>
        <div className={styles.dashboardGrid}>
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>
              <i className="bi bi-credit-card-2-front-fill" style={{ color: "var(--primary)" }} />
              Abonnements par statut
            </h2>
            <div className={styles.distribution}>
              {statusLabels.map((s) => (
                <div className={styles.distributionRow} key={s.status}>
                  <span className={styles.distributionName}>{s.label}</span>
                  <div className={styles.distributionTrack}>
                    <div className={styles.distributionFill} style={{ width: `${(s.count / statusMax) * 100}%` }} />
                  </div>
                  <span className={styles.distributionCount}>{s.count}</span>
                </div>
              ))}
            </div>
          </div>

          <div className={styles.card}>
            <h2 className={styles.cardTitle}>
              <i className="bi bi-pie-chart-fill" style={{ color: "var(--primary)" }} />
              Répartition des plans
            </h2>

            {stats.subscriptions_by_plan.length === 0 && <p className={styles.empty}>Aucun plan configuré.</p>}
            {stats.subscriptions_by_plan.length > 0 && planDistTotal === 0 && (
              <p className={styles.empty}>Aucun abonnement pour le moment.</p>
            )}

            {planDistTotal > 0 && (
              <div className={styles.donutSection}>
                <div className={styles.donutWrap}>
                  <svg viewBox="0 0 180 180" className={styles.donutSvg}>
                    <circle cx="90" cy="90" r="64" fill="none" stroke="var(--border)" strokeWidth="28" />
                    {donutSegments.map((seg) => (
                      <circle
                        key={seg.planId}
                        cx="90"
                        cy="90"
                        r="64"
                        fill="none"
                        stroke={`var(--tone-${seg.tone})`}
                        strokeWidth="28"
                        strokeLinecap="round"
                        strokeDasharray={`${(seg.dashPct / 100) * DONUT_CIRCUMFERENCE} ${DONUT_CIRCUMFERENCE}`}
                        strokeDashoffset={-(seg.startPct / 100) * DONUT_CIRCUMFERENCE}
                        transform="rotate(-90 90 90)"
                      />
                    ))}
                  </svg>
                  <div className={styles.donutCenter}>
                    <span className={styles.donutCenterValue}>
                      <CountUp value={planDistTotal} />
                    </span>
                    <span className={styles.donutCenterLabel}>Abonnements</span>
                  </div>
                  {donutSegments.map((seg) => {
                    const rad = (seg.midAngleDeg * Math.PI) / 180;
                    const labelR = 90;
                    const x = 90 + labelR * Math.cos(rad);
                    const y = 90 + labelR * Math.sin(rad);
                    return (
                      <span
                        key={seg.planId}
                        className={styles.donutLabel}
                        style={{
                          left: `${(x / 180) * 100}%`,
                          top: `${(y / 180) * 100}%`,
                          color: `var(--tone-${seg.tone}-dark)`,
                        }}
                      >
                        {Math.round(seg.pct)}%
                      </span>
                    );
                  })}
                </div>
                <div className={styles.donutLegend}>
                  {stats.subscriptions_by_plan
                    .filter((p) => p.count > 0)
                    .map((p) => (
                      <div className={styles.donutLegendRow} key={p.plan_id}>
                        <span
                          className={styles.donutLegendDot}
                          style={{ background: `var(--tone-${(planTones[p.plan_id] || "Charcoal").toLowerCase()})` }}
                        />
                        <span className={styles.donutLegendName}>{p.plan_name}</span>
                        <span className={styles.donutLegendCount}>{p.count}</span>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
