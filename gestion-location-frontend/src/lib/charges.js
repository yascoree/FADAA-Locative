import apiClient from "@/lib/apiClient";

export async function fetchCharges({ bienId, lotId } = {}) {
  const params = {};
  if (bienId) params.bien_id = bienId;
  if (lotId) params.lot_id = lotId;
  const { data } = await apiClient.get("/charges/", { params });
  return data;
}

export async function createCharge({ bienId, lotId, libelle, montant, dateCharge, description }) {
  const { data } = await apiClient.post("/charges/", {
    bien_id: bienId || null,
    lot_id: lotId || null,
    libelle,
    montant: Number(montant),
    date_charge: dateCharge,
    description: description || null,
  });
  return data;
}

export async function deleteCharge(chargeId) {
  await apiClient.delete(`/charges/${chargeId}`);
}
