import apiClient from "@/lib/apiClient";

export const AVIS_STATUS = { EN_ATTENTE: 1, PUBLIE: 2, REJETE: 3 };
export const AVIS_STATUS_LABELS = { 1: "En attente", 2: "Publié", 3: "Rejeté" };

export async function fetchAvis() {
  const { data } = await apiClient.get("/reviews/");
  return data;
}

export async function updateAvisStatut(avisId, statut) {
  const { data } = await apiClient.put(`/reviews/${avisId}`, { statut });
  return data;
}

export async function deleteAvis(avisId) {
  await apiClient.delete(`/reviews/${avisId}`);
}
