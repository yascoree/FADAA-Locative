"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { extractErrorMessage } from "@/lib/apiClient";
import { useAuth } from "@/context/AuthContext";
import { LOT_STATUS_LABELS, BAIL_STATUS_LABELS } from "@/lib/properties";
import { fetchDashboardStats, fetchRevenueStats } from "@/lib/stats";
import { fetchMySubscription, fetchMyUsage, LIMIT_FIELDS, LIMIT_TO_USAGE_KEY, UNLIMITED, formatLimit } from "@/lib/subscriptions";
import CountUp from "@/components/CountUp";
import styles from "./proprietaire.module.css";

function formatCurrency(value, compact = false) {
  const num = Number(value || 0);
  if (compact) {
    return `${num.toLocaleString("fr-FR", { maximumFractionDigits: 1, notation: "compact" })} MAD`;
  }
  return `${num.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} MAD`;
}

function usageFillClass(percent) {
  if (percent === null) return styles.usageFill;
  if (percent >= 100) return `${styles.usageFill} ${styles.usageFillDanger}`;
  if (percent >= 75) return `${styles.usageFill} ${styles.usageFillWarning}`;
  return styles.usageFill;
}

function trialInfo(subscription) {
  if (!subscription?.plan?.is_trial || !subscription.trial_end) return null;
  const daysRemaining = Math.ceil((new Date(subscription.trial_end) - new Date()) / 86400000);
  if (daysRemaining < 0) return { state: "expired", daysRemaining: 0 };
  if (daysRemaining <= 3) return { state: "warning", daysRemaining };
  return { state: "active", daysRemaining };
}

function trialPillClass(state) {
  if (state === "expired") return styles.trialPillExpired;
  if (state === "warning") return styles.trialPillWarning;
  return styles.trialPillActive;
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
  if (value <= 0) return 100;
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
const PAD_LEFT = 46;
const PAD_RIGHT = 8;
const PAD_TOP = 16;
const PAD_BOTTOM = 24;
const INNER_WIDTH = CHART_WIDTH - PAD_LEFT - PAD_RIGHT;
const INNER_HEIGHT = CHART_HEIGHT - PAD_TOP - PAD_BOTTOM;

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
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            strokeWidth={stroke}
            fill="none"
            className={styles[`meterTrack${tone}`]}
          />
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

export default function ProprietaireDashboardPage() {
  const { user } = useAuth();

  const [stats, setStats] = useState(null);
  const [revenue, setRevenue] = useState(null);
  const [subscription, setSubscription] = useState(null);
  const [usage, setUsage] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [hoverIndex, setHoverIndex] = useState(null);
  const svgRef = useRef(null);

  useEffect(() => {
    async function init() {
      setIsLoading(true);
      try {
        const [statsData, revenueData] = await Promise.all([fetchDashboardStats(), fetchRevenueStats()]);
        setStats(statsData);
        setRevenue(revenueData);
      } catch (err) {
        setLoadError(extractErrorMessage(err));
      } finally {
        setIsLoading(false);
      }

      try {
        const [sub, use] = await Promise.all([fetchMySubscription(), fetchMyUsage()]);
        setSubscription(sub);
        setUsage(use);
      } catch {
        // Pas d'abonnement disponible (compte non-propriétaire ou données manquantes) : on masque juste la carte.
      }
    }
    init();
  }, []);

  const trailing = useMemo(() => {
    if (!revenue) return { points: [], max: 100, linePath: "", areaPath: "" };
    const months = revenue.trailing_12_months;
    const stepX = INNER_WIDTH / (months.length - 1);
    const raw = months.map((m, i) => ({
      key: `${m.year}-${m.month}`,
      label: shortMonthLabel(m.year, m.month),
      fullLabel: fullMonthLabel(m.year, m.month),
      total: m.total,
      x: PAD_LEFT + i * stepX,
    }));
    const max = niceMax(Math.max(...raw.map((p) => p.total), 1));
    const points = raw.map((p) => ({ ...p, y: PAD_TOP + INNER_HEIGHT - (p.total / max) * INNER_HEIGHT }));
    const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
    const baseline = PAD_TOP + INNER_HEIGHT;
    const areaPath = `${linePath} L ${points[points.length - 1].x.toFixed(1)} ${baseline} L ${points[0].x.toFixed(1)} ${baseline} Z`;
    return { points, max, linePath, areaPath };
  }, [revenue]);

  function handlePointerMove(e) {
    if (!svgRef.current || trailing.points.length === 0) return;
    const rect = svgRef.current.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    const dataX = ratio * CHART_WIDTH;
    const stepX = INNER_WIDTH / (trailing.points.length - 1);
    const idx = Math.max(0, Math.min(trailing.points.length - 1, Math.round((dataX - PAD_LEFT) / stepX)));
    setHoverIndex(idx);
  }

  const today = new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
  const trial = trialInfo(subscription);

  if (isLoading) {
    return <p>Chargement...</p>;
  }

  if (loadError || !stats || !revenue) {
    return <div className={`${styles.banner} ${styles.bannerError}`}>{loadError || "Impossible de charger les statistiques."}</div>;
  }

  const lotsMax = Math.max(1, ...stats.lots_by_status.map((s) => s.count));
  const bauxMax = Math.max(1, ...stats.baux_by_status.map((s) => s.count));
  const gridLines = [0, 0.5, 1];
  const lastPoint = trailing.points[trailing.points.length - 1];
  const hoverPoint = hoverIndex !== null ? trailing.points[hoverIndex] : null;
  const occupationRate = stats.total_lots > 0 ? (stats.lots_occupes / stats.total_lots) * 100 : null;

  return (
    <div>
      {/* ---- Header ---- */}
      <div className={styles.dashboardHeader}>
        <div>
          <h2 className={styles.dashboardGreeting}>Bonjour, {user?.prenom || ""}</h2>
          <p className={styles.dashboardSubtitle}>Voici l&apos;aperçu de votre patrimoine locatif.</p>
        </div>
        <span className={styles.dashboardDate}>
          <i className="bi bi-calendar3" />
          {today}
        </span>
      </div>

      {/* ---- Tuiles ---- */}
      <div className={styles.heroTilesGrid}>
        <div className={`${styles.heroTile} ${styles.heroTilePrimary}`}>
          <div className={styles.heroTileTop}>
            <span className={styles.heroTileIcon}>
              <i className="bi bi-cash-stack" />
            </span>
          </div>
          <div>
            <div className={styles.heroTileLabel}>Revenu ce mois</div>
            <div className={styles.heroTileValue}>
              <CountUp value={stats.revenu_mois} formatter={formatCurrency} />
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
            <div className={styles.heroTileLabel}>Loyers en retard</div>
            <div className={styles.heroTileValue}>
              <CountUp value={stats.montant_en_retard} formatter={formatCurrency} />
            </div>
          </div>
        </div>

        <div className={`${styles.heroTile} ${styles.heroTileGold}`}>
          <div className={styles.heroTileTop}>
            <span className={styles.heroTileIcon}>
              <i className="bi bi-house-door-fill" />
            </span>
          </div>
          <div>
            <div className={styles.heroTileLabel}>Biens gérés</div>
            <div className={styles.heroTileValue}>
              <CountUp value={stats.total_biens} />
            </div>
          </div>
        </div>

        <div className={`${styles.heroTile} ${styles.heroTileInfo}`}>
          <div className={styles.heroTileTop}>
            <span className={styles.heroTileIcon}>
              <i className="bi bi-file-earmark-text-fill" />
            </span>
          </div>
          <div>
            <div className={styles.heroTileLabel}>Baux actifs</div>
            <div className={styles.heroTileValue}>
              <CountUp value={stats.baux_actifs} />
            </div>
          </div>
        </div>
      </div>

      {/* ---- Courbe + jauges ---- */}
      <div className={styles.section}>
        <div className={styles.heroGrid}>
          <div className={styles.card}>
            <div className={styles.chartHeader}>
              <h2 className={styles.cardTitle} style={{ marginBottom: 0 }}>
                <i className="bi bi-graph-up" style={{ color: "var(--primary)" }} />
                Revenus — 12 derniers mois
              </h2>
              <div className={styles.chartEndValue}>
                <div className={styles.chartEndLabel}>{lastPoint?.label}</div>
                <div className={styles.chartEndAmount}>{formatCurrency(lastPoint?.total)}</div>
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
                aria-label="Courbe des revenus mensuels sur les 12 derniers mois"
              >
                {gridLines.map((frac) => {
                  const y = PAD_TOP + INNER_HEIGHT * (1 - frac);
                  return (
                    <g key={frac}>
                      <line x1={PAD_LEFT} y1={y} x2={CHART_WIDTH - PAD_RIGHT} y2={y} className={styles.chartGrid} />
                      <text x={PAD_LEFT - 8} y={y + 3} textAnchor="end" className={styles.chartAxisText}>
                        {frac === 0 ? "0" : formatCurrency(trailing.max * frac, true)}
                      </text>
                    </g>
                  );
                })}

                <path d={trailing.areaPath} className={styles.chartArea} />
                <path d={trailing.linePath} className={styles.chartLine} />

                {trailing.points.map((p, i) => (
                  <text
                    key={p.key}
                    x={p.x}
                    y={CHART_HEIGHT - 4}
                    textAnchor="middle"
                    className={styles.chartAxisText}
                    opacity={i % 2 === 0 ? 1 : 0.55}
                  >
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
                  <div className={styles.chartTooltipValue}>{formatCurrency(hoverPoint.total)}</div>
                </div>
              )}
            </div>
          </div>

          <div className={styles.metersRow}>
            <RadialMeter
              percent={occupationRate}
              tone="Navy"
              label="Taux d'occupation"
              sublabel={`${stats.lots_occupes}/${stats.total_lots} lot(s)`}
            />
            <RadialMeter
              percent={revenue.taux_recouvrement}
              tone={revenue.taux_recouvrement === null || revenue.taux_recouvrement >= 90 ? "Olive" : "Terracotta"}
              label="Taux de recouvrement"
              sublabel="Sur l'année en cours"
            />
          </div>
        </div>
      </div>

      {/* ---- Contenu secondaire ---- */}
      <div className={styles.dashboardGrid}>
        <div>
          <div className={styles.section}>
            <div className={styles.card}>
              <h2 className={styles.cardTitle}>
                <i className="bi bi-grid-3x3-gap-fill" style={{ color: "var(--primary)" }} />
                Statut des lots
              </h2>
              <div className={styles.distribution}>
                {stats.lots_by_status.length === 0 && <p className={styles.empty}>Aucun lot enregistré.</p>}
                {stats.lots_by_status.map((s) => (
                  <div className={styles.distributionRow} key={s.status}>
                    <span className={styles.distributionName}>{LOT_STATUS_LABELS[s.status] || s.status}</span>
                    <div className={styles.distributionTrack}>
                      <div className={styles.distributionFill} style={{ width: `${(s.count / lotsMax) * 100}%` }} />
                    </div>
                    <span className={styles.distributionCount}>{s.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className={styles.section} style={{ marginBottom: 0 }}>
            <div className={styles.card}>
              <h2 className={styles.cardTitle}>
                <i className="bi bi-file-earmark-text-fill" style={{ color: "var(--primary)" }} />
                Statut des baux
              </h2>
              <div className={styles.distribution}>
                {stats.baux_by_status.length === 0 && <p className={styles.empty}>Aucun bail enregistré.</p>}
                {stats.baux_by_status.map((s) => (
                  <div className={styles.distributionRow} key={s.status}>
                    <span className={styles.distributionName}>{BAIL_STATUS_LABELS[s.status] || s.status}</span>
                    <div className={styles.distributionTrack}>
                      <div className={styles.distributionFill} style={{ width: `${(s.count / bauxMax) * 100}%` }} />
                    </div>
                    <span className={styles.distributionCount}>{s.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Mon abonnement */}
        {subscription && (
          <div className={styles.section} style={{ marginBottom: 0 }}>
            <div className={styles.card}>
              <div className={styles.planHeader}>
                <div>
                  <div className={styles.planName}>{subscription.plan.name}</div>
                  <div className={styles.planMeta}>
                    {subscription.plan.price} MAD · {subscription.plan.duration_days}j
                  </div>
                </div>
                <span className={styles.badge} style={{ background: "var(--primary-soft)", color: "#4e5738" }}>
                  Actif
                </span>
              </div>

              {trial && (
                <span className={`${styles.trialPill} ${trialPillClass(trial.state)}`} style={{ marginBottom: "1rem", display: "inline-flex" }}>
                  <i className="bi bi-hourglass-split" />
                  {trial.state === "expired" ? "Essai expiré" : `Essai — ${trial.daysRemaining} j restants`}
                </span>
              )}

              {usage && (
                <div className={styles.usageGrid}>
                  {LIMIT_FIELDS.map((f) => {
                    const limit = subscription.plan[f.key];
                    const used = usage[LIMIT_TO_USAGE_KEY[f.key]];
                    const percent = limit === UNLIMITED ? null : Math.min(100, (used / Math.max(limit, 1)) * 100);
                    return (
                      <div className={styles.usageItem} key={f.key}>
                        <div className={styles.usageLabelRow}>
                          <span className={styles.usageLabelText}>
                            <i className={`bi ${f.icon}`} />
                            {f.label}
                          </span>
                          <span className={styles.usageCount}>
                            {used} / {formatLimit(limit)}
                          </span>
                        </div>
                        <div className={styles.usageTrack}>
                          <div
                            className={usageFillClass(percent)}
                            style={{ width: `${percent === null ? 100 : percent}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
