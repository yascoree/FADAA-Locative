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

// Une entrée par limite affichée : clé du champ API + libellé français + icône.
export const LIMIT_FIELDS = [
  { key: "max_biens", label: "Biens maximum", icon: "bi-house-door" },
  { key: "max_lots", label: "Lots maximum", icon: "bi-grid-3x3-gap" },
  { key: "max_baux_actifs", label: "Baux actifs maximum", icon: "bi-file-earmark-text" },
  { key: "max_gestionnaires", label: "Gestionnaires maximum", icon: "bi-person-badge" },
  { key: "max_locataires", label: "Locataires maximum", icon: "bi-people" },
  { key: "max_quittances_mois", label: "Quittances / mois", icon: "bi-receipt" },
];

// Clé de limite -> clé du même compteur dans SubscriptionUsageRead (backend).
export const LIMIT_TO_USAGE_KEY = {
  max_biens: "biens",
  max_lots: "lots",
  max_baux_actifs: "baux_actifs",
  max_gestionnaires: "gestionnaires",
  max_locataires: "locataires",
  max_quittances_mois: "quittances_mois",
};

export function formatLimit(value) {
  return value === UNLIMITED ? "∞" : value;
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

export async function assignSubscription(ownerId, planId) {
  const { data } = await apiClient.post("/subscriptions/assign", { owner_id: ownerId, plan_id: planId });
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
