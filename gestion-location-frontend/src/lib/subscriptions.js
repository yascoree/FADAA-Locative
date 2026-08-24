import apiClient from "@/lib/apiClient";

export const SUBSCRIPTION_STATUS = {
  ACTIF: 1,
  SUSPENDU: 2,
  EXPIRE: 3,
  RESILIE: 4,
};

export const SUBSCRIPTION_STATUS_LABELS = {
  1: "Actif",
  2: "Suspendu",
  3: "Expiré",
  4: "Résilié",
};

export const UNLIMITED = -1;

export const LIMIT_FIELDS = {
  PROPRIETAIRE: [
    { key: "max_biens", label: "Biens maximum", icon: "bi-house-door" },
    { key: "max_lots", label: "Lots maximum", icon: "bi-grid-3x3-gap" },
    { key: "max_baux_actifs", label: "Baux actifs maximum", icon: "bi-file-earmark-text" },
    { key: "max_gestionnaires", label: "Gestionnaires maximum", icon: "bi-person-badge" },
    { key: "max_locataires", label: "Locataires maximum", icon: "bi-people" },
    { key: "max_quittances_mois", label: "Quittances / mois", icon: "bi-receipt" },
  ],
  AGENCE: [
    { key: "max_biens", label: "Biens maximum", icon: "bi-house-door" },
    { key: "max_lots", label: "Lots maximum", icon: "bi-grid-3x3-gap" },
    { key: "max_baux_actifs", label: "Baux actifs maximum", icon: "bi-file-earmark-text" },
    { key: "max_membres_agence", label: "Membres d'agence", icon: "bi-person-badge" },
    { key: "max_locataires", label: "Locataires maximum", icon: "bi-people" },
    { key: "max_quittances_mois", label: "Quittances / mois", icon: "bi-receipt" },
  ]
};

export const ALL_LIMIT_FIELDS = [
  ...new Map([...LIMIT_FIELDS.PROPRIETAIRE, ...LIMIT_FIELDS.AGENCE].map(item => [item.key, item])).values()
];

// Clé de limite -> clé du même compteur dans SubscriptionUsageRead (backend).
export const LIMIT_TO_USAGE_KEY = {
  max_biens: "biens",
  max_lots: "lots",
  max_baux_actifs: "baux_actifs",
  max_gestionnaires: "gestionnaires",
  max_locataires: "locataires",
  max_quittances_mois: "quittances_mois",
  max_membres_agence: "membres_agence",
};

export function formatLimit(value) {
  return value === UNLIMITED ? "∞" : value;
}

// Partagées entre la vue catalogue admin (backoffice/admin/abonnements) et le
// sélecteur de plan de la popup de blocage (components/PlanLimitPopup) — même
// logique d'affichage des cartes de plan des deux côtés, pas une copie visuelle.
export function capitalizeTone(color) {
  return color ? color[0].toUpperCase() + color.slice(1) : "Olive";
}

export function billingLabel(plan) {
  if (plan.is_trial) return `${plan.duration_days} jour${plan.duration_days > 1 ? "s" : ""} d'essai`;
  if (plan.duration_days >= 28 && plan.duration_days <= 31) return "Facturation mensuelle";
  if (plan.duration_days >= 360 && plan.duration_days <= 370) return "Facturation annuelle";
  return `Cycle de ${plan.duration_days} jours`;
}

export function priceUnit(plan) {
  if (plan.is_trial) return null;
  if (plan.duration_days >= 28 && plan.duration_days <= 31) return "/ mois";
  if (plan.duration_days >= 360 && plan.duration_days <= 370) return "/ an";
  return null;
}

export function planIcon(plan, isPopular) {
  if (plan.is_trial) return "bi-clock-history";
  if (isPopular) return "bi-lightning-charge-fill";
  return "bi-building-fill";
}

// Le moins cher des plans payants (hors essai) — sert à placer le ruban
// "Populaire" au même endroit dans le catalogue admin et le sélecteur de la
// popup de blocage.
export function cheapestPaidPlan(plans) {
  return [...plans].filter((p) => !p.is_trial).sort((a, b) => Number(a.price) - Number(b.price))[0] || null;
}

// Le backend sérialise ses dates en UTC "naïf" (ex: "2026-08-31T10:00:00",
// sans "Z" ni décalage — voir datetime.utcnow() côté Python). `new Date(...)`
// interprète une chaîne sans fuseau comme une heure LOCALE au navigateur : pour
// un utilisateur dans un fuseau différent d'UTC, ça avance ou retarde de
// plusieurs heures le calcul par rapport à l'instant réel — assez pour déclarer
// un essai "terminé" avant l'heure (ou l'inverse). On force explicitement
// l'UTC avant toute comparaison à "maintenant".
function parseUtcDate(value) {
  if (!value) return null;
  const hasTimezone = /Z$|[+-]\d{2}:\d{2}$/.test(value);
  return new Date(hasTimezone ? value : `${value}Z`);
}

// Jours restants d'essai + niveau d'urgence — utilisé par le dashboard
// propriétaire et la section Abonnement des Paramètres.
//
// Se base sur `end_date`, pas `trial_end` : `end_date` est le seul champ qui
// gouverne réellement le blocage (voir isSubscriptionUsable ci-dessous et
// app.services.subscription_service.is_active côté backend). `trial_end` ne
// reflète que la date de l'octroi initial de l'essai et peut diverger de
// `end_date` — par ex. après une extension manuelle par l'admin (extend() ne
// touche que end_date, jamais trial_end). Si on affichait le compte à rebours
// à partir de trial_end, le badge de statut ("Expiré") et la pastille ("X j
// restants") pourraient se contredire alors même que les deux décrivent le
// même abonnement.
// Jours restants avant end_date (négatif si déjà dépassée), utilisable pour un
// essai ou un plan payant — voir trialInfo (essai) et SubscriptionStatusBanner
// (bannière globale, essai ou payant) qui s'appuient dessus.
export function subscriptionDaysRemaining(subscription) {
  const referenceDate = subscription?.end_date || subscription?.trial_end;
  if (!referenceDate) return null;
  return Math.ceil((parseUtcDate(referenceDate) - new Date()) / 86400000);
}

export function trialInfo(subscription) {
  if (!subscription?.plan?.is_trial) return null;
  const daysRemaining = subscriptionDaysRemaining(subscription);
  if (daysRemaining === null) return null;
  if (daysRemaining < 0) return { state: "expired", daysRemaining: 0 };
  if (daysRemaining <= 3) return { state: "warning", daysRemaining };
  return { state: "active", daysRemaining };
}

// Le champ status en base ne reflète l'expiration qu'une fois par jour (job
// planifié à 8h UTC, voir app.scheduler côté backend) : tant qu'il n'est pas
// passé, un abonnement/essai dont la end_date est dépassée est encore marqué
// ACTIF. On affiche donc "Expiré" dès que isSubscriptionUsable(subscription)
// est faux, même si le statut n'a pas encore été basculé en base.
export function subscriptionStatusLabel(subscription, blocked) {
  if (subscription.status !== SUBSCRIPTION_STATUS.ACTIF) {
    return SUBSCRIPTION_STATUS_LABELS[subscription.status] || "Inactif";
  }
  return blocked ? "Expiré" : "Actif";
}

// Même règle que le backend (voir app.services.subscription_service.is_active) :
// statut ACTIF et end_date pas encore dépassée. Sert à bloquer les actions de
// création côté front avant même que le job quotidien n'ait basculé le statut.
export function isSubscriptionUsable(subscription) {
  if (!subscription) return false;
  if (subscription.status !== SUBSCRIPTION_STATUS.ACTIF) return false;
  if (subscription.end_date && parseUtcDate(subscription.end_date) < new Date()) return false;
  return true;
}

// Palette fermée pour la carte plan (les 4 teintes --tone-* de globals.css) : on
// laisse choisir laquelle, pas une couleur libre, pour rester cohérent avec la charte.
export const PLAN_COLOR_OPTIONS = [
  { value: "olive", label: "Olive" },
  { value: "navy", label: "Sauge" },
  { value: "charcoal", label: "Forêt" },
  { value: "terracotta", label: "Menthe" },
];

export async function fetchUsers() {
  const { data } = await apiClient.get("/users/");
  return data;
}

export async function fetchSubscriptionByOwner(ownerId) {
  const { data } = await apiClient.get(`/subscriptions/by-owner/${ownerId}`);
  return data;
}

export async function fetchMySubscription() {
  const { data } = await apiClient.get("/subscriptions/me");
  return data;
}

export async function fetchMyUsage() {
  const { data } = await apiClient.get("/subscriptions/me/usage");
  return data;
}

export async function fetchSubscriptions() {
  const { data } = await apiClient.get("/subscriptions/", { params: { limit: 500 } });
  return data;
}

export async function fetchOwnerUsage(ownerId) {
  const { data } = await apiClient.get(`/subscriptions/by-owner/${ownerId}/usage`);
  return data;
}

export async function assignSubscription(payload) {
  const { data } = await apiClient.post("/subscriptions/assign", payload);
  return data;
}

export async function suspendSubscription(subscriptionId) {
  const { data } = await apiClient.post(`/subscriptions/${subscriptionId}/suspend`);
  return data;
}

export async function reactivateSubscription(subscriptionId) {
  const { data } = await apiClient.post(`/subscriptions/${subscriptionId}/reactivate`);
  return data;
}

export async function cancelSubscription(subscriptionId) {
  const { data } = await apiClient.post(`/subscriptions/${subscriptionId}/cancel`);
  return data;
}

export async function extendSubscription(subscriptionId, endDate) {
  const { data } = await apiClient.put(`/subscriptions/${subscriptionId}/extend`, { end_date: endDate });
  return data;
}

export async function fetchPlans() {
  const { data } = await apiClient.get("/subscription-plans/");
  return data;
}

export async function createPlan(payload) {
  const { data } = await apiClient.post("/subscription-plans/", payload);
  return data;
}

export async function updatePlan(planId, payload) {
  const { data } = await apiClient.put(`/subscription-plans/${planId}`, payload);
  return data;
}

export async function deletePlan(planId) {
  await apiClient.delete(`/subscription-plans/${planId}`);
}

export async function setPlanActive(planId, isActive) {
  const { data } = await apiClient.post(`/subscription-plans/${planId}/${isActive ? "activate" : "deactivate"}`);
  return data;
}

// Plans consultables par un propriétaire (pas seulement l'admin) — alimente la
// popup de choix de plan (voir components/PlanLimitPopup.jsx).
export async function fetchActivePlans(targetType = undefined) {
  const params = targetType ? { target_type: targetType } : {};
  const { data } = await apiClient.get("/subscription-plans/active", { params });
  return data;
}

export const PLAN_CHANGE_REQUEST_STATUS = {
  EN_ATTENTE: 1,
  APPROUVEE: 2,
  REJETEE: 3,
};

export const PLAN_CHANGE_REQUEST_STATUS_LABELS = {
  1: "En attente",
  2: "Approuvée",
  3: "Rejetée",
};

export async function createPlanChangeRequest({ planId, message }) {
  const { data } = await apiClient.post("/plan-change-requests/", { plan_id: planId, message: message || null });
  return data;
}

export async function fetchMyPlanChangeRequest() {
  const { data } = await apiClient.get("/plan-change-requests/me");
  return data;
}

export async function fetchPlanChangeRequests() {
  const { data } = await apiClient.get("/plan-change-requests/");
  return data;
}

export async function approvePlanChangeRequest(requestId) {
  const { data } = await apiClient.post(`/plan-change-requests/${requestId}/approve`);
  return data;
}

export async function rejectPlanChangeRequest(requestId) {
  const { data } = await apiClient.post(`/plan-change-requests/${requestId}/reject`);
  return data;
}
