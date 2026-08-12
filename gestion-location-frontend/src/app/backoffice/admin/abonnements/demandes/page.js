"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { extractErrorMessage } from "@/lib/apiClient";
import {
  PLAN_CHANGE_REQUEST_STATUS,
  PLAN_CHANGE_REQUEST_STATUS_LABELS,
  fetchPlanChangeRequests,
  approvePlanChangeRequest,
  rejectPlanChangeRequest,
  capitalizeTone,
} from "@/lib/subscriptions";
import StatCard from "@/components/StatCard";
import CountUp from "@/components/CountUp";
import { useLanguage } from "@/context/LanguageContext";
import styles from "../../admin.module.css";

function Banner({ banner }) {
  if (!banner) return null;
  return (
    <div className={`${styles.banner} ${banner.type === "success" ? styles.bannerSuccess : styles.bannerError}`}>
      {banner.message}
    </div>
  );
}

function statusBadgeClass(statut) {
  if (statut === PLAN_CHANGE_REQUEST_STATUS.APPROUVEE) return styles.badgeActive;
  if (statut === PLAN_CHANGE_REQUEST_STATUS.REJETEE) return styles.badgeCancelled;
  return styles.badgeSuspended;
}

function cardStatusClass(statut) {
  if (statut === PLAN_CHANGE_REQUEST_STATUS.APPROUVEE) return styles.requestCardApproved;
  if (statut === PLAN_CHANGE_REQUEST_STATUS.REJETEE) return styles.requestCardRejected;
  return styles.requestCardPending;
}

// "il y a X min/h/j" — plus vivant qu'une date brute pour un flux de demandes
// qu'un admin consulte au fil de l'eau.
function timeAgo(value, t) {
  if (!value) return "—";
  const diffMs = Date.now() - new Date(value).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return t("bo.adminAbonnementsDemandes.timeAgoNow");
  if (minutes < 60) return t("bo.adminAbonnementsDemandes.timeAgoMinutes", { count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t("bo.adminAbonnementsDemandes.timeAgoHours", { count: hours });
  const days = Math.floor(hours / 24);
  if (days < 30) return t("bo.adminAbonnementsDemandes.timeAgoDays", { count: days });
  return new Date(value).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

function buildFilters(t) {
  return [
    { value: "all", label: t("bo.adminAbonnementsDemandes.filterAll") },
    { value: PLAN_CHANGE_REQUEST_STATUS.EN_ATTENTE, label: t("bo.adminAbonnementsDemandes.filterPending") },
    { value: PLAN_CHANGE_REQUEST_STATUS.APPROUVEE, label: t("bo.adminAbonnementsDemandes.filterApproved") },
    { value: PLAN_CHANGE_REQUEST_STATUS.REJETEE, label: t("bo.adminAbonnementsDemandes.filterRejected") },
  ];
}

export default function AdminPlanRequestsPage() {
  const { t } = useLanguage();
  const FILTERS = useMemo(() => buildFilters(t), [t]);
  const [requests, setRequests] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [banner, setBanner] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [filter, setFilter] = useState("all");
  const tabRefs = useRef([]);
  const [indicator, setIndicator] = useState({ left: 0, width: 0 });

  useEffect(() => {
    async function init() {
      setIsLoading(true);
      try {
        setRequests(await fetchPlanChangeRequests());
      } catch (err) {
        setLoadError(extractErrorMessage(err));
      } finally {
        setIsLoading(false);
      }
    }
    init();
  }, []);

  const counts = useMemo(() => {
    const pending = requests.filter((r) => r.statut === PLAN_CHANGE_REQUEST_STATUS.EN_ATTENTE).length;
    const approved = requests.filter((r) => r.statut === PLAN_CHANGE_REQUEST_STATUS.APPROUVEE).length;
    const rejected = requests.filter((r) => r.statut === PLAN_CHANGE_REQUEST_STATUS.REJETEE).length;
    return { pending, approved, rejected, total: requests.length };
  }, [requests]);

  const filteredRequests = useMemo(() => {
    if (filter === "all") return requests;
    return requests.filter((r) => r.statut === filter);
  }, [requests, filter]);

  // Pilule glissante derrière l'onglet actif — mesurée sur le DOM plutôt que
  // via un simple translateX(100%) puisque les onglets n'ont pas tous la même
  // largeur (le badge de "En attente" varie). Se recalcule aussi quand ce
  // badge apparaît/disparaît, pas seulement au changement d'onglet.
  useEffect(() => {
    // isLoading est nécessaire ici : tant que la page charge, les onglets ne sont
    // pas encore montés (tabRefs.current est vide). Si filter/counts.pending/FILTERS
    // n'ont par ailleurs pas changé entre le rendu "chargement" et le rendu final
    // (ex: aucune demande en attente, donc counts.pending reste à 0 avant/après),
    // cet effet ne se redéclencherait jamais une fois les onglets réellement présents
    // dans le DOM — l'indicateur resterait figé à sa valeur initiale {left:0,width:0}.
    const activeIndex = FILTERS.findIndex((f) => f.value === filter);
    const el = tabRefs.current[activeIndex];
    if (el) {
      setIndicator({ left: el.offsetLeft, width: el.offsetWidth });
    }
  }, [filter, counts.pending, FILTERS, isLoading]);

  async function handleApprove(request) {
    setBanner(null);
    setBusyId(request.id);
    try {
      const updated = await approvePlanChangeRequest(request.id);
      setRequests((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      setBanner({
        type: "success",
        message: t("bo.adminAbonnementsDemandes.approveSuccess", {
          plan: updated.plan.name,
          prenom: updated.owner.prenom,
          nom: updated.owner.nom,
        }),
      });
    } catch (err) {
      setBanner({ type: "error", message: extractErrorMessage(err) });
    } finally {
      setBusyId(null);
    }
  }

  async function handleReject(request) {
    setBanner(null);
    setBusyId(request.id);
    try {
      const updated = await rejectPlanChangeRequest(request.id);
      setRequests((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      setBanner({ type: "success", message: t("bo.adminAbonnementsDemandes.rejectSuccess") });
    } catch (err) {
      setBanner({ type: "error", message: extractErrorMessage(err) });
    } finally {
      setBusyId(null);
    }
  }

  if (isLoading) {
    return <p>{t("bo.adminAbonnementsDemandes.loading")}</p>;
  }

  return (
    <div>
      <div className={styles.requestsPageHeader}>
        <Link href="/backoffice/admin/abonnements" className={styles.backLink}>
          <span className={styles.backLinkIcon}>
            <i className="bi bi-arrow-left" />
          </span>
          {t("bo.adminAbonnementsDemandes.backLink")}
        </Link>
        <h2 className={styles.requestsPageTitle}>
          <i className="bi bi-inbox-fill" />
          {t("bo.adminAbonnementsDemandes.pageTitle")}
        </h2>
        <p className={styles.requestsPageSubtitle}>
          {t("bo.adminAbonnementsDemandes.pageSubtitle")}
        </p>
      </div>

      <Banner banner={loadError ? { type: "error", message: loadError } : null} />
      <Banner banner={banner} />

      <div className={styles.section}>
        <div className={styles.statsGrid}>
          <StatCard icon="bi-hourglass-split" tone="warning" label={t("bo.adminAbonnementsDemandes.statPending")} value={<CountUp value={counts.pending} />} />
          <StatCard icon="bi-check-circle-fill" tone="accent" label={t("bo.adminAbonnementsDemandes.statApproved")} value={<CountUp value={counts.approved} />} />
          <StatCard icon="bi-x-circle-fill" tone="danger" label={t("bo.adminAbonnementsDemandes.statRejected")} value={<CountUp value={counts.rejected} />} />
          <StatCard icon="bi-collection-fill" tone="primary" label={t("bo.adminAbonnementsDemandes.statTotal")} value={<CountUp value={counts.total} />} />
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.requestFilterTabs} role="tablist" aria-label={t("bo.adminAbonnementsDemandes.filterAriaLabel")}>
          <span
            className={styles.requestFilterIndicator}
            style={{ transform: `translateX(${indicator.left}px)`, width: indicator.width }}
            aria-hidden="true"
          />
          {FILTERS.map((f, i) => (
            <button
              key={f.value}
              ref={(el) => {
                tabRefs.current[i] = el;
              }}
              type="button"
              role="tab"
              aria-selected={filter === f.value}
              className={`${styles.requestFilterTab} ${filter === f.value ? styles.requestFilterTabActive : ""}`}
              onClick={() => setFilter(f.value)}
            >
              {f.label}
              {f.value === PLAN_CHANGE_REQUEST_STATUS.EN_ATTENTE && counts.pending > 0 && (
                <span className={styles.requestFilterTabBadge}>{counts.pending}</span>
              )}
            </button>
          ))}
        </div>

        {filteredRequests.length === 0 && (
          <p className={styles.empty}>
            <i className="bi bi-inbox" style={{ display: "block", fontSize: "1.6rem", marginBottom: "0.5rem" }} />
            {filter === "all"
              ? t("bo.adminAbonnementsDemandes.emptyAll")
              : t("bo.adminAbonnementsDemandes.emptyFiltered")}
          </p>
        )}

        <div className={styles.requestFeed}>
          {filteredRequests.map((request, index) => {
            const isPending = request.statut === PLAN_CHANGE_REQUEST_STATUS.EN_ATTENTE;
            const isBusy = busyId === request.id;
            const tone = capitalizeTone(request.plan?.color);
            const initials =
              `${request.owner?.prenom?.[0] || ""}${request.owner?.nom?.[0] || ""}`.toUpperCase() || "?";
            return (
              <div
                key={request.id}
                style={{ "--i": index }}
                className={`${styles.requestCard} ${cardStatusClass(request.statut)}`}
              >
                <span className={styles.requestAvatar}>{initials}</span>

                <div className={styles.requestBody}>
                  <div className={styles.requestTopRow}>
                    <span className={styles.requestOwnerName}>
                      {request.owner?.prenom} {request.owner?.nom}
                    </span>
                    <span className={`${styles.planPill} ${styles[`planPill${tone}`]}`}>{request.plan?.name}</span>
                    <span className={`${styles.badge} ${statusBadgeClass(request.statut)}`}>
                      {PLAN_CHANGE_REQUEST_STATUS_LABELS[request.statut]}
                    </span>
                  </div>
                  <div className={styles.requestMetaRow}>
                    <span>
                      <i className="bi bi-envelope" /> {request.owner?.email}
                    </span>
                    <span className={styles.requestDot}>•</span>
                    <span>
                      <i className="bi bi-clock-history" /> {timeAgo(request.date_creation, t)}
                    </span>
                  </div>
                  {request.message && <p className={styles.requestMessage}>&laquo; {request.message} &raquo;</p>}
                </div>

                <div className={styles.requestActions}>
                  {isPending ? (
                    <>
                      <button
                        type="button"
                        className={styles.requestApproveBtn}
                        onClick={() => handleApprove(request)}
                        disabled={isBusy}
                        title={t("bo.adminAbonnementsDemandes.approveTitle")}
                      >
                        <i className="bi bi-check-lg" />
                        {t("bo.adminAbonnementsDemandes.approve")}
                      </button>
                      <button
                        type="button"
                        className={styles.requestRejectBtn}
                        onClick={() => handleReject(request)}
                        disabled={isBusy}
                        title={t("bo.adminAbonnementsDemandes.rejectTitle")}
                      >
                        <i className="bi bi-x-lg" />
                      </button>
                    </>
                  ) : (
                    <span className={styles.requestDoneTag}>
                      <i className={`bi ${request.statut === PLAN_CHANGE_REQUEST_STATUS.APPROUVEE ? "bi-check-circle" : "bi-x-circle"}`} />
                      {t("bo.adminAbonnementsDemandes.done")}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
