  "use client";

import { useEffect, useMemo, useState } from "react";
import { extractErrorMessage } from "@/lib/apiClient";
import {
  fetchPaiements,
  fetchBiens,
  fetchQuittances,
  downloadQuittance,
  MODE_PAIEMENT_LABELS,
  PAIEMENT_STATUS,
  PAIEMENT_STATUS_LABELS,
} from "@/lib/properties";
import { SORT_OPTIONS, sortList } from "@/lib/sort";
import StatCard from "@/components/StatCard";
import FilterChip from "@/components/FilterChip";
import FilterSelect from "@/components/FilterSelect";
import { useLanguage } from "@/context/LanguageContext";
import styles from "../locataire.module.css";

function Banner({ banner }) {
  if (!banner) return null;
  return (
    <div className={`${styles.banner} ${banner.type === "success" ? styles.bannerSuccess : styles.bannerError}`}>
      {banner.message}
    </div>
  );
}

function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

function formatCurrency(value) {
  if (value === null || value === undefined || value === "") return "—";
  return `${Number(value).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} MAD`;
}

const MODE_OPTIONS = Object.entries(MODE_PAIEMENT_LABELS).map(([value, label]) => ({ value, label }));
const PAGE_SIZE = 10;

export default function LocatairePaiementsPage() {
  const { t } = useLanguage();
  const [paiements, setPaiements] = useState([]);
  const [biens, setBiens] = useState([]);
  const [quittances, setQuittances] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [rowBanner, setRowBanner] = useState(null);
  const [downloadingId, setDownloadingId] = useState(null);

  const [modeFilter, setModeFilter] = useState("");
  const [monthOnly, setMonthOnly] = useState(false);
  const [sortBy, setSortBy] = useState("recent");
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    async function init() {
      setIsLoading(true);
      try {
        const [paiementsList, biensList, quittancesList] = await Promise.all([
          fetchPaiements(),
          fetchBiens(),
          fetchQuittances(),
        ]);
        setPaiements(paiementsList);
        setBiens(biensList);
        setQuittances(quittancesList);
      } catch (err) {
        setLoadError(extractErrorMessage(err));
      } finally {
        setIsLoading(false);
      }
    }
    init();
  }, []);

  const stats = useMemo(() => {
    const now = new Date();
    // Un paiement annulé ne doit plus compter dans les totaux affichés : on ne
    // prend en compte que les paiements encore valides.
    const valides = paiements.filter((p) => p.statut !== PAIEMENT_STATUS.ANNULE);
    const total = valides.reduce((sum, p) => sum + Number(p.montant || 0), 0);
    const moisCourant = valides
      .filter((p) => {
        const d = new Date(p.date_paiement);
        return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
      })
      .reduce((sum, p) => sum + Number(p.montant || 0), 0);
    return {
      count: valides.length,
      total,
      moisCourant,
      moyenne: valides.length > 0 ? total / valides.length : 0,
    };
  }, [paiements]);

  function bienLotLabel(echeance) {
    if (!echeance?.bail) return "—";
    const bien = biens.find((b) => b.id === echeance.bail.lot?.bien_id);
    const bienName = bien?.designation || `Bien #${echeance.bail.lot?.bien_id}`;
    return `${bienName} — ${echeance.bail.lot?.reference || `Lot #${echeance.bail.lot_id}`}`;
  }

  function quittanceFor(paiementId) {
    return quittances.find((q) => q.paiement_id === paiementId);
  }

  async function handleDownload(paiement) {
    const quittance = quittanceFor(paiement.id);
    if (!quittance) return;
    setDownloadingId(paiement.id);
    setRowBanner(null);
    try {
      await downloadQuittance(quittance.id);
    } catch (err) {
      setRowBanner({ type: "error", message: extractErrorMessage(err) });
    } finally {
      setDownloadingId(null);
    }
  }

  const filteredPaiements = useMemo(() => {
    const now = new Date();
    const filtered = paiements.filter((p) => {
      if (modeFilter && String(p.mode_paiement) !== modeFilter) return false;
      if (monthOnly) {
        const d = new Date(p.date_paiement);
        if (d.getFullYear() !== now.getFullYear() || d.getMonth() !== now.getMonth()) return false;
      }
      return true;
    });
    return sortList(filtered, sortBy, { dateOf: (p) => p.date_paiement, nameOf: (p) => bienLotLabel(p.echeance) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paiements, modeFilter, monthOnly, sortBy, biens]);

  const totalPages = Math.max(1, Math.ceil(filteredPaiements.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedPaiements = filteredPaiements.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  if (isLoading) {
    return <p>{t("bo.common.loading")}</p>;
  }

  return (
    <div>
      <Banner banner={loadError ? { type: "error", message: loadError } : null} />
      <Banner banner={rowBanner} />

      {/* ---- Stats ---- */}
      <div className={styles.section}>
        <div className={styles.statsGrid}>
          <StatCard icon="bi-receipt" tone="primary" label={t("bo.locatairePaiements.statPaiements")} value={stats.count} />
          <StatCard icon="bi-cash-stack" tone="accent" label={t("bo.locatairePaiements.statTotalPaid")} value={formatCurrency(stats.total)} />
          <StatCard
            icon="bi-calendar-check-fill"
            tone="primary"
            label={t("bo.locatairePaiements.statPaidThisMonth")}
            value={formatCurrency(stats.moisCourant)}
          />
          <StatCard icon="bi-graph-up-arrow" tone="accent" label={t("bo.locatairePaiements.statAverage")} value={formatCurrency(stats.moyenne)} />
        </div>
      </div>

      {/* ---- Table ---- */}
      <div className={styles.section} style={{ marginBottom: 0 }}>
        <div>
          <h2 className={styles.sectionTitle}>
            <i className="bi bi-table" style={{ marginRight: "0.5rem", color: "var(--primary)" }} />
            {t("bo.locatairePaiements.title")}
          </h2>
          <p className={styles.sectionSubtitle}>
            {t("bo.locatairePaiements.subtitle", { shown: filteredPaiements.length, total: paiements.length })}
          </p>
        </div>

        <div className={styles.filtersRow}>
          <FilterSelect
            value={modeFilter}
            onChange={(v) => {
              setModeFilter(v);
              setCurrentPage(1);
            }}
            options={[{ value: "", label: t("bo.locatairePaiements.allModes") }, ...MODE_OPTIONS]}
          />
          <FilterChip
            checked={monthOnly}
            onChange={(checked) => {
              setMonthOnly(checked);
              setCurrentPage(1);
            }}
          >
            {t("bo.locatairePaiements.thisMonthOnly")}
          </FilterChip>
          <FilterSelect value={sortBy} onChange={setSortBy} options={SORT_OPTIONS} />
        </div>

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>{t("bo.locatairePaiements.colHome")}</th>
                <th>{t("bo.locatairePaiements.colDueDate")}</th>
                <th>{t("bo.locatairePaiements.colAmount")}</th>
                <th>{t("bo.locatairePaiements.colMode")}</th>
                <th>{t("bo.locatairePaiements.colPaymentDate")}</th>
                <th>{t("bo.locatairePaiements.colStatus")}</th>
                <th>{t("bo.locatairePaiements.colReceipt")}</th>
              </tr>
            </thead>
            <tbody>
              {filteredPaiements.length === 0 && (
                <tr>
                  <td colSpan={7} className={styles.empty}>
                    {t("bo.locatairePaiements.noPayments")}
                  </td>
                </tr>
              )}
              {paginatedPaiements.map((p) => {
                const quittance = quittanceFor(p.id);
                return (
                  <tr key={p.id}>
                    <td>{bienLotLabel(p.echeance)}</td>
                    <td>{formatDate(p.echeance?.date_echeance)}</td>
                    <td>
                      {formatCurrency(p.montant)}
                      {p.echeance?.montant_du !== null && p.echeance?.montant_du !== undefined && (
                        <span className={styles.recentEmail}>
                          {" "}
                          / {formatCurrency(p.echeance.montant_du)} {t("bo.locatairePaiements.due")}
                        </span>
                      )}
                    </td>
                    <td>{MODE_PAIEMENT_LABELS[p.mode_paiement] || "—"}</td>
                    <td>{formatDate(p.date_paiement)}</td>
                    <td>
                      <span className={`${styles.badge} ${p.statut === PAIEMENT_STATUS.ANNULE ? styles.badgeDanger : styles.badgeActive}`}>
                        {PAIEMENT_STATUS_LABELS[p.statut] || "—"}
                      </span>
                    </td>
                    <td>
                      {quittance ? (
                        <button
                          type="button"
                          className={styles.btnOutline}
                          onClick={() => handleDownload(p)}
                          disabled={downloadingId === p.id}
                        >
                          <i className="bi bi-download" />
                          {downloadingId === p.id ? "..." : "PDF"}
                        </button>
                      ) : (
                        <span className={styles.empty}>—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {filteredPaiements.length > 0 && (
            <div className={styles.paginationRow}>
              <span>
                {t("bo.locatairePaiements.pageOf", { page: safePage, total: totalPages, count: filteredPaiements.length })}
              </span>
              <div className={styles.paginationButtons}>
                <button
                  type="button"
                  className={styles.btnOutline}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={safePage <= 1}
                >
                  <i className="bi bi-chevron-left" />
                  {t("bo.common.previous")}
                </button>
                <button
                  type="button"
                  className={styles.btnOutline}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={safePage >= totalPages}
                >
                  {t("bo.common.next")}
                  <i className="bi bi-chevron-right" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
