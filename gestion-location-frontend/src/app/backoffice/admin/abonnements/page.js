"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { extractErrorMessage, API_BASE_URL } from "@/lib/apiClient";
import {
  SUBSCRIPTION_STATUS,
  SUBSCRIPTION_STATUS_LABELS,
  PLAN_CHANGE_REQUEST_STATUS,
  UNLIMITED,
  LIMIT_FIELDS,
  LIMIT_TO_USAGE_KEY,
  PLAN_COLOR_OPTIONS,
  formatLimit,
  capitalizeTone,
  billingLabel,
  priceUnit,
  planIcon,
  fetchUsers,
  fetchPlans,
  fetchSubscriptions,
  fetchOwnerUsage,
  assignSubscription,
  suspendSubscription,
  reactivateSubscription,
  cancelSubscription,
  createPlan,
  updatePlan,
  deletePlan,
  setPlanActive,
  fetchPlanChangeRequests,
  trialInfo,
} from "@/lib/subscriptions";
import StatCard from "@/components/StatCard";
import CountUp from "@/components/CountUp";
import Drawer from "@/components/Drawer";
import ConfirmationDialog from "@/components/ConfirmationDialog";
import FilterChip from "@/components/FilterChip";
import FilterSelect from "@/components/FilterSelect";
import { useLanguage } from "@/context/LanguageContext";
import styles from "../admin.module.css";

function Banner({ banner }) {
  if (!banner) return null;
  return (
    <div className={`${styles.banner} ${banner.type === "success" ? styles.bannerSuccess : styles.bannerError}`}>
      {banner.message}
    </div>
  );
}

function PlanColorPicker({ value, onChange, t }) {
  return (
    <div className={styles.colorSwatchGroup} role="radiogroup" aria-label={t("bo.adminAbonnements.planColorAriaLabel")}>
      {PLAN_COLOR_OPTIONS.map((opt) => (
        <button
          type="button"
          key={opt.value}
          role="radio"
          aria-checked={value === opt.value}
          title={opt.label}
          className={`${styles.colorSwatchBtn} ${styles[`colorSwatch${capitalizeTone(opt.value)}`]} ${
            value === opt.value ? styles.colorSwatchBtnActive : ""
          }`}
          onClick={() => onChange(opt.value)}
        >
          {value === opt.value && <i className="bi bi-check-lg" />}
          <span className={styles.colorSwatchLabel}>{opt.label}</span>
        </button>
      ))}
    </div>
  );
}

function badgeClass(status) {
  if (status === SUBSCRIPTION_STATUS.ACTIF) return styles.badgeActive;
  if (status === SUBSCRIPTION_STATUS.SUSPENDU) return styles.badgeSuspended;
  if (status === SUBSCRIPTION_STATUS.EXPIRE) return styles.badgeExpired;
  return styles.badgeCancelled;
}

function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
}

function usersLine(impactCount, plan, t) {
  const word = impactCount > 1 ? t("bo.adminAbonnements.usersWord") : t("bo.adminAbonnements.userWord");
  return `${impactCount} ${word}${plan.is_trial ? t("bo.adminAbonnements.trialSuffix") : ""}`;
}

function accountStatusLabels(t) {
  return {
    1: t("bo.adminAbonnements.accountActive"),
    2: t("bo.adminAbonnements.accountInvitePending"),
    3: t("bo.adminAbonnements.accountDisabled"),
  };
}

function emptyLimits(fill) {
  return Object.fromEntries(LIMIT_FIELDS.map((f) => [f.key, fill]));
}

function planToDraft(plan) {
  return {
    name: plan.name,
    description: plan.description || "",
    price: String(plan.price),
    duration_days: String(plan.duration_days),
    color: plan.color || "olive",
    limits: Object.fromEntries(LIMIT_FIELDS.map((f) => [f.key, plan[f.key] === UNLIMITED ? "0" : String(plan[f.key])])),
    unlimited: Object.fromEntries(LIMIT_FIELDS.map((f) => [f.key, plan[f.key] === UNLIMITED])),
  };
}

function diffEntries(plan, draft, t) {
  const entries = [];
  if (draft.name !== plan.name) entries.push({ label: t("bo.adminAbonnements.diffName"), before: plan.name, after: draft.name });
  if ((draft.description || "") !== (plan.description || "")) {
    entries.push({ label: t("bo.adminAbonnements.diffDescription"), before: plan.description || "—", after: draft.description || "—" });
  }
  if (Number(draft.price) !== Number(plan.price)) {
    entries.push({ label: t("bo.adminAbonnements.diffPrice"), before: `${plan.price} MAD`, after: `${draft.price} MAD` });
  }
  if (Number(draft.duration_days) !== Number(plan.duration_days)) {
    entries.push({ label: t("bo.adminAbonnements.diffDuration"), before: `${plan.duration_days} j`, after: `${draft.duration_days} j` });
  }
  if (draft.color !== (plan.color || "olive")) {
    const colorLabel = (value) => PLAN_COLOR_OPTIONS.find((c) => c.value === value)?.label || value;
    entries.push({ label: t("bo.adminAbonnements.diffColor"), before: colorLabel(plan.color || "olive"), after: colorLabel(draft.color) });
  }
  LIMIT_FIELDS.forEach((f) => {
    const newVal = draft.unlimited[f.key] ? UNLIMITED : Number(draft.limits[f.key] || 0);
    if (newVal !== plan[f.key]) {
      entries.push({ label: f.label, before: formatLimit(plan[f.key]), after: formatLimit(newVal) });
    }
  });
  return entries;
}

const PAGE_SIZE = 10;

function trialPillClass(state) {
  if (state === "expired") return styles.trialPillExpired;
  if (state === "warning") return styles.trialPillWarning;
  return styles.trialPillActive;
}

function usageFillClass(percent) {
  if (percent === null) return styles.usageFill;
  if (percent >= 100) return `${styles.usageFill} ${styles.usageFillDanger}`;
  if (percent >= 75) return `${styles.usageFill} ${styles.usageFillWarning}`;
  return styles.usageFill;
}

export default function AdminAbonnementsPage() {
  const { t } = useLanguage();
  const ACCOUNT_STATUS_LABELS = useMemo(() => accountStatusLabels(t), [t]);
  const [users, setUsers] = useState([]);
  const [plans, setPlans] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  // Juste le compte pour le badge du bouton vers /abonnements/demandes — le
  // détail (approuver/rejeter) vit sur cette page dédiée, pas ici.
  const [planChangeRequests, setPlanChangeRequests] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const [editingPlanId, setEditingPlanId] = useState(null);
  const [editDraft, setEditDraft] = useState(null);
  const [planSaving, setPlanSaving] = useState(false);
  const [planBanner, setPlanBanner] = useState(null);

  const [planDeleteTarget, setPlanDeleteTarget] = useState(null);
  const [planDeleteBusy, setPlanDeleteBusy] = useState(false);
  const [planDeleteError, setPlanDeleteError] = useState(null);

  const [newPlan, setNewPlan] = useState({
    name: "",
    description: "",
    price: "",
    duration_days: "30",
    is_trial: false,
    color: "olive",
    limits: emptyLimits("0"),
    unlimited: emptyLimits(true),
  });
  const [createBusy, setCreateBusy] = useState(false);
  const [createBanner, setCreateBanner] = useState(null);

  const [search, setSearch] = useState("");
  const [planFilter, setPlanFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [trialOnly, setTrialOnly] = useState(false);
  const [expiredOnly, setExpiredOnly] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const [selectedRowId, setSelectedRowId] = useState(null);
  const [usage, setUsage] = useState(null);
  const [usageLoading, setUsageLoading] = useState(false);
  const [detailBanner, setDetailBanner] = useState(null);

  const plansScrollRef = useRef(null);

  function scrollPlans(direction) {
    const node = plansScrollRef.current;
    if (!node) return;
    const card = node.querySelector(`.${styles.planCard}`);
    const amount = (card?.offsetWidth || 300) + 18; // largeur carte + gap
    node.scrollBy({ left: direction * amount, behavior: "smooth" });
  }

  const [changePlanOpen, setChangePlanOpen] = useState(false);
  const [changePlanTargetId, setChangePlanTargetId] = useState("");
  const [changePlanBusy, setChangePlanBusy] = useState(false);
  const [changePlanBanner, setChangePlanBanner] = useState(null);

  useEffect(() => {
    async function init() {
      setIsLoading(true);
      try {
        const [userList, planList, subList, requestList] = await Promise.all([
          fetchUsers(),
          fetchPlans(),
          fetchSubscriptions(),
          fetchPlanChangeRequests(),
        ]);
        setUsers(userList);
        setPlans(planList);
        setSubscriptions(subList);
        setPlanChangeRequests(requestList);
      } catch (err) {
        setLoadError(extractErrorMessage(err));
      } finally {
        setIsLoading(false);
      }
    }
    init();
  }, []);

  // Free Trial toujours en premier, puis les plans payants du moins cher au plus cher
  // (Trial - PRO - Enterprise) — la table subscription_plans n'a pas d'ordre garanti.
  const sortedPlans = useMemo(
    () =>
      [...plans].sort((a, b) => {
        if (a.is_trial !== b.is_trial) return a.is_trial ? -1 : 1;
        return a.price - b.price;
      }),
    [plans]
  );

  const activePlans = useMemo(() => sortedPlans.filter((p) => p.is_active), [sortedPlans]);

  const rows = useMemo(() => {
    return subscriptions
      .map((subscription) => ({ subscription, user: users.find((u) => u.id === subscription.owner_id) }))
      .filter((row) => row.user);
  }, [subscriptions, users]);

  const stats = useMemo(() => {
    const activeSubs = subscriptions.filter((s) => s.status === SUBSCRIPTION_STATUS.ACTIF).length;
    const trialActive = subscriptions.filter(
      (s) => s.status === SUBSCRIPTION_STATUS.ACTIF && s.plan?.is_trial
    ).length;
    const expiredSubs = subscriptions.filter((s) => s.status === SUBSCRIPTION_STATUS.EXPIRE).length;
    return { totalUsers: users.length, activeSubs, trialActive, expiredSubs };
  }, [users, subscriptions]);

  const pendingRequestsCount = useMemo(
    () => planChangeRequests.filter((r) => r.statut === PLAN_CHANGE_REQUEST_STATUS.EN_ATTENTE).length,
    [planChangeRequests]
  );

  const planTones = useMemo(() => {
    const map = {};
    sortedPlans.forEach((plan) => {
      map[plan.id] = capitalizeTone(plan.color);
    });
    return map;
  }, [sortedPlans]);

  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter(({ subscription, user }) => {
      if (term) {
        const haystack = [user.prenom, user.nom, user.email, subscription.plan?.name, SUBSCRIPTION_STATUS_LABELS[subscription.status]]
          .filter((v) => v !== null && v !== undefined && v !== "")
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      if (planFilter && String(subscription.plan_id) !== planFilter) return false;
      if (statusFilter && String(subscription.status) !== statusFilter) return false;
      if (trialOnly && !subscription.plan?.is_trial) return false;
      if (expiredOnly && subscription.status !== SUBSCRIPTION_STATUS.EXPIRE) return false;
      return true;
    });
  }, [rows, search, planFilter, statusFilter, trialOnly, expiredOnly]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedRows = filteredRows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const selectedRow = useMemo(
    () => rows.find((row) => row.subscription.id === selectedRowId) || null,
    [rows, selectedRowId]
  );

  useEffect(() => {
    const ownerId = selectedRow?.user?.id;
    if (!ownerId) return;
    async function init() {
      setUsageLoading(true);
      try {
        const u = await fetchOwnerUsage(ownerId);
        setUsage(u);
      } catch (err) {
        setDetailBanner({ type: "error", message: extractErrorMessage(err) });
      } finally {
        setUsageLoading(false);
      }
    }
    init();
  }, [selectedRow?.user?.id]);

  function selectRow(subscriptionId) {
    setSelectedRowId(subscriptionId);
    setDetailBanner(null);
    setChangePlanOpen(false);
    setChangePlanBanner(null);
    setUsage(null);
    const row = subscriptionId ? rows.find((r) => r.subscription.id === subscriptionId) : null;
    setChangePlanTargetId(row ? String(row.subscription.plan_id) : "");
  }

  function startEdit(plan) {
    setEditingPlanId(plan.id);
    setEditDraft(planToDraft(plan));
    setPlanBanner(null);
  }

  function cancelEdit() {
    setEditingPlanId(null);
    setEditDraft(null);
  }

  async function handleSaveEdit(plan) {
    setPlanSaving(true);
    setPlanBanner(null);
    try {
      const payload = {
        name: editDraft.name,
        description: editDraft.description || null,
        price: Number(editDraft.price),
        duration_days: Number(editDraft.duration_days),
        color: editDraft.color,
      };
      LIMIT_FIELDS.forEach((f) => {
        payload[f.key] = editDraft.unlimited[f.key] ? UNLIMITED : Number(editDraft.limits[f.key] || 0);
      });
      const updated = await updatePlan(plan.id, payload);
      setPlans((prev) => prev.map((p) => (p.id === plan.id ? updated : p)));
      setSubscriptions((prev) => prev.map((s) => (s.plan_id === plan.id ? { ...s, plan: updated } : s)));
      setEditingPlanId(null);
      setEditDraft(null);
      setPlanBanner({ type: "success", message: t("bo.adminAbonnements.planUpdated", { name: updated.name }) });
    } catch (err) {
      setPlanBanner({ type: "error", message: extractErrorMessage(err) });
    } finally {
      setPlanSaving(false);
    }
  }

  async function handleTogglePlanActive(plan) {
    setPlanBanner(null);
    try {
      const updated = await setPlanActive(plan.id, !plan.is_active);
      setPlans((prev) => prev.map((p) => (p.id === plan.id ? updated : p)));
    } catch (err) {
      setPlanBanner({ type: "error", message: extractErrorMessage(err) });
    }
  }

  async function handleConfirmDeletePlan() {
    if (!planDeleteTarget) return;
    setPlanDeleteBusy(true);
    setPlanDeleteError(null);
    try {
      await deletePlan(planDeleteTarget.id);
      setPlans((prev) => prev.filter((p) => p.id !== planDeleteTarget.id));
      setPlanDeleteTarget(null);
    } catch (err) {
      setPlanDeleteError(extractErrorMessage(err));
    } finally {
      setPlanDeleteBusy(false);
    }
  }

  async function handleCreatePlan(e) {
    e.preventDefault();
    setCreateBanner(null);
    setCreateBusy(true);
    try {
      const payload = {
        name: newPlan.name,
        description: newPlan.description || null,
        price: Number(newPlan.price || 0),
        duration_days: Number(newPlan.duration_days),
        is_trial: newPlan.is_trial,
        color: newPlan.color,
      };
      LIMIT_FIELDS.forEach((f) => {
        payload[f.key] = newPlan.unlimited[f.key] ? UNLIMITED : Number(newPlan.limits[f.key] || 0);
      });
      const plan = await createPlan(payload);
      setPlans((prev) => [...prev, plan]);
      setNewPlan({
        name: "",
        description: "",
        price: "",
        duration_days: "30",
        is_trial: false,
        color: "olive",
        limits: emptyLimits("0"),
        unlimited: emptyLimits(true),
      });
      setCreateBanner({ type: "success", message: t("bo.adminAbonnements.planCreated", { name: plan.name }) });
    } catch (err) {
      setCreateBanner({ type: "error", message: extractErrorMessage(err) });
    } finally {
      setCreateBusy(false);
    }
  }

  async function handleQuickSuspendToggle(subscription) {
    setLoadError(null);
    try {
      const updated =
        subscription.status === SUBSCRIPTION_STATUS.SUSPENDU
          ? await reactivateSubscription(subscription.id)
          : await suspendSubscription(subscription.id);
      setSubscriptions((prev) => prev.map((s) => (s.id === subscription.id ? updated : s)));
    } catch (err) {
      setLoadError(extractErrorMessage(err));
    }
  }

  async function handleDetailSuspendToggle() {
    if (!selectedRow) return;
    setDetailBanner(null);
    try {
      const sub = selectedRow.subscription;
      const wasSuspended = sub.status === SUBSCRIPTION_STATUS.SUSPENDU;
      const updated = wasSuspended ? await reactivateSubscription(sub.id) : await suspendSubscription(sub.id);
      setSubscriptions((prev) => prev.map((s) => (s.id === sub.id ? updated : s)));
      setDetailBanner({
        type: "success",
        message: wasSuspended ? t("bo.adminAbonnements.subscriptionReactivated") : t("bo.adminAbonnements.subscriptionSuspended"),
      });
    } catch (err) {
      setDetailBanner({ type: "error", message: extractErrorMessage(err) });
    }
  }

  async function handleDetailCancel() {
    if (!selectedRow) return;
    setDetailBanner(null);
    try {
      const updated = await cancelSubscription(selectedRow.subscription.id);
      setSubscriptions((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
      setDetailBanner({ type: "success", message: t("bo.adminAbonnements.subscriptionCancelled") });
    } catch (err) {
      setDetailBanner({ type: "error", message: extractErrorMessage(err) });
    }
  }

  async function handleConfirmChangePlan() {
    if (!changePlanTargetId || !selectedRow) return;
    setChangePlanBusy(true);
    setChangePlanBanner(null);
    try {
      const updated = await assignSubscription(selectedRow.user.id, Number(changePlanTargetId));
      setSubscriptions((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
      setChangePlanOpen(false);
      setDetailBanner({ type: "success", message: t("bo.adminAbonnements.planChanged", { name: updated.plan.name }) });
    } catch (err) {
      setChangePlanBanner({ type: "error", message: extractErrorMessage(err) });
    } finally {
      setChangePlanBusy(false);
    }
  }

  const changePlanTarget = plans.find((p) => p.id === Number(changePlanTargetId)) || null;

  const planDeleteTargetCount = planDeleteTarget
    ? subscriptions.filter((s) => s.plan_id === planDeleteTarget.id).length
    : 0;

  if (isLoading) {
    return <p>{t("bo.adminAbonnements.loading")}</p>;
  }

  return (
    <div>
      <Banner banner={loadError ? { type: "error", message: loadError } : null} />

      {/* ---- Stats ---- */}
      <div className={styles.section}>
        <div className={styles.statsGrid}>
          <StatCard icon="bi-people-fill" tone="primary" label={t("bo.adminAbonnements.statUsers")} value={<CountUp value={stats.totalUsers} />} />
          <StatCard
            icon="bi-credit-card-fill"
            tone="accent"
            label={t("bo.adminAbonnements.statActiveSubs")}
            value={<CountUp value={stats.activeSubs} />}
          />
          <StatCard
            icon="bi-hourglass-split"
            tone="warning"
            label={t("bo.adminAbonnements.statTrialActive")}
            value={<CountUp value={stats.trialActive} />}
          />
          <StatCard
            icon="bi-exclamation-octagon-fill"
            tone="danger"
            label={t("bo.adminAbonnements.statExpiredSubs")}
            value={<CountUp value={stats.expiredSubs} />}
          />
        </div>
      </div>

      {/* ---- Demandes de changement de plan ---- */}
      <div className={styles.section}>
        <Link
          href="/backoffice/admin/abonnements/demandes"
          className={`${styles.requestsCta} ${pendingRequestsCount > 0 ? styles.requestsCtaActive : ""}`}
        >
          <span className={styles.requestsCtaOrb} aria-hidden="true" />
          <span className={styles.requestsCtaIcon}>
            <i className="bi bi-inbox-fill" />
            {pendingRequestsCount > 0 && <span className={styles.requestsCtaPing} aria-hidden="true" />}
          </span>
          <span className={styles.requestsCtaBody}>
            <span className={styles.requestsCtaTitle}>{t("bo.adminAbonnements.requestsCtaTitle")}</span>
            <span className={styles.requestsCtaSubtitle}>
              {pendingRequestsCount > 0
                ? t("bo.adminAbonnements.requestsCtaPending", { count: pendingRequestsCount })
                : t("bo.adminAbonnements.requestsCtaNone")}
            </span>
          </span>
          {pendingRequestsCount > 0 && <span className={styles.requestsCtaCount}>{pendingRequestsCount}</span>}
          <span className={styles.requestsCtaArrow}>
            <i className="bi bi-arrow-right" />
          </span>
        </Link>
      </div>

      {/* ---- Plans d'abonnement ---- */}
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>{t("bo.adminAbonnements.plansSectionTitle")}</h2>
        <p className={styles.sectionSubtitle}>{t("bo.adminAbonnements.plansSectionSubtitle")}</p>
        <Banner banner={planBanner} />

        <div className={styles.plansCarouselWrap}>
          {sortedPlans.length > 1 && (
            <button
              type="button"
              className={`${styles.plansNavBtn} ${styles.plansNavBtnPrev}`}
              onClick={() => scrollPlans(-1)}
              aria-label={t("bo.adminAbonnements.prevPlans")}
            >
              <i className="bi bi-chevron-left" />
            </button>
          )}
          <div className={styles.plansGrid} ref={plansScrollRef}>
          {(() => {
            const cheapestPaid = sortedPlans.find((p) => !p.is_trial);
            return sortedPlans.map((plan, index) => {
              const isEditing = editingPlanId === plan.id;
              const impactCount = subscriptions.filter((s) => s.plan_id === plan.id).length;
              const tone = isEditing && editDraft ? capitalizeTone(editDraft.color) : planTones[plan.id];
              const isPopular = !!cheapestPaid && plan.id === cheapestPaid.id;
              return (
                <div
                  key={plan.id}
                  style={{ "--i": index }}
                  className={`${styles.planCard} ${styles[`planCard${tone}`]} ${
                    plan.is_active ? "" : styles.planCardInactive
                  } ${isEditing ? styles.planCardEditing : ""}`}
                >
                <div className={styles.planCardHeader}>
                  {isPopular && <span className={styles.planRibbon}>{t("bo.adminAbonnements.popular")}</span>}

                  <span className={styles.planIcon}>
                    <i className={`bi ${planIcon(plan, isPopular)}`} />
                  </span>

                  <div className={styles.planName}>{plan.name}</div>
                  <div className={styles.planPriceRow}>
                    <span className={styles.planPrice}>{plan.price} DH</span>
                    {priceUnit(plan) && <span className={styles.planPriceUnit}>{priceUnit(plan)}</span>}
                  </div>
                  <div className={styles.planMeta}>{billingLabel(plan)}</div>
                </div>

                <div className={styles.planCardBody}>
                {!isEditing && (
                  <>
                    <div className={styles.planLimitsList}>
                      {LIMIT_FIELDS.map((f) => (
                        <div className={styles.planLimitRow} key={f.key}>
                          <span>{f.label}</span>
                          <span className={styles.planLimitValue}>{formatLimit(plan[f.key])}</span>
                        </div>
                      ))}
                    </div>

                    <div className={styles.planFooterRow}>
                      <button
                        type="button"
                        className={`${styles.planStatusBtn} ${plan.is_active ? styles.planStatusActive : styles.planStatusInactive}`}
                        onClick={() => handleTogglePlanActive(plan)}
                      >
                        <span className={styles.planStatusDot} />
                        {plan.is_active ? t("bo.adminAbonnements.active") : t("bo.adminAbonnements.inactive")}
                      </button>
                      <div className={styles.planFooterActions}>
                        <button type="button" className={styles.planModifyLink} onClick={() => startEdit(plan)}>
                          {t("bo.adminAbonnements.modify")}
                        </button>
                        <button
                          type="button"
                          className={`${styles.planModifyLink} ${styles.planDeleteLink}`}
                          onClick={() => {
                            setPlanDeleteError(null);
                            setPlanDeleteTarget(plan);
                          }}
                          title={impactCount > 0 ? t("bo.adminAbonnements.deleteUsedTitle") : t("bo.adminAbonnements.deleteTitle")}
                        >
                          <i className="bi bi-trash" />
                        </button>
                      </div>
                    </div>
                    <div className={styles.planUsersLine}>{usersLine(impactCount, plan, t)}</div>
                  </>
                )}

                {isEditing && editDraft && (
                  <div className={styles.editForm}>
                    <div className={styles.editFormHeader}>
                      <span className={styles.editFormTitle}>
                        <i className="bi bi-sliders" />
                        {t("bo.adminAbonnements.editPlanTitle")}
                      </span>
                      <button type="button" className={styles.editFormClose} onClick={cancelEdit} aria-label={t("bo.adminAbonnements.close")}>
                        <i className="bi bi-x-lg" />
                      </button>
                    </div>

                    <div className={styles.editRow}>
                      <label className={styles.field}>
                        {t("bo.adminAbonnements.nameLabel")}
                        <input
                          type="text"
                          value={editDraft.name}
                          onChange={(e) => setEditDraft((d) => ({ ...d, name: e.target.value }))}
                        />
                      </label>
                      <label className={styles.field}>
                        {t("bo.adminAbonnements.descriptionLabel")}
                        <input
                          type="text"
                          value={editDraft.description}
                          onChange={(e) => setEditDraft((d) => ({ ...d, description: e.target.value }))}
                        />
                      </label>
                    </div>

                    <div className={styles.editSectionDivider}>
                      <i className="bi bi-palette" />
                      {t("bo.adminAbonnements.appearance")}
                    </div>
                    <PlanColorPicker
                      value={editDraft.color}
                      onChange={(color) => setEditDraft((d) => ({ ...d, color }))}
                      t={t}
                    />

                    <div className={styles.editRow}>
                      <label className={styles.field}>
                        {t("bo.adminAbonnements.priceLabel")}
                        <input
                          type="number"
                          step="0.01"
                          value={editDraft.price}
                          onChange={(e) => setEditDraft((d) => ({ ...d, price: e.target.value }))}
                        />
                      </label>
                      <label className={styles.field}>
                        {t("bo.adminAbonnements.durationLabel")}
                        <input
                          type="number"
                          value={editDraft.duration_days}
                          onChange={(e) => setEditDraft((d) => ({ ...d, duration_days: e.target.value }))}
                        />
                      </label>
                    </div>

                    <div className={styles.editSectionDivider}>
                      <i className="bi bi-speedometer2" />
                      {t("bo.adminAbonnements.usageLimits")}
                    </div>

                    <div className={styles.limitEditList}>
                      {LIMIT_FIELDS.map((f) => (
                        <div className={styles.limitEditRow} key={f.key}>
                          <span className={styles.limitEditIcon}>
                            <i className={`bi ${f.icon}`} />
                          </span>
                          <span className={styles.limitEditLabel}>{f.label}</span>
                          <input
                            type="number"
                            min="0"
                            className={styles.limitEditInput}
                            disabled={editDraft.unlimited[f.key]}
                            value={editDraft.limits[f.key]}
                            onChange={(e) =>
                              setEditDraft((d) => ({ ...d, limits: { ...d.limits, [f.key]: e.target.value } }))
                            }
                          />
                          <label className={styles.toggleSwitch}>
                            <input
                              type="checkbox"
                              checked={editDraft.unlimited[f.key]}
                              onChange={(e) =>
                                setEditDraft((d) => ({
                                  ...d,
                                  unlimited: { ...d.unlimited, [f.key]: e.target.checked },
                                }))
                              }
                            />
                            <span className={styles.toggleTrack}>
                              <span className={styles.toggleThumb} />
                            </span>
                            <span className={styles.toggleLabel}>{t("bo.adminAbonnements.unlimited")}</span>
                          </label>
                        </div>
                      ))}
                    </div>

                    {(() => {
                      const entries = diffEntries(plan, editDraft, t);
                      if (entries.length === 0) return null;
                      return (
                        <div className={styles.diffBox}>
                          <div className={styles.diffTitle}>
                            <i className="bi bi-arrow-left-right" />
                            {t("bo.adminAbonnements.changesTitle")}
                          </div>
                          {entries.map((entry) => (
                            <div className={styles.diffRow} key={entry.label}>
                              <span className={styles.diffLabel}>{entry.label}</span>
                              <span className={styles.diffBefore}>{entry.before}</span>
                              <i className="bi bi-arrow-right" />
                              <span className={styles.diffAfter}>{entry.after}</span>
                            </div>
                          ))}
                          <div className={styles.diffImpact}>
                            {impactCount === 0
                              ? t("bo.adminAbonnements.diffImpactNone")
                              : t("bo.adminAbonnements.diffImpactSome", { count: impactCount })}
                          </div>
                        </div>
                      );
                    })()}

                    <div className={styles.editActions}>
                      <button
                        type="button"
                        className={styles.btn}
                        onClick={() => handleSaveEdit(plan)}
                        disabled={planSaving}
                      >
                        <i className="bi bi-check-lg" />
                        {planSaving ? t("bo.adminAbonnements.saving") : t("bo.adminAbonnements.save")}
                      </button>
                      <button type="button" className={styles.btnOutline} onClick={cancelEdit} disabled={planSaving}>
                        <i className="bi bi-x-lg" />
                        {t("bo.adminAbonnements.cancel")}
                      </button>
                    </div>
                  </div>
                )}
                </div>
              </div>
              );
            });
          })()}
          </div>
          {sortedPlans.length > 1 && (
            <button
              type="button"
              className={`${styles.plansNavBtn} ${styles.plansNavBtnNext}`}
              onClick={() => scrollPlans(1)}
              aria-label={t("bo.adminAbonnements.nextPlans")}
            >
              <i className="bi bi-chevron-right" />
            </button>
          )}
        </div>

        {/* ---- Créer un plan ---- */}
        <div className={styles.newPlanCard}>
          <div className={styles.newPlanHeader}>
            <span className={styles.newPlanHeaderIcon}>
              <i className="bi bi-stars" />
            </span>
            <div>
              <h3 className={styles.newPlanTitle}>{t("bo.adminAbonnements.createPlanTitle")}</h3>
              <p className={styles.newPlanSubtitle}>{t("bo.adminAbonnements.createPlanSubtitle")}</p>
            </div>
          </div>
          <Banner banner={createBanner} />

          <div className={styles.newPlanLayout}>
            <form className={styles.newPlanForm} onSubmit={handleCreatePlan}>
              <div className={`${styles.editSectionDivider} ${styles.editSectionDividerFirst}`}>
                <i className="bi bi-card-text" />
                {t("bo.adminAbonnements.generalInfo")}
              </div>
              <div className={styles.editRow}>
                <label className={styles.field}>
                  {t("bo.adminAbonnements.nameLabel")}
                  <input
                    type="text"
                    value={newPlan.name}
                    onChange={(e) => setNewPlan((p) => ({ ...p, name: e.target.value }))}
                    required
                  />
                </label>
                <label className={styles.field}>
                  {t("bo.adminAbonnements.descriptionLabel")}
                  <input
                    type="text"
                    value={newPlan.description}
                    onChange={(e) => setNewPlan((p) => ({ ...p, description: e.target.value }))}
                  />
                </label>
              </div>

              <div className={styles.editSectionDivider}>
                <i className="bi bi-palette" />
                {t("bo.adminAbonnements.appearance")}
              </div>
              <PlanColorPicker value={newPlan.color} onChange={(color) => setNewPlan((p) => ({ ...p, color }))} t={t} />

              <div className={styles.editSectionDivider}>
                <i className="bi bi-tag" />
                {t("bo.adminAbonnements.pricing")}
              </div>
              <div className={styles.editRow}>
                <label className={styles.field}>
                  {t("bo.adminAbonnements.priceLabel")}
                  <input
                    type="number"
                    step="0.01"
                    value={newPlan.price}
                    onChange={(e) => setNewPlan((p) => ({ ...p, price: e.target.value }))}
                    required
                  />
                </label>
                <label className={styles.field}>
                  {t("bo.adminAbonnements.durationLabel")}
                  <input
                    type="number"
                    value={newPlan.duration_days}
                    onChange={(e) => setNewPlan((p) => ({ ...p, duration_days: e.target.value }))}
                    required
                  />
                </label>
              </div>

              <label className={styles.toggleSwitch} style={{ marginTop: "0.9rem" }}>
                <input
                  type="checkbox"
                  checked={newPlan.is_trial}
                  onChange={(e) => setNewPlan((p) => ({ ...p, is_trial: e.target.checked }))}
                />
                <span className={styles.toggleTrack}>
                  <span className={styles.toggleThumb} />
                </span>
                <span className={styles.toggleLabel}>{t("bo.adminAbonnements.trialPlan")}</span>
              </label>

              <div className={styles.editSectionDivider}>
                <i className="bi bi-speedometer2" />
                {t("bo.adminAbonnements.usageLimits")}
              </div>

              <div className={styles.limitEditList}>
                {LIMIT_FIELDS.map((f) => (
                  <div className={styles.limitEditRow} key={f.key}>
                    <span className={styles.limitEditIcon}>
                      <i className={`bi ${f.icon}`} />
                    </span>
                    <span className={styles.limitEditLabel}>{f.label}</span>
                    <input
                      type="number"
                      min="0"
                      className={styles.limitEditInput}
                      disabled={newPlan.unlimited[f.key]}
                      value={newPlan.limits[f.key]}
                      onChange={(e) =>
                        setNewPlan((p) => ({ ...p, limits: { ...p.limits, [f.key]: e.target.value } }))
                      }
                    />
                    <label className={styles.toggleSwitch}>
                      <input
                        type="checkbox"
                        checked={newPlan.unlimited[f.key]}
                        onChange={(e) =>
                          setNewPlan((p) => ({ ...p, unlimited: { ...p.unlimited, [f.key]: e.target.checked } }))
                        }
                      />
                      <span className={styles.toggleTrack}>
                        <span className={styles.toggleThumb} />
                      </span>
                      <span className={styles.toggleLabel}>{t("bo.adminAbonnements.unlimited")}</span>
                    </label>
                  </div>
                ))}
              </div>
              <button type="submit" className={styles.btn} disabled={createBusy}>
                <i className="bi bi-plus-lg" />
                {createBusy ? t("bo.adminAbonnements.creating") : t("bo.adminAbonnements.createPlan")}
              </button>
            </form>

            <div className={styles.newPlanPreviewWrap}>
              <span className={styles.newPlanPreviewLabel}>
                <i className="bi bi-eye" />
                {t("bo.adminAbonnements.livePreview")}
              </span>
              {(() => {
                const price = Number(newPlan.price || 0);
                const previewPlan = {
                  name: newPlan.name || t("bo.adminAbonnements.planNamePlaceholder"),
                  description: newPlan.description,
                  price,
                  duration_days: Number(newPlan.duration_days || 30),
                  is_trial: newPlan.is_trial,
                  color: newPlan.color,
                  ...Object.fromEntries(
                    LIMIT_FIELDS.map((f) => [
                      f.key,
                      newPlan.unlimited[f.key] ? UNLIMITED : Number(newPlan.limits[f.key] || 0),
                    ])
                  ),
                };
                const tone = capitalizeTone(previewPlan.color);
                return (
                  <div className={`${styles.planCard} ${styles[`planCard${tone}`]} ${styles.planCardPreview}`}>
                    <div className={styles.planCardHeader}>
                      <span className={styles.planIcon}>
                        <i className={`bi ${planIcon(previewPlan, false)}`} />
                      </span>
                      <div className={styles.planName}>{previewPlan.name}</div>
                      <div className={styles.planPriceRow}>
                        <span className={styles.planPrice}>{previewPlan.price} DH</span>
                        {priceUnit(previewPlan) && <span className={styles.planPriceUnit}>{priceUnit(previewPlan)}</span>}
                      </div>
                      <div className={styles.planMeta}>{billingLabel(previewPlan)}</div>
                    </div>
                    <div className={styles.planCardBody}>
                      {previewPlan.description && (
                        <p className={styles.newPlanPreviewDesc}>{previewPlan.description}</p>
                      )}
                      <div className={styles.planLimitsList}>
                        {LIMIT_FIELDS.map((f) => (
                          <div className={styles.planLimitRow} key={f.key}>
                            <span>{f.label}</span>
                            <span className={styles.planLimitValue}>{formatLimit(previewPlan[f.key])}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      </div>

      <ConfirmationDialog
        isOpen={!!planDeleteTarget}
        onClose={() => setPlanDeleteTarget(null)}
        onConfirm={handleConfirmDeletePlan}
        title={t("bo.adminAbonnements.deletePlanTitle")}
        message={
          planDeleteTarget
            ? planDeleteTargetCount > 0
              ? t("bo.adminAbonnements.deletePlanBlocked", { name: planDeleteTarget.name, count: planDeleteTargetCount })
              : t("bo.adminAbonnements.deletePlanConfirm", { name: planDeleteTarget.name })
            : ""
        }
        confirmLabel={t("bo.adminAbonnements.delete")}
        danger
        isBusy={planDeleteBusy}
        error={planDeleteError}
        hideConfirm={planDeleteTargetCount > 0}
      />

      {/* ---- Abonnements par compte ---- */}
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>
          <i className="bi bi-table" style={{ marginRight: "0.5rem", color: "var(--primary)" }} />
          {t("bo.adminAbonnements.byAccountTitle")}
        </h2>
        <p className={styles.sectionSubtitle}>
          {t("bo.adminAbonnements.byAccountSubtitle", { shown: filteredRows.length, total: rows.length })}
        </p>

        <div className={styles.filtersRow}>
          <div className={styles.searchInputWrap}>
            <i className={`bi bi-search ${styles.searchIcon}`} />
            <input
              type="text"
              className={styles.searchInput}
              placeholder={t("bo.adminAbonnements.searchPlaceholder")}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>
          <FilterSelect
            value={planFilter}
            onChange={(v) => {
              setPlanFilter(v);
              setCurrentPage(1);
            }}
            options={[
              { value: "", label: t("bo.adminAbonnements.allPlans") },
              ...sortedPlans.map((plan) => ({ value: plan.id, label: plan.name })),
            ]}
          />
          <FilterSelect
            value={statusFilter}
            onChange={(v) => {
              setStatusFilter(v);
              setCurrentPage(1);
            }}
            options={[
              { value: "", label: t("bo.adminAbonnements.allStatuses") },
              ...Object.entries(SUBSCRIPTION_STATUS_LABELS).map(([value, label]) => ({ value, label })),
            ]}
          />
          <FilterChip
            checked={trialOnly}
            onChange={(checked) => {
              setTrialOnly(checked);
              setCurrentPage(1);
            }}
          >
            {t("bo.adminAbonnements.trialOnly")}
          </FilterChip>
          <FilterChip
            checked={expiredOnly}
            onChange={(checked) => {
              setExpiredOnly(checked);
              setCurrentPage(1);
            }}
          >
            {t("bo.adminAbonnements.expiredOnly")}
          </FilterChip>
        </div>

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>{t("bo.adminAbonnements.colUser")}</th>
                <th>{t("bo.adminAbonnements.colEmail")}</th>
                <th>{t("bo.adminAbonnements.colPlan")}</th>
                <th>{t("bo.adminAbonnements.colStatus")}</th>
                <th>{t("bo.adminAbonnements.colStart")}</th>
                <th>{t("bo.adminAbonnements.colExpiration")}</th>
                <th>{t("bo.adminAbonnements.colActions")}</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.length === 0 && (
                <tr>
                  <td colSpan={7} className={styles.empty}>
                    {t("bo.adminAbonnements.noMatch")}
                  </td>
                </tr>
              )}
              {paginatedRows.map(({ subscription, user }) => {
                const initials = `${user.prenom?.[0] || ""}${user.nom?.[0] || ""}`.toUpperCase();
                const isSuspended = subscription.status === SUBSCRIPTION_STATUS.SUSPENDU;
                const trial = trialInfo(subscription);
                return (
                  <tr
                    key={subscription.id}
                    className={selectedRowId === subscription.id ? styles.tableRowActive : ""}
                  >
                    <td>
                      <div className={styles.userCell}>
                        {user.photo ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={`${API_BASE_URL}${user.photo}`}
                            alt=""
                            className={styles.avatarSm}
                            style={{ objectFit: "cover" }}
                          />
                        ) : (
                          <span className={styles.avatarSm}>{initials || "?"}</span>
                        )}
                        <span className={styles.userName}>
                          {user.prenom} {user.nom}
                        </span>
                      </div>
                    </td>
                    <td>{user.email}</td>
                    <td>
                      <span className={`${styles.planPill} ${styles[`planPill${planTones[subscription.plan_id] || "Charcoal"}`]}`}>
                        {subscription.plan.name}
                      </span>
                      {trial && (
                        <span className={`${styles.trialPill} ${trialPillClass(trial.state)}`}>
                          {trial.state === "expired"
                            ? t("bo.adminAbonnements.trialExpired")
                            : t("bo.adminAbonnements.trialDaysLeft", { count: trial.daysRemaining })}
                        </span>
                      )}
                    </td>
                    <td>
                      <span className={`${styles.badge} ${badgeClass(subscription.status)}`}>
                        {SUBSCRIPTION_STATUS_LABELS[subscription.status]}
                      </span>
                    </td>
                    <td>{formatDate(subscription.start_date)}</td>
                    <td>{formatDate(subscription.end_date)}</td>
                    <td>
                      <div className={styles.tableActions}>
                        <button
                          type="button"
                          className={styles.iconBtn}
                          onClick={() => selectRow(subscription.id)}
                          title={t("bo.adminAbonnements.seeDetails")}
                        >
                          <i className="bi bi-eye" />
                        </button>
                        <button
                          type="button"
                          className={styles.iconBtn}
                          onClick={() => handleQuickSuspendToggle(subscription)}
                          title={isSuspended ? t("bo.adminAbonnements.reactivate") : t("bo.adminAbonnements.suspend")}
                        >
                          <i className={`bi ${isSuspended ? "bi-play-circle" : "bi-pause-circle"}`} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {filteredRows.length > 0 && (
            <div className={styles.paginationRow}>
              <span>
                {t("bo.adminAbonnements.pageOf", { page: safePage, total: totalPages, count: filteredRows.length })}
              </span>
              <div className={styles.paginationButtons}>
                <button
                  type="button"
                  className={styles.btnOutline}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={safePage <= 1}
                >
                  <i className="bi bi-chevron-left" />
                  {t("bo.adminAbonnements.previous")}
                </button>
                <button
                  type="button"
                  className={styles.btnOutline}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={safePage >= totalPages}
                >
                  {t("bo.adminAbonnements.next")}
                  <i className="bi bi-chevron-right" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ---- Détail de l'abonnement (Voir) ---- */}
        {selectedRow && (
          <Drawer
            isOpen={!!selectedRow}
            onClose={() => selectRow(null)}
            wide
            title={
              <div className={styles.detailHeaderRow}>
                <div className={styles.detailHeaderIdentity}>
                  <span className={styles.detailAvatar}>
                    {`${selectedRow.user.prenom?.[0] || ""}${selectedRow.user.nom?.[0] || ""}`.toUpperCase() || "?"}
                  </span>
                  <div>
                    <h3 className={styles.detailTitle}>
                      {selectedRow.user.prenom} {selectedRow.user.nom}
                    </h3>
                    <div className={styles.detailHeaderTags}>
                      <span
                        className={`${styles.planPill} ${styles[`planPill${planTones[selectedRow.subscription.plan_id] || "Charcoal"}`]}`}
                      >
                        {selectedRow.subscription.plan.name}
                      </span>
                      <span className={`${styles.badge} ${badgeClass(selectedRow.subscription.status)}`}>
                        {SUBSCRIPTION_STATUS_LABELS[selectedRow.subscription.status]}
                      </span>
                    </div>
                  </div>
                </div>
                <div className={styles.detailHeaderActions}>
                  <button type="button" className={styles.detailHeaderActionBtn} onClick={handleDetailSuspendToggle}>
                    <i
                      className={`bi ${selectedRow.subscription.status === SUBSCRIPTION_STATUS.SUSPENDU ? "bi-play-circle" : "bi-pause-circle"}`}
                    />
                    {selectedRow.subscription.status === SUBSCRIPTION_STATUS.SUSPENDU
                      ? t("bo.adminAbonnements.reactivate")
                      : t("bo.adminAbonnements.suspend")}
                  </button>
                  {selectedRow.subscription.status !== SUBSCRIPTION_STATUS.RESILIE && (
                    <button
                      type="button"
                      className={`${styles.detailHeaderActionBtn} ${styles.detailHeaderActionBtnDanger}`}
                      onClick={handleDetailCancel}
                    >
                      <i className="bi bi-x-octagon" />
                      {t("bo.adminAbonnements.cancelSubscription")}
                    </button>
                  )}
                  <button
                    type="button"
                    className={`${styles.detailHeaderActionBtn} ${changePlanOpen ? styles.detailHeaderActionBtnActive : ""}`}
                    onClick={() => setChangePlanOpen((v) => !v)}
                  >
                    <i className="bi bi-arrow-left-right" />
                    {t("bo.adminAbonnements.changePlan")}
                  </button>

                  {changePlanOpen && (
                    <div className={styles.changePlanFlyout}>
                      <div className={styles.changePlanFlyoutHeader}>
                        <span className={styles.editFormTitle}>
                          <i className="bi bi-arrow-left-right" />
                          {t("bo.adminAbonnements.choosePlan")}
                        </span>
                        <button
                          type="button"
                          className={styles.iconBtn}
                          onClick={() => setChangePlanOpen(false)}
                          aria-label={t("bo.adminAbonnements.close")}
                        >
                          <i className="bi bi-x-lg" />
                        </button>
                      </div>
                      <Banner banner={changePlanBanner} />

                      <div className={styles.planPickerGrid}>
                        {activePlans.map((plan) => {
                          const isCurrent = plan.id === selectedRow.subscription.plan_id;
                          const isSelected = String(plan.id) === String(changePlanTargetId);
                          const tone = planTones[plan.id] || "Charcoal";
                          return (
                            <button
                              type="button"
                              key={plan.id}
                              className={`${styles.planPickerCard} ${styles[`planPickerCard${tone}`]} ${
                                isSelected ? styles.planPickerCardSelected : ""
                              }`}
                              onClick={() => setChangePlanTargetId(String(plan.id))}
                            >
                              {isCurrent && (
                                <span className={styles.planPickerCurrentBadge}>{t("bo.adminAbonnements.currentPlan")}</span>
                              )}
                              <span className={styles.planPickerRadio}>
                                <i className={`bi ${isSelected ? "bi-check-circle-fill" : "bi-circle"}`} />
                              </span>
                              <span className={styles.planPickerName}>{plan.name}</span>
                              <span className={styles.planPickerPrice}>
                                {plan.price} DH
                                {priceUnit(plan) && <span className={styles.planPickerUnit}>{priceUnit(plan)}</span>}
                              </span>
                              <span className={styles.planPickerMeta}>{billingLabel(plan)}</span>
                            </button>
                          );
                        })}
                      </div>

                      {changePlanTarget && (
                        <div className={styles.previewGrid}>
                          {LIMIT_FIELDS.map((f) => (
                            <div className={styles.limitItem} key={f.key}>
                              <span className={styles.limitIcon}>
                                <i className={`bi ${f.icon}`} />
                              </span>
                              <span className={styles.limitText}>
                                {f.label}
                                <span className={styles.limitValue}>{formatLimit(changePlanTarget[f.key])}</span>
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className={styles.editActions}>
                        <button
                          type="button"
                          className={styles.btn}
                          onClick={handleConfirmChangePlan}
                          disabled={changePlanBusy || Number(changePlanTargetId) === selectedRow.subscription.plan_id}
                        >
                          <i className="bi bi-check-lg" />
                          {changePlanBusy ? t("bo.adminAbonnements.applying") : t("bo.adminAbonnements.confirmChange")}
                        </button>
                        <button type="button" className={styles.btnOutline} onClick={() => setChangePlanOpen(false)}>
                          <i className="bi bi-x-lg" />
                          {t("bo.adminAbonnements.cancel")}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            }
          >
            <Banner banner={detailBanner} />

            <div className={styles.detailColumns}>
              <div>
                <div className={styles.detailBlockTitle}>
                  <i className="bi bi-person-fill" />
                  {t("bo.adminAbonnements.accountSection")}
                </div>
                <div className={styles.detailInfoList}>
                  <div className={styles.detailInfoRow}>
                    <span className={styles.detailInfoIcon}>
                      <i className="bi bi-person" />
                    </span>
                    <span className={styles.detailInfoBody}>
                      <span className={styles.detailInfoLabel}>{t("bo.adminAbonnements.nameLabel")}</span>
                      <span className={styles.detailInfoValue}>
                        {selectedRow.user.prenom} {selectedRow.user.nom}
                      </span>
                    </span>
                  </div>
                  <div className={styles.detailInfoRow}>
                    <span className={styles.detailInfoIcon}>
                      <i className="bi bi-envelope" />
                    </span>
                    <span className={styles.detailInfoBody}>
                      <span className={styles.detailInfoLabel}>{t("bo.adminAbonnements.detailEmailLabel")}</span>
                      <span className={styles.detailInfoValue}>{selectedRow.user.email}</span>
                    </span>
                  </div>
                  <div className={styles.detailInfoRow}>
                    <span className={styles.detailInfoIcon}>
                      <i className="bi bi-toggle2-on" />
                    </span>
                    <span className={styles.detailInfoBody}>
                      <span className={styles.detailInfoLabel}>{t("bo.adminAbonnements.detailAccountStatusLabel")}</span>
                      <span className={styles.detailInfoValue}>
                        {ACCOUNT_STATUS_LABELS[selectedRow.user.statut_compte] || selectedRow.user.statut_compte}
                      </span>
                    </span>
                  </div>
                </div>
              </div>
              <div>
                <div className={styles.detailBlockTitle}>
                  <i className="bi bi-credit-card-2-front-fill" />
                  {t("bo.adminAbonnements.subscriptionSection")}
                </div>
                <div className={styles.detailInfoList}>
                  <div className={styles.detailInfoRow}>
                    <span className={styles.detailInfoIcon}>
                      <i className="bi bi-tag" />
                    </span>
                    <span className={styles.detailInfoBody}>
                      <span className={styles.detailInfoLabel}>{t("bo.adminAbonnements.planLabel")}</span>
                      <span className={styles.detailInfoValue}>
                        {selectedRow.subscription.plan.name} ({selectedRow.subscription.plan.price} MAD)
                      </span>
                    </span>
                  </div>
                  <div className={styles.detailInfoRow}>
                    <span className={styles.detailInfoIcon}>
                      <i className="bi bi-calendar-check" />
                    </span>
                    <span className={styles.detailInfoBody}>
                      <span className={styles.detailInfoLabel}>{t("bo.adminAbonnements.startLabel")}</span>
                      <span className={styles.detailInfoValue}>{formatDate(selectedRow.subscription.start_date)}</span>
                    </span>
                  </div>
                  <div className={styles.detailInfoRow}>
                    <span className={styles.detailInfoIcon}>
                      <i className="bi bi-calendar-x" />
                    </span>
                    <span className={styles.detailInfoBody}>
                      <span className={styles.detailInfoLabel}>{t("bo.adminAbonnements.expirationLabel")}</span>
                      <span className={styles.detailInfoValue}>{formatDate(selectedRow.subscription.end_date)}</span>
                    </span>
                  </div>
                  {selectedRow.subscription.trial_start && (
                    <div className={styles.detailInfoRow}>
                      <span className={styles.detailInfoIcon}>
                        <i className="bi bi-hourglass-split" />
                      </span>
                      <span className={styles.detailInfoBody}>
                        <span className={styles.detailInfoLabel}>{t("bo.adminAbonnements.trialLabel")}</span>
                        <span className={styles.detailInfoValue}>
                          {formatDate(selectedRow.subscription.trial_start)} → {formatDate(selectedRow.subscription.trial_end)}
                        </span>
                        {(() => {
                          const trial = trialInfo(selectedRow.subscription);
                          if (!trial) return null;
                          return (
                            <span className={`${styles.trialPill} ${trialPillClass(trial.state)}`} style={{ marginTop: "0.4rem" }}>
                              {trial.state === "expired"
                                ? t("bo.adminAbonnements.trialExpiredPill")
                                : t("bo.adminAbonnements.trialDaysRemainingPill", { count: trial.daysRemaining })}
                            </span>
                          );
                        })()}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className={styles.detailBlockTitle}>
              <i className="bi bi-speedometer2" />
              {t("bo.adminAbonnements.usageVsLimits")}
            </div>
            {usageLoading && <p className={styles.empty}>{t("bo.adminAbonnements.loadingUsage")}</p>}
            {!usageLoading && usage && (
              <div className={styles.usageGrid}>
                {LIMIT_FIELDS.map((f) => {
                  const limit = selectedRow.subscription.plan[f.key];
                  const used = usage[LIMIT_TO_USAGE_KEY[f.key]];
                  const percent = limit === UNLIMITED ? null : Math.min(100, (used / Math.max(limit, 1)) * 100);
                  return (
                    <div className={styles.usageItem} key={f.key}>
                      <div className={styles.usageLabelRow}>
                        <span className={styles.usageLabelText}>
                          <span className={styles.usageIcon}>
                            <i className={`bi ${f.icon}`} />
                          </span>
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

          </Drawer>
        )}
      </div>
    </div>
  );
}
