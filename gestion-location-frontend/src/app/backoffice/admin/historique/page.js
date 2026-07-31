"use client";

import { useEffect, useMemo, useState } from "react";
import { extractErrorMessage } from "@/lib/apiClient";
import { fetchHistorique, HISTORIQUE_ACTIONS } from "@/lib/historique";
import { SORT_OPTIONS, sortList } from "@/lib/sort";
import StatCard from "@/components/StatCard";
import FilterSelect from "@/components/FilterSelect";
import styles from "../admin.module.css";

function Banner({ banner }) {
  if (!banner) return null;
  return (
    <div className={`${styles.banner} ${banner.type === "success" ? styles.bannerSuccess : styles.bannerError}`}>
      {banner.message}
    </div>
  );
}

const ACTION_LABELS = { CREATE: "Création", UPDATE: "Modification", DELETE: "Suppression", GET: "Consultation" };

function actionBadgeClass(action) {
  if (action === "CREATE") return styles.badgeActive;
  if (action === "UPDATE") return styles.badgeWarning;
  if (action === "DELETE") return styles.badgeDanger;
  return styles.badgeNeutral;
}

function elementCell(e) {
  if (e.element_id == null) return "—";
  if (e.element_label) return `${e.module} #${e.element_id} — ${e.element_label}`;
  return `${e.module} #${e.element_id}`;
}

function formatDateTime(value) {
  if (!value) return "—";
  return new Date(value).toLocaleString("fr-FR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

const PAGE_SIZE = 20;

export default function AdminHistoriquePage() {
  const [entries, setEntries] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const [search, setSearch] = useState("");
  const [moduleFilter, setModuleFilter] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [sortBy, setSortBy] = useState("recent");
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    async function init() {
      setIsLoading(true);
      try {
        const list = await fetchHistorique();
        setEntries(list);
      } catch (err) {
        setLoadError(extractErrorMessage(err));
      } finally {
        setIsLoading(false);
      }
    }
    init();
  }, []);

  const modules = useMemo(() => [...new Set(entries.map((e) => e.module))].sort(), [entries]);

  const stats = useMemo(() => {
    return {
      total: entries.length,
      creations: entries.filter((e) => e.action === "CREATE").length,
      modifications: entries.filter((e) => e.action === "UPDATE").length,
      suppressions: entries.filter((e) => e.action === "DELETE").length,
    };
  }, [entries]);

  const filteredEntries = useMemo(() => {
    const term = search.trim().toLowerCase();
    const filtered = entries.filter((e) => {
      if (term) {
        const haystack = [
          e.utilisateur?.prenom,
          e.utilisateur?.nom,
          e.utilisateur?.email,
          e.module,
          ACTION_LABELS[e.action] || e.action,
          elementCell(e),
        ]
          .filter((v) => v !== null && v !== undefined && v !== "")
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      if (moduleFilter && e.module !== moduleFilter) return false;
      if (actionFilter && e.action !== actionFilter) return false;
      return true;
    });
    return sortList(filtered, sortBy, {
      dateOf: (e) => e.created_at,
      nameOf: (e) => `${e.utilisateur?.prenom || ""} ${e.utilisateur?.nom || ""}`,
    });
  }, [entries, search, moduleFilter, actionFilter, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filteredEntries.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedEntries = filteredEntries.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  if (isLoading) {
    return <p>Chargement...</p>;
  }

  return (
    <div>
      <Banner banner={loadError ? { type: "error", message: loadError } : null} />

      {/* ---- Stats ---- */}
      <div className={styles.section}>
        <div className={styles.statsGrid}>
          <StatCard icon="bi-clock-history" tone="primary" label="Actions journalisées" value={stats.total} />
          <StatCard icon="bi-plus-circle-fill" tone="accent" label="Créations" value={stats.creations} />
          <StatCard icon="bi-pencil-fill" tone="warning" label="Modifications" value={stats.modifications} />
          <StatCard icon="bi-trash-fill" tone="danger" label="Suppressions" value={stats.suppressions} />
        </div>
      </div>

      {/* ---- Table ---- */}
      <div className={styles.section} style={{ marginBottom: 0 }}>
        <h2 className={styles.sectionTitle}>
          <i className="bi bi-table" style={{ marginRight: "0.5rem", color: "var(--primary)" }} />
          Journal d&apos;activité
        </h2>
        <p className={styles.sectionSubtitle}>
          {filteredEntries.length} action(s) affichée(s) sur {entries.length}. Consultations en liste et polling
          (notifications, discussions) exclus pour ne pas noyer le journal.
        </p>

        <div className={styles.filtersRow}>
          <input
            type="text"
            placeholder="Rechercher par utilisateur, module, élément..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCurrentPage(1);
            }}
          />
          <FilterSelect
            value={moduleFilter}
            onChange={(v) => {
              setModuleFilter(v);
              setCurrentPage(1);
            }}
            options={[{ value: "", label: "Tous les modules" }, ...modules.map((m) => ({ value: m, label: m }))]}
          />
          <FilterSelect
            value={actionFilter}
            onChange={(v) => {
              setActionFilter(v);
              setCurrentPage(1);
            }}
            options={[
              { value: "", label: "Toutes les actions" },
              ...HISTORIQUE_ACTIONS.map((a) => ({ value: a, label: ACTION_LABELS[a] || a })),
            ]}
          />
          <FilterSelect value={sortBy} onChange={setSortBy} options={SORT_OPTIONS} />
        </div>

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Date</th>
                <th>Utilisateur</th>
                <th>Module</th>
                <th>Action</th>
                <th>Élément</th>
              </tr>
            </thead>
            <tbody>
              {filteredEntries.length === 0 && (
                <tr>
                  <td colSpan={5} className={styles.empty}>
                    Aucune action ne correspond à ces critères.
                  </td>
                </tr>
              )}
              {paginatedEntries.map((e) => (
                <tr key={e.id}>
                  <td>{formatDateTime(e.created_at)}</td>
                  <td>
                    {e.utilisateur ? (
                      <div>
                        <div className={styles.userName}>
                          {e.utilisateur.prenom} {e.utilisateur.nom}
                        </div>
                        <div className={styles.recentEmail}>{e.utilisateur.email}</div>
                      </div>
                    ) : (
                      `Utilisateur #${e.user_id}`
                    )}
                  </td>
                  <td>{e.module}</td>
                  <td>
                    <span className={`${styles.badge} ${actionBadgeClass(e.action)}`}>
                      {ACTION_LABELS[e.action] || e.action}
                    </span>
                  </td>
                  <td>{elementCell(e)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredEntries.length > 0 && (
            <div className={styles.paginationRow}>
              <span>
                Page {safePage} / {totalPages} · {filteredEntries.length} action(s)
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
