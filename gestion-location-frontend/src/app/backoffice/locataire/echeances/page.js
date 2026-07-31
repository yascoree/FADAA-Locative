"use client";

import { useEffect, useMemo, useState } from "react";
import { extractErrorMessage } from "@/lib/apiClient";
import { fetchEcheances, fetchBiens, ECHEANCE_STATUS, ECHEANCE_STATUS_LABELS } from "@/lib/properties";
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

function badgeClass(statut) {
  if (statut === ECHEANCE_STATUS.PAYE) return styles.badgeActive;
  if (statut === ECHEANCE_STATUS.PARTIEL) return styles.badgeWarning;
  return styles.badgeDanger;
}

function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

function formatCurrency(value) {
  if (value === null || value === undefined || value === "") return "—";
  return `${Number(value).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} MAD`;
}

function isOverdue(echeance) {
  if (echeance.statut === ECHEANCE_STATUS.PAYE || !echeance.date_echeance) return false;
  return new Date(echeance.date_echeance) < new Date(new Date().toDateString());
}

const STATUS_OPTIONS = Object.entries(ECHEANCE_STATUS_LABELS).map(([value, label]) => ({ value, label }));
const PAGE_SIZE = 10;

export default function LocataireEcheancesPage() {
  const { t } = useLanguage();
  const [echeances, setEcheances] = useState([]);
  const [biens, setBiens] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const [statusFilter, setStatusFilter] = useState("");
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [sortBy, setSortBy] = useState("recent");
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    async function init() {
      setIsLoading(true);
      try {
        const [echeancesList, biensList] = await Promise.all([fetchEcheances(), fetchBiens()]);
        setEcheances(echeancesList);
        setBiens(biensList);
      } catch (err) {
        setLoadError(extractErrorMessage(err));
      } finally {
        setIsLoading(false);
      }
    }
    init();
  }, []);

  const stats = useMemo(() => {
    return {
      total: echeances.length,
      payees: echeances.filter((e) => e.statut === ECHEANCE_STATUS.PAYE).length,
      partielles: echeances.filter((e) => e.statut === ECHEANCE_STATUS.PARTIEL).length,
      impayees: echeances.filter((e) => e.statut === ECHEANCE_STATUS.IMPAYE).length,
    };
  }, [echeances]);

  function bienLotLabel(echeance) {
    if (!echeance?.bail) return "—";
    const bien = biens.find((b) => b.id === echeance.bail.lot?.bien_id);
    const bienName = bien?.designation || `Bien #${echeance.bail.lot?.bien_id}`;
    return `${bienName} — ${echeance.bail.lot?.reference || `Lot #${echeance.bail.lot_id}`}`;
  }

  const filteredEcheances = useMemo(() => {
    const filtered = echeances.filter((e) => {
      if (statusFilter && String(e.statut) !== statusFilter) return false;
      if (overdueOnly && !isOverdue(e)) return false;
      return true;
    });
    return sortList(filtered, sortBy, { dateOf: (e) => e.date_echeance, nameOf: (e) => e.reference });
  }, [echeances, statusFilter, overdueOnly, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filteredEcheances.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedEcheances = filteredEcheances.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  if (isLoading) {
    return <p>{t("bo.common.loading")}</p>;
  }

  return (
    <div>
      <Banner banner={loadError ? { type: "error", message: loadError } : null} />

      {/* ---- Stats ---- */}
      <div className={styles.section}>
        <div className={styles.statsGrid}>
          <StatCard icon="bi-calendar-check-fill" tone="primary" label={t("bo.locataireEcheances.statTotal")} value={stats.total} />
          <StatCard icon="bi-check-circle-fill" tone="accent" label={t("bo.locataireEcheances.statPaid")} value={stats.payees} />
          <StatCard icon="bi-hourglass-split" tone="warning" label={t("bo.locataireEcheances.statPartial")} value={stats.partielles} />
          <StatCard icon="bi-exclamation-octagon-fill" tone="danger" label={t("bo.locataireEcheances.statUnpaid")} value={stats.impayees} />
        </div>
      </div>

      {/* ---- Table ---- */}
      <div className={styles.section} style={{ marginBottom: 0 }}>
        <div>
          <h2 className={styles.sectionTitle}>
            <i className="bi bi-table" style={{ marginRight: "0.5rem", color: "var(--primary)" }} />
            {t("bo.locataireEcheances.title")}
          </h2>
          <p className={styles.sectionSubtitle}>
            {t("bo.locataireEcheances.subtitle", { shown: filteredEcheances.length, total: echeances.length })}
          </p>
        </div>

        <div className={styles.filtersRow}>
          <FilterSelect
            value={statusFilter}
            onChange={(v) => {
              setStatusFilter(v);
              setCurrentPage(1);
            }}
            options={[{ value: "", label: t("bo.common.allStatuses") }, ...STATUS_OPTIONS]}
          />
          <FilterSelect value={sortBy} onChange={setSortBy} options={SORT_OPTIONS} />
          <FilterChip
            checked={overdueOnly}
            onChange={(checked) => {
              setOverdueOnly(checked);
              setCurrentPage(1);
            }}
          >
            {t("bo.common.overdueOnly")}
          </FilterChip>
        </div>

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>{t("bo.locataireEcheances.colRef")}</th>
                <th>{t("bo.locataireEcheances.colHome")}</th>
                <th>{t("bo.locataireEcheances.colDueDate")}</th>
                <th>{t("bo.locataireEcheances.colAmountDue")}</th>
                <th>{t("bo.locataireEcheances.colStatus")}</th>
              </tr>
            </thead>
            <tbody>
              {filteredEcheances.length === 0 && (
                <tr>
                  <td colSpan={5} className={styles.empty}>
                    {t("bo.common.noMatch")}
                  </td>
                </tr>
              )}
              {paginatedEcheances.map((e) => {
                const overdue = isOverdue(e);
                return (
                  <tr key={e.id}>
                    <td className={styles.mono}>{e.reference}</td>
                    <td>{bienLotLabel(e)}</td>
                    <td>
                      {formatDate(e.date_echeance)}
                      {overdue && (
                        <span
                          className={styles.badge}
                          style={{ marginLeft: "0.5rem", background: "var(--danger-soft)", color: "var(--danger)" }}
                        >
                          {t("bo.common.overdueBadge")}
                        </span>
                      )}
                    </td>
                    <td>{formatCurrency(e.montant_du)}</td>
                    <td>
                      <span className={`${styles.badge} ${badgeClass(e.statut)}`}>
                        {ECHEANCE_STATUS_LABELS[e.statut] || "—"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {filteredEcheances.length > 0 && (
            <div className={styles.paginationRow}>
              <span>
                {t("bo.locataireEcheances.pageOf", { page: safePage, total: totalPages, count: filteredEcheances.length })}
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
