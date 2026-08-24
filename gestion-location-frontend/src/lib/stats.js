import apiClient from "@/lib/apiClient";

/** Forme de la réponse dépendante du rôle de l'appelant (voir app/api/stats.py) :
 * ADMINISTRATEUR -> AdminDashboardStats, PROPRIETAIRE -> ProprietaireDashboardStats,
 * GESTIONNAIRE -> GestionnaireDashboardStats, LOCATAIRE -> LocataireDashboardStats. */
export async function fetchDashboardStats(params = {}) {
  const { data } = await apiClient.get("/stats/dashboard", { params });
  return data;
}

/** Courbe de revenus (12 derniers mois, année vs année, par bien, par mode de
 * paiement, taux de recouvrement) — propriétaire ou gestionnaire uniquement. */
export async function fetchRevenueStats(params = {}) {
  const { data } = await apiClient.get("/stats/revenue", { params });
  return data;
}
