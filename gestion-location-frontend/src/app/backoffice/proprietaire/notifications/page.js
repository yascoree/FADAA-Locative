"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { extractErrorMessage } from "@/lib/apiClient";
import {
  fetchNotifications,
  markNotificationRead,
  masquerNotification,
  restaurerNotification,
  NOTIFICATION_STATUS,
  NOTIFICATION_TYPE,
  NOTIFICATION_TYPE_LABELS,
} from "@/lib/notifications";
import { SORT_OPTIONS, sortList } from "@/lib/sort";
import StatCard from "@/components/StatCard";
import ToggleSwitch from "@/components/ToggleSwitch";
import FilterSelect from "@/components/FilterSelect";
import { useLanguage } from "@/context/LanguageContext";
import styles from "../proprietaire.module.css";

function Banner({ banner }) {
  if (!banner) return null;
  return (
    <div className={`${styles.banner} ${banner.type === "success" ? styles.bannerSuccess : styles.bannerError}`}>
      {banner.message}
    </div>
  );
}

const TYPE_ICON = {
  [NOTIFICATION_TYPE.PAIEMENT]: "bi-cash-stack",
  [NOTIFICATION_TYPE.ECHEANCE]: "bi-calendar-check-fill",
  [NOTIFICATION_TYPE.BAIL]: "bi-file-earmark-text-fill",
  [NOTIFICATION_TYPE.MANDAT]: "bi-person-badge-fill",
  [NOTIFICATION_TYPE.DISCUSSION]: "bi-chat-dots-fill",
  [NOTIFICATION_TYPE.RELANCE]: "bi-exclamation-octagon-fill",
  [NOTIFICATION_TYPE.GESTION]: "bi-person-gear",
  [NOTIFICATION_TYPE.PLAN_CHANGE_REQUEST]: "bi-arrow-repeat",
  [NOTIFICATION_TYPE.ABONNEMENT]: "bi-credit-card-2-front-fill",
  [NOTIFICATION_TYPE.MAINTENANCE]: "bi-tools",
};

const TYPE_TONE_CLASS = {
  [NOTIFICATION_TYPE.PAIEMENT]: "notifIconAccent",
  [NOTIFICATION_TYPE.ECHEANCE]: "notifIconPrimary",
  [NOTIFICATION_TYPE.BAIL]: "notifIconPrimary",
  [NOTIFICATION_TYPE.MANDAT]: "notifIconAccent",
  [NOTIFICATION_TYPE.DISCUSSION]: "notifIconPrimary",
  [NOTIFICATION_TYPE.RELANCE]: "notifIconDanger",
  [NOTIFICATION_TYPE.GESTION]: "notifIconAccent",
  [NOTIFICATION_TYPE.PLAN_CHANGE_REQUEST]: "notifIconPrimary",
  [NOTIFICATION_TYPE.ABONNEMENT]: "notifIconDanger",
  [NOTIFICATION_TYPE.MAINTENANCE]: "notifIconDanger",
};

const TYPE_TARGET = {
  [NOTIFICATION_TYPE.PAIEMENT]: "/backoffice/proprietaire/paiements",
  [NOTIFICATION_TYPE.ECHEANCE]: "/backoffice/proprietaire/echeances",
  [NOTIFICATION_TYPE.BAIL]: "/backoffice/proprietaire/baux",
  [NOTIFICATION_TYPE.MANDAT]: "/backoffice/proprietaire/permissions",
  [NOTIFICATION_TYPE.DISCUSSION]: "/backoffice/proprietaire/messagerie",
  [NOTIFICATION_TYPE.RELANCE]: "/backoffice/proprietaire/echeances",
  [NOTIFICATION_TYPE.GESTION]: "/backoffice/proprietaire/biens",
  [NOTIFICATION_TYPE.PLAN_CHANGE_REQUEST]: "/backoffice/proprietaire/abonnement",
  [NOTIFICATION_TYPE.ABONNEMENT]: "/backoffice/proprietaire/abonnement",
  [NOTIFICATION_TYPE.MAINTENANCE]: "/backoffice/proprietaire/maintenance",
};

const TYPE_OPTIONS = Object.entries(NOTIFICATION_TYPE_LABELS).map(([value, label]) => ({ value, label }));

function formatDate(value, t) {
  const date = new Date(value);
  const now = new Date();
  const diffMs = now - date;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return t("bo.proprietaireNotifications.timeJustNow");
  if (diffMin < 60) return t("bo.proprietaireNotifications.timeMinutesAgo", { count: diffMin });
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return t("bo.proprietaireNotifications.timeHoursAgo", { count: diffH });
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return t("bo.proprietaireNotifications.timeDaysAgo", { count: diffD });
  return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

export default function ProprietaireNotificationsPage() {
  const { t } = useLanguage();
  const [notifications, setNotifications] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [actionBanner, setActionBanner] = useState(null);

  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sortBy, setSortBy] = useState("recent");
  const [markingAll, setMarkingAll] = useState(false);
  const [showMasquees, setShowMasquees] = useState(false);

  useEffect(() => {
    async function init() {
      setIsLoading(true);
      try {
        const list = await fetchNotifications({ masquees: showMasquees });
        setNotifications(list);
      } catch (err) {
        setLoadError(extractErrorMessage(err));
      } finally {
        setIsLoading(false);
      }
    }
    init();
  }, [showMasquees]);

  const stats = useMemo(() => {
    return {
      total: notifications.length,
      nonLues: notifications.filter((n) => n.statut === NOTIFICATION_STATUS.NON_LUE).length,
    };
  }, [notifications]);

  const filteredNotifications = useMemo(() => {
    const filtered = notifications.filter((n) => {
      if (typeFilter && String(n.type) !== typeFilter) return false;
      if (statusFilter && String(n.statut) !== statusFilter) return false;
      return true;
    });
    return sortList(filtered, sortBy, {
      dateOf: (n) => n.date_creation,
      nameOf: (n) => n.titre || NOTIFICATION_TYPE_LABELS[n.type] || "",
    });
  }, [notifications, typeFilter, statusFilter, sortBy]);

  async function handleMarkRead(notification) {
    if (notification.statut === NOTIFICATION_STATUS.LUE) return;
    try {
      const updated = await markNotificationRead(notification.id);
      setNotifications((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));
    } catch {
      // Best-effort : la navigation ne doit pas être bloquée par un échec de marquage.
    }
  }

  async function handleMarkAllRead() {
    const unread = notifications.filter((n) => n.statut === NOTIFICATION_STATUS.NON_LUE);
    if (unread.length === 0) return;
    setMarkingAll(true);
    setActionBanner(null);
    try {
      const updated = await Promise.all(unread.map((n) => markNotificationRead(n.id)));
      const updatedMap = new Map(updated.map((n) => [n.id, n]));
      setNotifications((prev) => prev.map((n) => updatedMap.get(n.id) || n));
    } catch (err) {
      setActionBanner({ type: "error", message: extractErrorMessage(err) });
    } finally {
      setMarkingAll(false);
    }
  }

  async function handleMasquer(notification) {
    try {
      await masquerNotification(notification.id);
      setNotifications((prev) => prev.filter((n) => n.id !== notification.id));
    } catch (err) {
      setActionBanner({ type: "error", message: extractErrorMessage(err) });
    }
  }

  async function handleRestaurer(notification) {
    try {
      await restaurerNotification(notification.id);
      setNotifications((prev) => prev.filter((n) => n.id !== notification.id));
    } catch (err) {
      setActionBanner({ type: "error", message: extractErrorMessage(err) });
    }
  }

  if (isLoading) {
    return <p>{t("bo.common.loading")}</p>;
  }

  return (
    <div>
      <Banner banner={loadError ? { type: "error", message: loadError } : null} />
      <Banner banner={actionBanner} />

      {/* ---- Stats ---- */}
      <div className={styles.section}>
        <div className={styles.statsGrid}>
          <StatCard icon="bi-bell-fill" tone="primary" label={t("bo.proprietaireNotifications.statTotal")} value={stats.total} />
          <StatCard icon="bi-envelope-fill" tone="accent" label={t("bo.proprietaireNotifications.statUnread")} value={stats.nonLues} />
        </div>
      </div>

      {/* ---- Liste ---- */}
      <div className={styles.section} style={{ marginBottom: 0 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem" }}>
          <div>
            <h2 className={styles.sectionTitle}>
              <i className="bi bi-bell" style={{ marginRight: "0.5rem", color: "var(--primary)" }} />
              {showMasquees ? t("bo.proprietaireNotifications.titleHidden") : t("bo.proprietaireNotifications.title")}
            </h2>
            <p className={styles.sectionSubtitle}>
              {t("bo.proprietaireNotifications.subtitle", { shown: filteredNotifications.length, total: notifications.length })}
            </p>
          </div>
          {!showMasquees && (
            <button
              type="button"
              className={styles.btnOutline}
              onClick={handleMarkAllRead}
              disabled={markingAll || stats.nonLues === 0}
            >
              <i className="bi bi-check2-all" />
              {markingAll ? "..." : t("bo.proprietaireNotifications.markAllRead")}
            </button>
          )}
        </div>

        <div className={styles.filtersRow}>
          <ToggleSwitch checked={showMasquees} onChange={setShowMasquees} label={t("bo.proprietaireNotifications.showHidden")} />
          <FilterSelect
            value={typeFilter}
            onChange={setTypeFilter}
            options={[{ value: "", label: t("bo.proprietaireNotifications.allTypes") }, ...TYPE_OPTIONS]}
          />
          <FilterSelect
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              { value: "", label: t("bo.proprietaireNotifications.allStatuses") },
              { value: NOTIFICATION_STATUS.NON_LUE, label: t("bo.proprietaireNotifications.unreadOnly") },
              { value: NOTIFICATION_STATUS.LUE, label: t("bo.proprietaireNotifications.readOnly") },
            ]}
          />
          <FilterSelect value={sortBy} onChange={setSortBy} options={SORT_OPTIONS} />
        </div>

        <div className={styles.card} style={{ padding: 0 }}>
          <div className={styles.notifList}>
            {filteredNotifications.length === 0 && (
              <p className={styles.empty} style={{ padding: "1.5rem" }}>
                {t("bo.proprietaireNotifications.noMatch")}
              </p>
            )}
            {filteredNotifications.map((n) => {
              const isUnread = n.statut === NOTIFICATION_STATUS.NON_LUE;
              const target = TYPE_TARGET[n.type] || "#";
              return (
                <Link
                  key={n.id}
                  href={target}
                  className={`${styles.notifItem} ${isUnread ? styles.notifItemUnread : ""}`}
                  onClick={() => handleMarkRead(n)}
                >
                  <span className={`${styles.notifIcon} ${styles[TYPE_TONE_CLASS[n.type]] || styles.notifIconPrimary}`}>
                    <i className={`bi ${TYPE_ICON[n.type] || "bi-bell"}`} />
                  </span>
                  <div className={styles.notifBody}>
                    <div className={styles.notifTop}>
                      <span className={styles.notifTitle}>{n.titre || NOTIFICATION_TYPE_LABELS[n.type] || t("bo.proprietaireNotifications.notification")}</span>
                      <span className={styles.notifDate}>{formatDate(n.date_creation, t)}</span>
                    </div>
                    {n.description && <div className={styles.notifDesc}>{n.description}</div>}
                  </div>
                  {isUnread && <span className={styles.notifDot} title={t("bo.proprietaireNotifications.unreadTitle")} />}
                  <div className={styles.notifActions}>
                    {showMasquees ? (
                      <button
                        type="button"
                        className={styles.iconBtn}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleRestaurer(n);
                        }}
                        title={t("bo.proprietaireNotifications.restore")}
                      >
                        <i className="bi bi-arrow-counterclockwise" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        className={styles.iconBtn}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleMasquer(n);
                        }}
                        title={t("bo.proprietaireNotifications.hide")}
                      >
                        <i className="bi bi-eye-slash" />
                      </button>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
