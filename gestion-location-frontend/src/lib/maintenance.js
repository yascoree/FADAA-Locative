import apiClient from "@/lib/apiClient";

export const MAINTENANCE_STATUS = { NOUVELLE: 1, EN_COURS: 2, RESOLUE: 3, REJETEE: 4 };
export const MAINTENANCE_STATUS_LABELS = {
  1: "Nouvelle",
  2: "En cours",
  3: "Résolue",
  4: "Rejetée",
};

export async function fetchDemandesMaintenance() {
  const { data } = await apiClient.get("/maintenance-requests/");
  return data;
}

export async function createDemandeMaintenance({ bailId, titre, description }) {
  const { data } = await apiClient.post("/maintenance-requests/", {
    bail_id: bailId,
    titre,
    description,
  });
  return data;
}

export async function updateDemandeMaintenance(demandeId, { statut, reponse }) {
  const { data } = await apiClient.put(`/maintenance-requests/${demandeId}`, {
    statut,
    reponse,
  });
  return data;
}
