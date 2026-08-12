"use client";

import { useEffect, useMemo, useState } from "react";
import { extractErrorMessage } from "@/lib/apiClient";
import { fetchHistorique, HISTORIQUE_ACTIONS } from "@/lib/historique";
import { SORT_OPTIONS, sortList } from "@/lib/sort";
import StatCard from "@/components/StatCard";
import FilterSelect from "@/components/FilterSelect";
import Drawer from "@/components/Drawer";
import { useLanguage } from "@/context/LanguageContext";
import styles from "../admin.module.css";

function formatValue(v) {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "true" : "false";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

// old_values/new_values sont des snapshots complets de la ressource (voir
// HistoriqueMiddleware._serialize_row), pas seulement les champs modifiés —
// on ne garde donc que les clés dont la valeur diffère réellement entre les
// deux snapshots pour un diff lisible, plutôt que d'afficher chaque colonne
// inchangée de la table.
function diffKeys(oldValues, newValues) {
  const keys = new Set([...Object.keys(oldValues || {}), ...Object.keys(newValues || {})]);
  return [...keys].filter((k) => JSON.stringify(oldValues?.[k]) !== JSON.stringify(newValues?.[k])).sort();
}

function Banner({ banner }) {
  if (!banner) return null;
  return (
    <div className={`${styles.banner} ${banner.type === "success" ? styles.bannerSuccess : styles.bannerError}`}>
      {banner.message}
    </div>
  );
}

function actionLabels(t) {
  return {
    CREATE: t("bo.adminHistorique.actionCreate"),
    UPDATE: t("bo.adminHistorique.actionUpdate"),
    DELETE: t("bo.adminHistorique.actionDelete"),
    GET: t("bo.adminHistorique.actionGet"),
  };
}

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
  const { t } = useLanguage();
  const ACTION_LABELS = useMemo(() => actionLabels(t), [t]);
  const [entries, setEntries] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const [search, setSearch] = useState("");
  const [moduleFilter, setModuleFilter] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [sortBy, setSortBy] = useState("recent");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedEntry, setSelectedEntry] = useState(null);

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
  }, [entries, search, moduleFilter, actionFilter, sortBy, ACTION_LABELS]);

  const totalPages = Math.max(1, Math.ceil(filteredEntries.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedEntries = filteredEntries.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  if (isLoading) {
    return <p>{t("bo.adminHistorique.loading")}</p>;
  }

  return (
    <div>
      <Banner banner={loadError ? { type: "error", message: loadError } : null} />

      {/* ---- Stats ---- */}
      <div className={styles.section}>
        <div className={styles.statsGrid}>
          <StatCard icon="bi-clock-history" tone="primary" label={t("bo.adminHistorique.statTotal")} value={stats.total} />
          <StatCard icon="bi-plus-circle-fill" tone="accent" label={t("bo.adminHistorique.statCreations")} value={stats.creations} />
          <StatCard icon="bi-pencil-fill" tone="warning" label={t("bo.adminHistorique.statModifications")} value={stats.modifications} />
          <StatCard icon="bi-trash-fill" tone="danger" label={t("bo.adminHistorique.statDeletions")} value={stats.suppressions} />
        </div>
      </div>

      {/* ---- Table ---- */}
      <div className={styles.section} style={{ marginBottom: 0 }}>
        <h2 className={styles.sectionTitle}>
          <i className="bi bi-table" style={{ marginRight: "0.5rem", color: "var(--primary)" }} />
          {t("bo.adminHistorique.title")}
        </h2>
        <p className={styles.sectionSubtitle}>
          {t("bo.adminHistorique.subtitle", { shown: filteredEntries.length, total: entries.length })}
        </p>

        <div className={styles.filtersRow}>
          <input
            type="text"
            placeholder={t("bo.adminHistorique.searchPlaceholder")}
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
            options={[{ value: "", label: t("bo.adminHistorique.allModules") }, ...modules.map((m) => ({ value: m, label: m }))]}
          />
          <FilterSelect
            value={actionFilter}
            onChange={(v) => {
              setActionFilter(v);
              setCurrentPage(1);
            }}
            options={[
              { value: "", label: t("bo.adminHistorique.allActions") },
              ...HISTORIQUE_ACTIONS.map((a) => ({ value: a, label: ACTION_LABELS[a] || a })),
            ]}
          />
          <FilterSelect value={sortBy} onChange={setSortBy} options={SORT_OPTIONS} />
        </div>

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>{t("bo.adminHistorique.colDate")}</th>
                <th>{t("bo.adminHistorique.colUser")}</th>
                <th>{t("bo.adminHistorique.colModule")}</th>
                <th>{t("bo.adminHistorique.colAction")}</th>
                <th>{t("bo.adminHistorique.colElement")}</th>
              </tr>
            </thead>
            <tbody>
              {filteredEntries.length === 0 && (
                <tr>
                  <td colSpan={5} className={styles.empty}>
                    {t("bo.adminHistorique.noMatch")}
                  </td>
                </tr>
              )}
              {paginatedEntries.map((e) => (
                <tr key={e.id} className={styles.tableRowClickable} onClick={() => setSelectedEntry(e)}>
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
                      t("bo.adminHistorique.unknownUser", { id: e.user_id })
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
                {t("bo.adminHistorique.pageOf", { page: safePage, total: totalPages, count: filteredEntries.length })}
              </span>
              <div className={styles.paginationButtons}>
                <button
                  type="button"
                  className={styles.btnOutline}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={safePage <= 1}
                >
                  <i className="bi bi-chevron-left" />
                  {t("bo.adminHistorique.previous")}
                </button>
                <button
                  type="button"
                  className={styles.btnOutline}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={safePage >= totalPages}
                >
                  {t("bo.adminHistorique.next")}
                  <i className="bi bi-chevron-right" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ---- Détail d'une entrée (diff avant/après) ---- */}
      <Drawer
        isOpen={!!selectedEntry}
        onClose={() => setSelectedEntry(null)}
        title={selectedEntry ? `${ACTION_LABELS[selectedEntry.action] || selectedEntry.action} — ${elementCell(selectedEntry)}` : ""}
      >
        {selectedEntry && (
          <>
            <div className={styles.detailInfoList}>
              <div className={styles.detailInfoRow}>
                <span className={styles.detailInfoIcon}>
                  <i className="bi bi-calendar-event" />
                </span>
                <span className={styles.detailInfoBody}>
                  <span className={styles.detailInfoLabel}>{t("bo.adminHistorique.colDate")}</span>
                  <span className={styles.detailInfoValue}>{formatDateTime(selectedEntry.created_at)}</span>
                </span>
              </div>
              <div className={styles.detailInfoRow}>
                <span className={styles.detailInfoIcon}>
                  <i className="bi bi-person" />
                </span>
                <span className={styles.detailInfoBody}>
                  <span className={styles.detailInfoLabel}>{t("bo.adminHistorique.colUser")}</span>
                  <span className={styles.detailInfoValue}>
                    {selectedEntry.utilisateur
                      ? `${selectedEntry.utilisateur.prenom} ${selectedEntry.utilisateur.nom} (${selectedEntry.utilisateur.email})`
                      : t("bo.adminHistorique.unknownUser", { id: selectedEntry.user_id })}
                  </span>
                </span>
              </div>
              <div className={styles.detailInfoRow}>
                <span className={styles.detailInfoIcon}>
                  <i className="bi bi-diagram-3" />
                </span>
                <span className={styles.detailInfoBody}>
                  <span className={styles.detailInfoLabel}>{t("bo.adminHistorique.colModule")}</span>
                  <span className={styles.detailInfoValue}>{selectedEntry.module}</span>
                </span>
              </div>
            </div>

            {(() => {
              const { old_values: oldValues, new_values: newValues, action } = selectedEntry;
              if (!oldValues && !newValues) {
                return <p className={styles.diffEmpty}>{t("bo.adminHistorique.noDetails")}</p>;
              }
              if (oldValues && newValues) {
                const keys = diffKeys(oldValues, newValues);
                if (keys.length === 0) {
                  return <p className={styles.diffEmpty}>{t("bo.adminHistorique.noChanges")}</p>;
                }
                return (
                  <div className={styles.diffBox}>
                    <div className={styles.diffTitle}>
                      <i className="bi bi-arrow-left-right" />
                      {t("bo.adminHistorique.changesTitle")}
                    </div>
                    {keys.map((k) => (
                      <div className={styles.diffRow} key={k}>
                        <span className={styles.diffLabel}>{k}</span>
                        <span className={styles.diffBefore}>{formatValue(oldValues[k])}</span>
                        <i className="bi bi-arrow-right" />
                        <span className={styles.diffAfter}>{formatValue(newValues[k])}</span>
                      </div>
                    ))}
                  </div>
                );
              }
              const snapshot = newValues || oldValues;
              const snapshotTitle =
                action === "DELETE" ? t("bo.adminHistorique.deletedValues") : t("bo.adminHistorique.createdValues");
              return (
                <div className={styles.diffBox}>
                  <div className={styles.diffTitle}>
                    <i className="bi bi-list-ul" />
                    {snapshotTitle}
                  </div>
                  {Object.entries(snapshot)
                    .filter(([k]) => k !== "id")
                    .map(([k, v]) => (
                      <div className={styles.diffRow} key={k}>
                        <span className={styles.diffLabel}>{k}</span>
                        <span className={styles.diffAfter}>{formatValue(v)}</span>
                      </div>
                    ))}
                </div>
              );
            })()}
          </>
        )}
      </Drawer>
    </div>
  );
}
