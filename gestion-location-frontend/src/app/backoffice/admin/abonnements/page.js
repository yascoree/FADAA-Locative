"use client";

import { useEffect, useMemo, useState } from "react";
import { extractErrorMessage, API_BASE_URL } from "@/lib/apiClient";
import {
  SUBSCRIPTION_STATUS,
  SUBSCRIPTION_STATUS_LABELS,
  UNLIMITED,
  LIMIT_FIELDS,
  LIMIT_TO_USAGE_KEY,
  formatLimit,
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
  setPlanActive,
} from "@/lib/subscriptions";
import StatCard from "@/components/StatCard";
import CountUp from "@/components/CountUp";
import styles from "../admin.module.css";

function Banner({ banner }) {
  if (!banner) return null;
  return (
    <div className={`${styles.banner} ${banner.type === "success" ? styles.bannerSuccess : styles.bannerError}`}>
      {banner.message}
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

const PLAN_TONE_CYCLE = ["Olive", "Navy", "Charcoal"];

function planTone(plan, nonTrialIndex) {
  if (plan.is_trial) return "Terracotta";
  return PLAN_TONE_CYCLE[nonTrialIndex % PLAN_TONE_CYCLE.length];
}

function planIcon(plan, isPopular) {
  if (plan.is_trial) return "bi-clock-history";
  if (isPopular) return "bi-lightning-charge-fill";
  return "bi-building-fill";
}

function billingLabel(plan) {
  if (plan.is_trial) return `${plan.duration_days} jour${plan.duration_days > 1 ? "s" : ""} d'essai`;
  if (plan.duration_days >= 28 && plan.duration_days <= 31) return "Facturation mensuelle";
  if (plan.duration_days >= 360 && plan.duration_days <= 370) return "Facturation annuelle";
  return `Cycle de ${plan.duration_days} jours`;
}

function priceUnit(plan) {
  if (plan.is_trial) return null;
  if (plan.duration_days >= 28 && plan.duration_days <= 31) return "/ mois";
  if (plan.duration_days >= 360 && plan.duration_days <= 370) return "/ an";
  return null;
}

function usersLine(impactCount, plan) {
  const word = impactCount > 1 ? "utilisateurs" : "utilisateur";
  return `${impactCount} ${word}${plan.is_trial ? " en essai" : ""}`;
}

const ACCOUNT_STATUS_LABELS = {
  1: "Actif",
  2: "Invité en attente",
  3: "Désactivé",
};

function emptyLimits(fill) {
  return Object.fromEntries(LIMIT_FIELDS.map((f) => [f.key, fill]));
}

function planToDraft(plan) {
  return {
    name: plan.name,
    description: plan.description || "",
    price: String(plan.price),
    duration_days: String(plan.duration_days),
    limits: Object.fromEntries(LIMIT_FIELDS.map((f) => [f.key, plan[f.key] === UNLIMITED ? "0" : String(plan[f.key])])),
    unlimited: Object.fromEntries(LIMIT_FIELDS.map((f) => [f.key, plan[f.key] === UNLIMITED])),
  };
}

function diffEntries(plan, draft) {
  const entries = [];
  if (draft.name !== plan.name) entries.push({ label: "Nom", before: plan.name, after: draft.name });
  if ((draft.description || "") !== (plan.description || "")) {
    entries.push({ label: "Description", before: plan.description || "—", after: draft.description || "—" });
  }
  if (Number(draft.price) !== Number(plan.price)) {
    entries.push({ label: "Prix", before: `${plan.price} MAD`, after: `${draft.price} MAD` });
  }
  if (Number(draft.duration_days) !== Number(plan.duration_days)) {
    entries.push({ label: "Durée", before: `${plan.duration_days} j`, after: `${draft.duration_days} j` });
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

function trialInfo(subscription) {
  if (!subscription.plan?.is_trial || !subscription.trial_end) return null;
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

function usageFillClass(percent) {
  if (percent === null) return styles.usageFill;
  if (percent >= 100) return `${styles.usageFill} ${styles.usageFillDanger}`;
  if (percent >= 75) return `${styles.usageFill} ${styles.usageFillWarning}`;
  return styles.usageFill;
}

export default function AdminAbonnementsPage() {
  const [users, setUsers] = useState([]);
  const [plans, setPlans] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const [editingPlanId, setEditingPlanId] = useState(null);
  const [editDraft, setEditDraft] = useState(null);
  const [planSaving, setPlanSaving] = useState(false);
  const [planBanner, setPlanBanner] = useState(null);

  const [newPlan, setNewPlan] = useState({
    name: "",
    description: "",
    price: "",
    duration_days: "30",
    is_trial: false,
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

  const [changePlanOpen, setChangePlanOpen] = useState(false);
  const [changePlanTargetId, setChangePlanTargetId] = useState("");
  const [changePlanBusy, setChangePlanBusy] = useState(false);
  const [changePlanBanner, setChangePlanBanner] = useState(null);

  useEffect(() => {
    async function init() {
      setIsLoading(true);
      try {
        const [userList, planList, subList] = await Promise.all([fetchUsers(), fetchPlans(), fetchSubscriptions()]);
        setUsers(userList);
        setPlans(planList);
        setSubscriptions(subList);
      } catch (err) {
        setLoadError(extractErrorMessage(err));
      } finally {
        setIsLoading(false);
      }
    }
    init();
  }, []);

  const activePlans = useMemo(() => plans.filter((p) => p.is_active), [plans]);

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

  const planTones = useMemo(() => {
    const map = {};
    let nonTrialIndex = 0;
    plans.forEach((plan) => {
      map[plan.id] = planTone(plan, nonTrialIndex);
      if (!plan.is_trial) nonTrialIndex += 1;
    });
    return map;
  }, [plans]);

  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter(({ subscription, user }) => {
      if (term) {
        const matches =
          `${user.prenom} ${user.nom}`.toLowerCase().includes(term) || user.email.toLowerCase().includes(term);
        if (!matches) return false;
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
      };
      LIMIT_FIELDS.forEach((f) => {
        payload[f.key] = editDraft.unlimited[f.key] ? UNLIMITED : Number(editDraft.limits[f.key] || 0);
      });
      const updated = await updatePlan(plan.id, payload);
      setPlans((prev) => prev.map((p) => (p.id === plan.id ? updated : p)));
      setSubscriptions((prev) => prev.map((s) => (s.plan_id === plan.id ? { ...s, plan: updated } : s)));
      setEditingPlanId(null);
      setEditDraft(null);
      setPlanBanner({ type: "success", message: `Plan "${updated.name}" mis à jour.` });
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
        limits: emptyLimits("0"),
        unlimited: emptyLimits(true),
      });
      setCreateBanner({ type: "success", message: `Plan "${plan.name}" créé.` });
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
      setDetailBanner({ type: "success", message: wasSuspended ? "Abonnement réactivé." : "Abonnement suspendu." });
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
      setDetailBanner({ type: "success", message: "Abonnement résilié." });
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
      setDetailBanner({ type: "success", message: `Plan changé pour ${updated.plan.name}.` });
    } catch (err) {
      setChangePlanBanner({ type: "error", message: extractErrorMessage(err) });
    } finally {
      setChangePlanBusy(false);
    }
  }

  const changePlanTarget = plans.find((p) => p.id === Number(changePlanTargetId)) || null;

  if (isLoading) {
    return <p>Chargement...</p>;
  }

  return (
    <div>
      <Banner banner={loadError ? { type: "error", message: loadError } : null} />

      {/* ---- Stats ---- */}
      <div className={styles.section}>
        <div className={styles.statsGrid}>
          <StatCard icon="bi-people-fill" tone="primary" label="Utilisateurs" value={<CountUp value={stats.totalUsers} />} />
          <StatCard
            icon="bi-credit-card-fill"
            tone="accent"
            label="Abonnements actifs"
            value={<CountUp value={stats.activeSubs} />}
          />
          <StatCard
            icon="bi-hourglass-split"
            tone="warning"
            label="Free Trial actifs"
            value={<CountUp value={stats.trialActive} />}
          />
          <StatCard
            icon="bi-exclamation-octagon-fill"
            tone="danger"
            label="Abonnements expirés"
            value={<CountUp value={stats.expiredSubs} />}
          />
        </div>
      </div>

      {/* ---- Plans d'abonnement ---- */}
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Plans d&apos;abonnement</h2>
        <p className={styles.sectionSubtitle}>
          Chaque plan définit des limites d&apos;usage (biens, lots, baux actifs, gestionnaires, locataires,
          quittances/mois). -1 signifie illimité.
        </p>
        <Banner banner={planBanner} />

        <div className={styles.plansGrid}>
          {(() => {
            const cheapestPaid = plans
              .filter((p) => !p.is_trial)
              .sort((a, b) => a.price - b.price)[0];
            return plans.map((plan) => {
              const isEditing = editingPlanId === plan.id;
              const impactCount = subscriptions.filter((s) => s.plan_id === plan.id).length;
              const tone = planTones[plan.id];
              const isPopular = !!cheapestPaid && plan.id === cheapestPaid.id;
              return (
                <div
                  key={plan.id}
                  className={`${styles.planCard} ${styles[`planCard${tone}`]} ${
                    plan.is_active ? "" : styles.planCardInactive
                  } ${isEditing ? styles.planCardEditing : ""}`}
                >
                <div className={styles.planCardHeader}>
                  {isPopular && <span className={styles.planRibbon}>Populaire</span>}

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
                        {plan.is_active ? "Actif" : "Inactif"}
                      </button>
                      <button type="button" className={styles.planModifyLink} onClick={() => startEdit(plan)}>
                        Modifier
                      </button>
                    </div>
                    <div className={styles.planUsersLine}>{usersLine(impactCount, plan)}</div>
                  </>
                )}

                {isEditing && editDraft && (
                  <div className={styles.editForm}>
                    <div className={styles.editGrid}>
                      <label className={styles.field}>
                        Nom
                        <input
                          type="text"
                          value={editDraft.name}
                          onChange={(e) => setEditDraft((d) => ({ ...d, name: e.target.value }))}
                        />
                      </label>
                      <label className={styles.field}>
                        Description
                        <input
                          type="text"
                          value={editDraft.description}
                          onChange={(e) => setEditDraft((d) => ({ ...d, description: e.target.value }))}
                        />
                      </label>
                      <label className={styles.field}>
                        Prix (MAD)
                        <input
                          type="number"
                          step="0.01"
                          value={editDraft.price}
                          onChange={(e) => setEditDraft((d) => ({ ...d, price: e.target.value }))}
                        />
                      </label>
                      <label className={styles.field}>
                        Durée (jours)
                        <input
                          type="number"
                          value={editDraft.duration_days}
                          onChange={(e) => setEditDraft((d) => ({ ...d, duration_days: e.target.value }))}
                        />
                      </label>
                      {LIMIT_FIELDS.map((f) => (
                        <label className={styles.field} key={f.key}>
                          {f.label}
                          <input
                            type="number"
                            min="0"
                            disabled={editDraft.unlimited[f.key]}
                            value={editDraft.limits[f.key]}
                            onChange={(e) =>
                              setEditDraft((d) => ({ ...d, limits: { ...d.limits, [f.key]: e.target.value } }))
                            }
                          />
                          <span className={`${styles.field} ${styles.checkboxLabel}`}>
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
                            ∞ Illimité
                          </span>
                        </label>
                      ))}
                    </div>

                    {(() => {
                      const entries = diffEntries(plan, editDraft);
                      if (entries.length === 0) return null;
                      return (
                        <div className={styles.diffBox}>
                          <div className={styles.diffTitle}>
                            <i className="bi bi-arrow-left-right" />
                            Changements
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
                              ? "Aucun compte n'est actuellement sur ce plan."
                              : `${impactCount} compte(s) sont actuellement sur ce plan : les nouvelles limites s'appliqueront immédiatement.`}
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
                        {planSaving ? "Enregistrement..." : "Enregistrer"}
                      </button>
                      <button type="button" className={styles.btnOutline} onClick={cancelEdit} disabled={planSaving}>
                        <i className="bi bi-x-lg" />
                        Annuler
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

        {/* ---- Créer un plan ---- */}
        <form className={styles.newPlanForm} onSubmit={handleCreatePlan}>
          <h3 className={styles.cardTitle}>
            <i className="bi bi-plus-circle-fill" style={{ color: "var(--primary)" }} />
            Créer un plan
          </h3>
          <Banner banner={createBanner} />
          <div className={styles.newPlanGrid}>
            <label className={styles.field}>
              Nom
              <input
                type="text"
                value={newPlan.name}
                onChange={(e) => setNewPlan((p) => ({ ...p, name: e.target.value }))}
                required
              />
            </label>
            <label className={styles.field}>
              Description
              <input
                type="text"
                value={newPlan.description}
                onChange={(e) => setNewPlan((p) => ({ ...p, description: e.target.value }))}
              />
            </label>
            <label className={styles.field}>
              Prix (MAD)
              <input
                type="number"
                step="0.01"
                value={newPlan.price}
                onChange={(e) => setNewPlan((p) => ({ ...p, price: e.target.value }))}
                required
              />
            </label>
            <label className={styles.field}>
              Durée (jours)
              <input
                type="number"
                value={newPlan.duration_days}
                onChange={(e) => setNewPlan((p) => ({ ...p, duration_days: e.target.value }))}
                required
              />
            </label>
            <label className={`${styles.field} ${styles.checkboxLabel}`}>
              <input
                type="checkbox"
                checked={newPlan.is_trial}
                onChange={(e) => setNewPlan((p) => ({ ...p, is_trial: e.target.checked }))}
              />
              Plan d&apos;essai
            </label>
            {LIMIT_FIELDS.map((f) => (
              <label className={styles.field} key={f.key}>
                {f.label}
                <input
                  type="number"
                  min="0"
                  disabled={newPlan.unlimited[f.key]}
                  value={newPlan.limits[f.key]}
                  onChange={(e) =>
                    setNewPlan((p) => ({ ...p, limits: { ...p.limits, [f.key]: e.target.value } }))
                  }
                />
                <span className={`${styles.field} ${styles.checkboxLabel}`}>
                  <input
                    type="checkbox"
                    checked={newPlan.unlimited[f.key]}
                    onChange={(e) =>
                      setNewPlan((p) => ({ ...p, unlimited: { ...p.unlimited, [f.key]: e.target.checked } }))
                    }
                  />
                  ∞ Illimité
                </span>
              </label>
            ))}
          </div>
          <button type="submit" className={styles.btn} disabled={createBusy}>
            <i className="bi bi-plus-lg" />
            {createBusy ? "Création..." : "Créer un plan"}
          </button>
        </form>
      </div>

      {/* ---- Abonnements par compte ---- */}
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>
          <i className="bi bi-table" style={{ marginRight: "0.5rem", color: "var(--primary)" }} />
          Abonnements par compte
        </h2>
        <p className={styles.sectionSubtitle}>
          {filteredRows.length} compte(s) affiché(s) sur {rows.length}.
        </p>

        <div className={styles.filtersRow}>
          <input
            type="text"
            placeholder="Rechercher par nom ou e-mail..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCurrentPage(1);
            }}
          />
          <select
            value={planFilter}
            onChange={(e) => {
              setPlanFilter(e.target.value);
              setCurrentPage(1);
            }}
          >
            <option value="">Tous les plans</option>
            {plans.map((plan) => (
              <option key={plan.id} value={plan.id}>
                {plan.name}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setCurrentPage(1);
            }}
          >
            <option value="">Tous les statuts</option>
            {Object.entries(SUBSCRIPTION_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <label className={styles.checkFilter}>
            <input
              type="checkbox"
              checked={trialOnly}
              onChange={(e) => {
                setTrialOnly(e.target.checked);
                setCurrentPage(1);
              }}
            />
            Free Trial uniquement
          </label>
          <label className={styles.checkFilter}>
            <input
              type="checkbox"
              checked={expiredOnly}
              onChange={(e) => {
                setExpiredOnly(e.target.checked);
                setCurrentPage(1);
              }}
            />
            Expirés uniquement
          </label>
        </div>

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Utilisateur</th>
                <th>Email</th>
                <th>Plan</th>
                <th>Statut</th>
                <th>Début</th>
                <th>Expiration</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.length === 0 && (
                <tr>
                  <td colSpan={7} className={styles.empty}>
                    Aucun compte ne correspond à ces critères.
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
                      {subscription.plan.name}
                      {trial && (
                        <span className={`${styles.trialPill} ${trialPillClass(trial.state)}`}>
                          {trial.state === "expired" ? "Trial expiré" : `${trial.daysRemaining} j restants`}
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
                          title="Voir le détail"
                        >
                          <i className="bi bi-eye" />
                        </button>
                        <button
                          type="button"
                          className={styles.iconBtn}
                          onClick={() => handleQuickSuspendToggle(subscription)}
                          title={isSuspended ? "Réactiver" : "Suspendre"}
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
                Page {safePage} / {totalPages} · {filteredRows.length} compte(s)
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

        {/* ---- Détail de l'abonnement (Voir) ---- */}
        {selectedRow && (
          <div className={styles.detailCard}>
            <div className={styles.detailHeader}>
              <h3 className={styles.detailTitle}>
                <i className="bi bi-person-vcard-fill" style={{ color: "var(--primary)" }} />
                Détail de l&apos;abonnement — {selectedRow.user.prenom} {selectedRow.user.nom}
              </h3>
              <button type="button" className={styles.btnOutline} onClick={() => selectRow(null)}>
                <i className="bi bi-x-lg" />
                Fermer
              </button>
            </div>

            <Banner banner={detailBanner} />

            <div className={styles.detailColumns}>
              <div>
                <div className={styles.detailBlockTitle}>
                  <i className="bi bi-person-fill" />
                  Compte
                </div>
                <div className={styles.detailLine}>
                  <strong>Nom :</strong> {selectedRow.user.prenom} {selectedRow.user.nom}
                </div>
                <div className={styles.detailLine}>
                  <strong>Email :</strong> {selectedRow.user.email}
                </div>
                <div className={styles.detailLine}>
                  <strong>Statut du compte :</strong>{" "}
                  {ACCOUNT_STATUS_LABELS[selectedRow.user.statut_compte] || selectedRow.user.statut_compte}
                </div>
              </div>
              <div>
                <div className={styles.detailBlockTitle}>
                  <i className="bi bi-credit-card-2-front-fill" />
                  Abonnement
                </div>
                <div className={styles.detailLine}>
                  <strong>Plan :</strong> {selectedRow.subscription.plan.name} ({selectedRow.subscription.plan.price} MAD)
                </div>
                <div className={styles.detailLine}>
                  <strong>Statut :</strong>{" "}
                  <span className={`${styles.badge} ${badgeClass(selectedRow.subscription.status)}`}>
                    {SUBSCRIPTION_STATUS_LABELS[selectedRow.subscription.status]}
                  </span>
                </div>
                <div className={styles.detailLine}>
                  <strong>Début :</strong> {formatDate(selectedRow.subscription.start_date)}
                </div>
                <div className={styles.detailLine}>
                  <strong>Expiration :</strong> {formatDate(selectedRow.subscription.end_date)}
                </div>
                {selectedRow.subscription.trial_start && (
                  <div className={styles.detailLine}>
                    <strong>Essai :</strong> {formatDate(selectedRow.subscription.trial_start)} →{" "}
                    {formatDate(selectedRow.subscription.trial_end)}
                    {(() => {
                      const trial = trialInfo(selectedRow.subscription);
                      if (!trial) return null;
                      return (
                        <span className={`${styles.trialPill} ${trialPillClass(trial.state)}`}>
                          {trial.state === "expired" ? "TRIAL — Expiré" : `${trial.daysRemaining} jour(s) restant(s)`}
                        </span>
                      );
                    })()}
                  </div>
                )}
              </div>
            </div>

            <div className={styles.detailBlockTitle}>
              <i className="bi bi-speedometer2" />
              Usage vs limites du plan
            </div>
            {usageLoading && <p className={styles.empty}>Chargement de l&apos;usage...</p>}
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

            <div className={styles.detailActions}>
              <button type="button" className={styles.btnLink} onClick={handleDetailSuspendToggle}>
                <i className={`bi ${selectedRow.subscription.status === SUBSCRIPTION_STATUS.SUSPENDU ? "bi-play-circle" : "bi-pause-circle"}`} />
                {selectedRow.subscription.status === SUBSCRIPTION_STATUS.SUSPENDU
                  ? "Réactiver l'abonnement"
                  : "Suspendre l'abonnement"}
              </button>
              {selectedRow.subscription.status !== SUBSCRIPTION_STATUS.RESILIE && (
                <button type="button" className={`${styles.btnLink} ${styles.btnLinkDanger}`} onClick={handleDetailCancel}>
                  <i className="bi bi-x-octagon" />
                  Annuler l&apos;abonnement
                </button>
              )}
              <button
                type="button"
                className={styles.btnOutline}
                onClick={() => setChangePlanOpen((v) => !v)}
                style={{ marginLeft: "auto" }}
              >
                <i className="bi bi-arrow-left-right" />
                Changer le plan
              </button>
            </div>

            {changePlanOpen && (
              <div className={styles.changePlanPanel}>
                <Banner banner={changePlanBanner} />
                <div className={styles.changePlanRow}>
                  <span>Plan actuel : {selectedRow.subscription.plan.name}</span>
                  <i className="bi bi-arrow-right" />
                  <select value={changePlanTargetId} onChange={(e) => setChangePlanTargetId(e.target.value)}>
                    {activePlans.map((plan) => (
                      <option key={plan.id} value={plan.id}>
                        {plan.name}
                      </option>
                    ))}
                  </select>
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
                    {changePlanBusy ? "Application..." : "Confirmer le changement"}
                  </button>
                  <button type="button" className={styles.btnOutline} onClick={() => setChangePlanOpen(false)}>
                    <i className="bi bi-x-lg" />
                    Annuler
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
