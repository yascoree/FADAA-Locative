import apiClient from "@/lib/apiClient";

export const DEMANDE_DEMO_STATUS = { NOUVELLE: 1, CONTACTEE: 2, EN_COURS: 3 };
export const DEMANDE_DEMO_STATUS_LABELS = { 1: "Nouvelle", 2: "Contactée", 3: "En cours" };

export async function createDemandeDemo({ nom, email, telephone, dateSouhaitee, message }) {
  const { data } = await apiClient.post("/demo-requests/", {
    nom,
    email,
    telephone,
    date_souhaitee: dateSouhaitee || null,
    message: message || null,
  });
  return data;
}

export async function fetchDemandesDemo() {
  const { data } = await apiClient.get("/demo-requests/");
  return data;
}

export async function updateDemandeDemoStatut(demandeId, statut) {
  const { data } = await apiClient.put(`/demo-requests/${demandeId}`, { statut });
  return data;
}
