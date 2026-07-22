import apiClient from "@/lib/apiClient";

export const RECLAMATION_STATUS = { EN_ATTENTE: 1, ACCEPTEE: 2, REJETEE: 3 };
export const RECLAMATION_STATUS_LABELS = { 1: "En attente", 2: "Acceptée", 3: "Rejetée" };

export async function fetchReclamations() {
  const { data } = await apiClient.get("/reclamations/");
  return data;
}

export async function createReclamation({ sujet, message }) {
  const { data } = await apiClient.post("/reclamations/", { sujet, message });
  return data;
}

export async function updateReclamationStatut(reclamationId, statut) {
  const { data } = await apiClient.put(`/reclamations/${reclamationId}`, { statut });
  return data;
}
