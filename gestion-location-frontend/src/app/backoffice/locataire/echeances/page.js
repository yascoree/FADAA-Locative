"use client";

import { useEffect, useMemo, useState } from "react";
import { extractErrorMessage } from "@/lib/apiClient";
import { fetchEcheances, fetchBiens, ECHEANCE_STATUS, ECHEANCE_STATUS_LABELS } from "@/lib/properties";
import { SORT_OPTIONS, sortList } from "@/lib/sort";
import StatCard from "@/components/StatCard";
import FilterChip from "@/components/FilterChip";
import FilterSelect from "@/components/FilterSelect";
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
    return <p>Chargement...</p>;
  }

  return (
    <div>
      <Banner banner={loadError ? { type: "error", message: loadError } : null} />

      {/* ---- Stats ---- */}
      <div className={styles.section}>
        <div className={styles.statsGrid}>
          <StatCard icon="bi-calendar-check-fill" tone="primary" label="Échéances" value={stats.total} />
          <StatCard icon="bi-check-circle-fill" tone="accent" label="Payées" value={stats.payees} />
          <StatCard icon="bi-hourglass-split" tone="warning" label="Partielles" value={stats.partielles} />
          <StatCard icon="bi-exclamation-octagon-fill" tone="danger" label="Impayées" value={stats.impayees} />
        </div>
      </div>

      {/* ---- Table ---- */}
      <div className={styles.section} style={{ marginBottom: 0 }}>
        <div>
          <h2 className={styles.sectionTitle}>
            <i className="bi bi-table" style={{ marginRight: "0.5rem", color: "var(--primary)" }} />
            Mes échéances
          </h2>
          <p className={styles.sectionSubtitle}>
            {filteredEcheances.length} échéance(s) affichée(s) sur {echeances.length}, générées automatiquement à la
            création de votre bail.
          </p>
        </div>

        <div className={styles.filtersRow}>
          <FilterSelect
            value={statusFilter}
            onChange={(v) => {
              setStatusFilter(v);
              setCurrentPage(1);
            }}
            options={[{ value: "", label: "Tous les statuts" }, ...STATUS_OPTIONS]}
          />
          <FilterChip
            checked={overdueOnly}
            onChange={(checked) => {
              setOverdueOnly(checked);
              setCurrentPage(1);
            }}
          >
            En retard uniquement
          </FilterChip>
          <FilterSelect value={sortBy} onChange={setSortBy} options={SORT_OPTIONS} />
        </div>

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Référence</th>
                <th>Logement</th>
                <th>Date d&apos;échéance</th>
                <th>Montant dû</th>
                <th>Statut</th>
              </tr>
            </thead>
            <tbody>
              {filteredEcheances.length === 0 && (
                <tr>
                  <td colSpan={5} className={styles.empty}>
                    Aucune échéance ne correspond à ces critères.
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
                          En retard
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
                Page {safePage} / {totalPages} · {filteredEcheances.length} échéance(s)
              </span>
              <div className={styles.paginationButtons}>
                <button
                  type="button"
                  className={styles.btnOutline}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={safePage <= 1}
                >
                  <i className="bi bi-chevron-left" />
                  Précédent
                </button>
                <button
                  type="button"
                  className={styles.btnOutline}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={safePage >= totalPages}
                >
                  Suivant
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
