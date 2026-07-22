"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { extractErrorMessage } from "@/lib/apiClient";
import { MODE_PAIEMENT_LABELS } from "@/lib/properties";
import { fetchRevenueStats } from "@/lib/stats";
import StatCard from "@/components/StatCard";
import styles from "../proprietaire.module.css";

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

const MONTH_LABELS = Array.from({ length: 12 }, (_, i) => shortMonthLabel(2000, i + 1));

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

const CHART_WIDTH = 760;
const CHART_HEIGHT = 260;
const PAD_LEFT = 50;
const PAD_RIGHT = 8;
const PAD_TOP = 20;
const PAD_BOTTOM = 26;
const INNER_WIDTH = CHART_WIDTH - PAD_LEFT - PAD_RIGHT;
const INNER_HEIGHT = CHART_HEIGHT - PAD_TOP - PAD_BOTTOM;

export default function ProprietaireRevenusPage() {
  const [revenue, setRevenue] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [viewMode, setViewMode] = useState("trailing"); // "trailing" | "yoy"
  const [hoverIndex, setHoverIndex] = useState(null);
  const svgRef = useRef(null);

  useEffect(() => {
    async function init() {
      setIsLoading(true);
      try {
        const data = await fetchRevenueStats();
        setRevenue(data);
      } catch (err) {
        setLoadError(extractErrorMessage(err));
      } finally {
        setIsLoading(false);
      }
    }
    init();
  }, []);

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonthIndex = now.getMonth();

  // ---- Vue "12 derniers mois" (une seule série glissante) ----
  const trailing = useMemo(() => {
    if (!revenue) return { points: [], max: 100, linePath: "", areaPath: "" };
    const stepX = INNER_WIDTH / (revenue.trailing_12_months.length - 1);
    const raw = revenue.trailing_12_months.map((m, i) => ({
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

  // ---- Vue "Comparaison année/année" (Jan-Déc, 2 séries) ----
  const yoy = useMemo(() => {
    if (!revenue) return { currentPoints: [], previousPoints: [], max: 100, currentLinePath: "", previousLinePath: "", currentAreaPath: "" };
    const stepX = INNER_WIDTH / 11;
    const current = revenue.current_year_by_month.slice(0, currentMonthIndex + 1).map((m) => ({ month: m.month - 1, total: m.total }));
    const previous = revenue.previous_year_by_month.map((m) => ({ month: m.month - 1, total: m.total }));
    const max = niceMax(Math.max(...current.map((p) => p.total), ...previous.map((p) => p.total), 1));
    const toXY = (p) => ({
      ...p,
      x: PAD_LEFT + p.month * stepX,
      y: PAD_TOP + INNER_HEIGHT - (p.total / max) * INNER_HEIGHT,
    });
    const currentPoints = current.map(toXY);
    const previousPoints = previous.map(toXY);
    const currentLinePath = currentPoints.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
    const previousLinePath = previousPoints.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
    const baseline = PAD_TOP + INNER_HEIGHT;
    const first = currentPoints[0];
    const last = currentPoints[currentPoints.length - 1];
    const currentAreaPath = `${currentLinePath} L ${last.x.toFixed(1)} ${baseline} L ${first.x.toFixed(1)} ${baseline} Z`;
    return { currentPoints, previousPoints, max, currentLinePath, previousLinePath, currentAreaPath };
  }, [revenue, currentMonthIndex]);

  const stats = useMemo(() => {
    if (!revenue) return null;
    const lastMonth = trailing.points[trailing.points.length - 1]?.total || 0;
    const monthBefore = trailing.points[trailing.points.length - 2]?.total || 0;
    const variation = monthBefore > 0 ? ((lastMonth - monthBefore) / monthBefore) * 100 : lastMonth > 0 ? null : 0;

    const ytdCurrent = yoy.currentPoints.reduce((sum, p) => sum + p.total, 0);
    const ytdPrevious = yoy.previousPoints
      .filter((p) => p.month <= currentMonthIndex)
      .reduce((sum, p) => sum + p.total, 0);
    const croissanceYoY = ytdPrevious > 0 ? ((ytdCurrent - ytdPrevious) / ytdPrevious) * 100 : ytdCurrent > 0 ? null : 0;

    const moyenne = trailing.points.reduce((sum, p) => sum + p.total, 0) / (trailing.points.length || 1);

    return { lastMonth, variation, croissanceYoY, moyenne, tauxRecouvrement: revenue.taux_recouvrement };
  }, [revenue, trailing, yoy, currentMonthIndex]);

  const gridLines = [0, 1 / 3, 2 / 3, 1];
  const activeMax = viewMode === "trailing" ? trailing.max : yoy.max;

  function switchMode(mode) {
    if (mode === viewMode) return;
    setHoverIndex(null);
    setViewMode(mode);
  }

  function handlePointerMove(e) {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    const dataX = ratio * CHART_WIDTH;
    const stepX = viewMode === "trailing" ? INNER_WIDTH / (trailing.points.length - 1) : INNER_WIDTH / 11;
    const maxIndex = viewMode === "trailing" ? trailing.points.length - 1 : 11;
    const idx = Math.max(0, Math.min(maxIndex, Math.round((dataX - PAD_LEFT) / stepX)));
    setHoverIndex(idx);
  }

  if (isLoading) {
    return <p>Chargement...</p>;
  }

  if (loadError || !revenue || !stats) {
    return <div className={`${styles.banner} ${styles.bannerError}`}>{loadError || "Impossible de charger les statistiques."}</div>;
  }

  const lastPoint = trailing.points[trailing.points.length - 1];
  const hoverTrailing = viewMode === "trailing" && hoverIndex !== null ? trailing.points[hoverIndex] : null;
  const hoverX =
    hoverIndex !== null
      ? viewMode === "trailing"
        ? trailing.points[hoverIndex]?.x
        : PAD_LEFT + hoverIndex * (INNER_WIDTH / 11)
      : null;
  const hoverCurrentYoy = viewMode === "yoy" && hoverIndex !== null ? yoy.currentPoints.find((p) => p.month === hoverIndex) : null;
  const hoverPreviousYoy = viewMode === "yoy" && hoverIndex !== null ? yoy.previousPoints.find((p) => p.month === hoverIndex) : null;

  const byBienMax = Math.max(1, ...revenue.by_bien.map((r) => r.total));
  const byModeMax = Math.max(1, ...revenue.by_mode.map((r) => r.total));

  return (
    <div>
      {/* ---- Stats ---- */}
      <div className={styles.section}>
        <div className={styles.statsGrid}>
          <StatCard icon="bi-cash-stack" tone="primary" label="Revenu ce mois" value={formatCurrency(stats.lastMonth)} />
          <StatCard
            icon={stats.variation === null ? "bi-stars" : stats.variation >= 0 ? "bi-graph-up-arrow" : "bi-graph-down-arrow"}
            tone={stats.variation === null || stats.variation >= 0 ? "accent" : "danger"}
            label="Variation vs mois dernier"
            value={stats.variation === null ? "Nouveau" : `${stats.variation >= 0 ? "+" : ""}${stats.variation.toFixed(0)}%`}
          />
          <StatCard
            icon={stats.croissanceYoY !== null && stats.croissanceYoY < 0 ? "bi-graph-down-arrow" : "bi-graph-up-arrow"}
            tone={stats.croissanceYoY === null || stats.croissanceYoY >= 0 ? "primary" : "danger"}
            label={`Croissance vs ${currentYear - 1}`}
            value={stats.croissanceYoY === null ? "Nouveau" : `${stats.croissanceYoY >= 0 ? "+" : ""}${stats.croissanceYoY.toFixed(0)}%`}
          />
          <StatCard
            icon="bi-check2-circle"
            tone={stats.tauxRecouvrement === null || stats.tauxRecouvrement >= 90 ? "accent" : "warning"}
            label="Taux de recouvrement"
            value={stats.tauxRecouvrement === null ? "—" : `${stats.tauxRecouvrement.toFixed(0)}%`}
          />
          <StatCard icon="bi-bar-chart-line-fill" tone="primary" label="Moyenne mensuelle" value={formatCurrency(stats.moyenne)} />
        </div>
      </div>

      {/* ---- Courbe de revenus ---- */}
      <div className={styles.section}>
        <div className={styles.card}>
          <div className={styles.chartHeader}>
            <h2 className={styles.cardTitle} style={{ marginBottom: 0 }}>
              <i className="bi bi-graph-up" style={{ color: "var(--primary)" }} />
              {viewMode === "trailing" ? "Revenus encaissés — 12 derniers mois" : `Revenus — ${currentYear} vs ${currentYear - 1}`}
            </h2>
            <div className={styles.chartEndValue}>
              <div className={styles.chartEndLabel}>
                {viewMode === "trailing" ? lastPoint?.label : `${MONTH_LABELS[currentMonthIndex]} ${currentYear}`}
              </div>
              <div className={styles.chartEndAmount}>{formatCurrency(lastPoint?.total)}</div>
            </div>
          </div>

          <div className={styles.viewToggle} role="tablist" aria-label="Type de vue de la courbe">
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === "trailing"}
              className={`${styles.viewToggleBtn} ${viewMode === "trailing" ? styles.viewToggleBtnActive : ""}`}
              onClick={() => switchMode("trailing")}
            >
              <i className="bi bi-graph-up" />
              12 derniers mois
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === "yoy"}
              className={`${styles.viewToggleBtn} ${viewMode === "yoy" ? styles.viewToggleBtnActive : ""}`}
              onClick={() => switchMode("yoy")}
            >
              <i className="bi bi-arrow-left-right" />
              Comparaison annuelle
            </button>
          </div>

          {viewMode === "yoy" && (
            <div className={styles.chartLegend}>
              <span className={styles.chartLegendItem}>
                <span className={styles.chartLegendSwatch} />
                {currentYear} (en cours)
              </span>
              <span className={styles.chartLegendItem}>
                <span className={`${styles.chartLegendSwatch} ${styles.chartLegendSwatchMuted}`} />
                {currentYear - 1}
              </span>
            </div>
          )}

          <div className={styles.chartWrap} key={viewMode}>
            <svg
              ref={svgRef}
              className={`${styles.chartSvg} ${styles.chartFade}`}
              viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
              preserveAspectRatio="none"
              onMouseMove={handlePointerMove}
              onMouseLeave={() => setHoverIndex(null)}
              role="img"
              aria-label={
                viewMode === "trailing"
                  ? "Courbe des revenus mensuels sur les 12 derniers mois"
                  : `Comparaison des revenus mensuels ${currentYear} vs ${currentYear - 1}`
              }
            >
              {/* Gridlines + y ticks */}
              {gridLines.map((frac) => {
                const y = PAD_TOP + INNER_HEIGHT * (1 - frac);
                return (
                  <g key={frac}>
                    <line x1={PAD_LEFT} y1={y} x2={CHART_WIDTH - PAD_RIGHT} y2={y} className={styles.chartGrid} />
                    <text x={PAD_LEFT - 8} y={y + 3} textAnchor="end" className={styles.chartAxisText}>
                      {frac === 0 ? "0" : formatCurrency(activeMax * frac, true)}
                    </text>
                  </g>
                );
              })}

              {viewMode === "yoy" && <path d={yoy.previousLinePath} className={styles.chartLineMuted} />}
              <path d={viewMode === "trailing" ? trailing.areaPath : yoy.currentAreaPath} className={styles.chartArea} />
              <path d={viewMode === "trailing" ? trailing.linePath : yoy.currentLinePath} className={styles.chartLine} />

              {/* X labels */}
              {viewMode === "trailing"
                ? trailing.points.map((p, i) => (
                    <text
                      key={p.key}
                      x={p.x}
                      y={CHART_HEIGHT - 6}
                      textAnchor="middle"
                      className={styles.chartAxisText}
                      opacity={i % 2 === 0 ? 1 : 0.55}
                    >
                      {p.label}
                    </text>
                  ))
                : MONTH_LABELS.map((label, i) => (
                    <text
                      key={label}
                      x={PAD_LEFT + i * (INNER_WIDTH / 11)}
                      y={CHART_HEIGHT - 6}
                      textAnchor="middle"
                      className={styles.chartAxisText}
                    >
                      {label}
                    </text>
                  ))}

              {/* Point final (fin de série mise en avant) */}
              {viewMode === "trailing" && lastPoint && (
                <circle cx={lastPoint.x} cy={lastPoint.y} r={4.5} className={styles.chartDotEnd} />
              )}
              {viewMode === "yoy" && yoy.currentPoints.length > 0 && (
                <circle
                  cx={yoy.currentPoints[yoy.currentPoints.length - 1].x}
                  cy={yoy.currentPoints[yoy.currentPoints.length - 1].y}
                  r={4.5}
                  className={styles.chartDotEnd}
                />
              )}

              {/* Hover crosshair + points */}
              {hoverX !== null && (
                <>
                  <line x1={hoverX} y1={PAD_TOP} x2={hoverX} y2={PAD_TOP + INNER_HEIGHT} className={styles.chartCrosshair} />
                  {hoverTrailing && <circle cx={hoverTrailing.x} cy={hoverTrailing.y} r={5} className={styles.chartDot} />}
                  {hoverPreviousYoy && <circle cx={hoverPreviousYoy.x} cy={hoverPreviousYoy.y} r={4.5} className={styles.chartDotMuted} />}
                  {hoverCurrentYoy && <circle cx={hoverCurrentYoy.x} cy={hoverCurrentYoy.y} r={5} className={styles.chartDot} />}
                </>
              )}

              <rect
                x={PAD_LEFT}
                y={PAD_TOP}
                width={INNER_WIDTH}
                height={INNER_HEIGHT}
                className={styles.chartHit}
                onMouseMove={handlePointerMove}
              />
            </svg>

            {viewMode === "trailing" && hoverTrailing && (
              <div
                className={styles.chartTooltip}
                style={{ left: `${(hoverTrailing.x / CHART_WIDTH) * 100}%`, top: `${(hoverTrailing.y / CHART_HEIGHT) * 100}%` }}
              >
                <div className={styles.chartTooltipLabel}>{hoverTrailing.fullLabel}</div>
                <div className={styles.chartTooltipValue}>{formatCurrency(hoverTrailing.total)}</div>
              </div>
            )}

            {viewMode === "yoy" && hoverIndex !== null && (
              <div className={styles.chartTooltip} style={{ left: `${(hoverX / CHART_WIDTH) * 100}%`, top: "8%" }}>
                <div className={styles.chartTooltipLabel}>{MONTH_LABELS[hoverIndex]}</div>
                <div className={styles.chartTooltipRow}>
                  <span>{currentYear} :</span>
                  <span className={styles.chartTooltipValue}>
                    {hoverCurrentYoy ? formatCurrency(hoverCurrentYoy.total) : "—"}
                  </span>
                </div>
                <div className={styles.chartTooltipRow}>
                  <span>{currentYear - 1} :</span>
                  <span className={styles.chartTooltipValue}>{formatCurrency(hoverPreviousYoy?.total)}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ---- Revenu par bien + par mode de paiement ---- */}
      <div className={styles.dashboardGrid}>
        <div className={styles.section} style={{ marginBottom: 0 }}>
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>
              <i className="bi bi-house-door-fill" style={{ color: "var(--primary)" }} />
              Revenu par bien ({currentYear})
            </h2>
            <div className={styles.distribution}>
              {revenue.by_bien.length === 0 && <p className={styles.empty}>Aucun paiement enregistré.</p>}
              {revenue.by_bien.map((row) => (
                <div
                  className={styles.distributionRow}
                  key={row.bien_id}
                  style={{ gridTemplateColumns: "150px 1fr 92px" }}
                >
                  <span className={styles.distributionName}>{row.designation}</span>
                  <div className={styles.distributionTrack}>
                    <div className={styles.distributionFill} style={{ width: `${(row.total / byBienMax) * 100}%` }} />
                  </div>
                  <span className={styles.distributionCount}>{formatCurrency(row.total, true)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className={styles.section} style={{ marginBottom: 0 }}>
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>
              <i className="bi bi-credit-card-2-front-fill" style={{ color: "var(--primary)" }} />
              Par mode de paiement ({currentYear})
            </h2>
            <div className={styles.distribution}>
              {revenue.by_mode.length === 0 && <p className={styles.empty}>Aucun paiement enregistré.</p>}
              {revenue.by_mode.map((row) => (
                <div
                  className={styles.distributionRow}
                  key={row.mode ?? "autre"}
                  style={{ gridTemplateColumns: "110px 1fr 92px" }}
                >
                  <span className={styles.distributionName}>{MODE_PAIEMENT_LABELS[row.mode] || "Autre"}</span>
                  <div className={styles.distributionTrack}>
                    <div className={styles.distributionFill} style={{ width: `${(row.total / byModeMax) * 100}%` }} />
                  </div>
                  <span className={styles.distributionCount}>{formatCurrency(row.total, true)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
