import apiClient from "@/lib/apiClient";

export const PARTENAIRE_STATUS = { ACTIF: 1, INACTIF: 2 };
export const PARTENAIRE_STATUS_LABELS = { 1: "Actif", 2: "Inactif" };

export async function fetchPartenaires() {
  const { data } = await apiClient.get("/partners/");
  return data;
}

export async function createPartenaire(payload) {
  const { data } = await apiClient.post("/partners/", payload);
  return data;
}

export async function updatePartenaire(partenaireId, payload) {
  const { data } = await apiClient.put(`/partners/${partenaireId}`, payload);
  return data;
}

export async function deletePartenaire(partenaireId) {
  await apiClient.delete(`/partners/${partenaireId}`);
}

export async function uploadPartenaireLogo(partenaireId, file) {
  const formData = new FormData();
  formData.append("file", file);
  const { data } = await apiClient.post(`/partners/${partenaireId}/logo`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}
