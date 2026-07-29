import apiClient from "@/lib/apiClient";

// Le bien (immeuble/propriété) ne porte plus de notion d'occupation — un bien
// peut avoir plusieurs lots dans des états différents. L'occupation se lit sur
// le Lot (LOT_STATUS), automatiquement synchronisé avec ses baux.
export const BIEN_STATUS = { ACTIF: 1, INACTIF: 2, ARCHIVE: 3 };
export const BIEN_STATUS_LABELS = { 1: "Actif", 2: "Inactif", 3: "Archivé" };

// Type général de l'actif loué. Détermine les sous-catégories (Categorie)
// proposables sur les Lots de ce bien — voir fetchCategories(typeBien).
export const TYPE_BIEN = { IMMOBILIER: 1, VEHICULE: 2, MATERIEL: 3, AUTRE: 4 };
export const TYPE_BIEN_LABELS = { 1: "Immobilier", 2: "Véhicule", 3: "Matériel", 4: "Autre" };

export const LOT_STATUS = { DISPONIBLE: 1, LOUE: 2, EN_MAINTENANCE: 3, HORS_SERVICE: 4 };
export const LOT_STATUS_LABELS = { 1: "Disponible", 2: "Loué", 3: "En maintenance", 4: "Hors service" };

export const BAIL_STATUS = { EN_ATTENTE: 1, ACTIF: 2, RESILIE: 3, EXPIRE: 4 };
export const BAIL_STATUS_LABELS = { 1: "En attente", 2: "Actif", 3: "Résilié", 4: "Expiré" };

export const FREQUENCE_PAIEMENT = { JOUR: 1, SEMAINE: 2, MOIS: 3, ANNEE: 4 };
export const FREQUENCE_PAIEMENT_LABELS = { 1: "Jour", 2: "Semaine", 3: "Mois", 4: "Année" };

export const ECHEANCE_STATUS = { PAYE: 1, PARTIEL: 2, IMPAYE: 3 };
export const ECHEANCE_STATUS_LABELS = { 1: "Payé", 2: "Partiel", 3: "Impayé" };

export async function fetchCategories(typeBien) {
  const { data } = await apiClient.get("/categories/", {
    params: typeBien ? { type_bien: typeBien } : undefined,
  });
  return data;
}

export async function createCategorie({ libelle, typeBien, description }) {
  const { data } = await apiClient.post("/categories/", {
    libelle,
    type_bien: typeBien,
    description: description || null,
  });
  return data;
}

export async function updateCategorie(categorieId, payload) {
  const { data } = await apiClient.put(`/categories/${categorieId}`, payload);
  return data;
}

export async function deleteCategorie(categorieId) {
  await apiClient.delete(`/categories/${categorieId}`);
}

export async function fetchBiens() {
  const { data } = await apiClient.get("/properties/");
  return data;
}

export async function createBien({ proprietaireId, type, designation, description, statut }) {
  const { data } = await apiClient.post("/properties/", {
    proprietaire_id: proprietaireId,
    type,
    designation: designation || null,
    description: description || null,
    statut: statut || null,
  });
  return data;
}

export async function updateBien(bienId, payload) {
  const { data } = await apiClient.put(`/properties/${bienId}`, payload);
  return data;
}

export async function deleteBien(bienId) {
  await apiClient.delete(`/properties/${bienId}`);
}

export async function uploadBienPhoto(bienId, file) {
  const formData = new FormData();
  formData.append("file", file);
  const { data } = await apiClient.post(`/properties/${bienId}/photos`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

export async function deleteBienPhoto(bienId, photoId) {
  await apiClient.delete(`/properties/${bienId}/photos/${photoId}`);
}

export async function fetchLots() {
  const { data } = await apiClient.get("/lots/");
  return data;
}

export async function createLot({ bienId, categorieId, reference, description, loyerReference, statut }) {
  const { data } = await apiClient.post("/lots/", {
    bien_id: bienId,
    categorie_id: categorieId || null,
    reference: reference || null,
    description: description || null,
    loyer_reference: loyerReference || null,
    statut: statut || null,
  });
  return data;
}

export async function updateLot(lotId, payload) {
  const { data } = await apiClient.put(`/lots/${lotId}`, payload);
  return data;
}

export async function deleteLot(lotId) {
  await apiClient.delete(`/lots/${lotId}`);
}

export async function fetchBaux() {
  const { data } = await apiClient.get("/leases/");
  return data;
}

export async function fetchEcheances() {
  const { data } = await apiClient.get("/due-dates/");
  return data;
}

export async function createEcheance({ bailId, dateEcheance, montantDu, statut }) {
  const { data } = await apiClient.post("/due-dates/", {
    bail_id: bailId,
    date_echeance: dateEcheance || null,
    montant_du: montantDu === "" || montantDu === undefined ? null : Number(montantDu),
    statut: statut || null,
  });
  return data;
}

export async function updateEcheance(echeanceId, payload) {
  const { data } = await apiClient.put(`/due-dates/${echeanceId}`, payload);
  return data;
}

export async function deleteEcheance(echeanceId) {
  await apiClient.delete(`/due-dates/${echeanceId}`);
}

export async function fetchPaiements() {
  const { data } = await apiClient.get("/payments/");
  return data;
}

export const MODE_PAIEMENT = { ESPECES: 1, VIREMENT: 2, CHEQUE: 3, CARTE: 4, MOBILE_MONEY: 5 };
export const MODE_PAIEMENT_LABELS = {
  1: "Espèces",
  2: "Virement",
  3: "Chèque",
  4: "Carte",
  5: "Mobile Money",
};

export async function createPaiement({ echeanceId, montant, modePaiement }) {
  const { data } = await apiClient.post("/payments/", {
    echeance_id: echeanceId,
    montant: montant === "" || montant === undefined ? null : Number(montant),
    mode_paiement: modePaiement || null,
  });
  return data;
}

export async function deletePaiement(paiementId) {
  await apiClient.delete(`/payments/${paiementId}`);
}

export const PAIEMENT_STATUS = { VALIDE: 1, ANNULE: 2 };
export const PAIEMENT_STATUS_LABELS = { 1: "Validé", 2: "Annulé" };

export async function annulerPaiement(paiementId, motif) {
  const { data } = await apiClient.post(`/payments/${paiementId}/annuler`, motif ? { motif } : undefined);
  return data;
}

export async function fetchQuittances() {
  const { data } = await apiClient.get("/receipts/");
  return data;
}

export const QUITTANCE_STATUS = { EMISE: 1, ANNULEE: 2 };
export const QUITTANCE_STATUS_LABELS = { 1: "Émise", 2: "Annulée" };

export async function annulerQuittance(quittanceId) {
  const { data } = await apiClient.post(`/receipts/${quittanceId}/annuler`);
  return data;
}

export async function downloadQuittance(quittanceId) {
  const response = await apiClient.get(`/receipts/${quittanceId}/download`, { responseType: "blob" });
  const url = window.URL.createObjectURL(new Blob([response.data], { type: "application/pdf" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `quittance_${quittanceId}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

export async function createBail({
  lotId,
  locataireId,
  dateDebut,
  dateFin,
  loyer,
  charges,
  depot,
  statut,
  frequencePaiement,
}) {
  const { data } = await apiClient.post("/leases/", {
    lot_id: lotId,
    locataire_id: locataireId,
    date_debut: dateDebut || null,
    date_fin: dateFin || null,
    loyer: loyer || null,
    charges: charges || null,
    depot: depot || null,
    statut: statut || null,
    frequence_paiement: frequencePaiement || FREQUENCE_PAIEMENT.MOIS,
  });
  return data;
}

export async function updateBail(bailId, payload) {
  const { data } = await apiClient.put(`/leases/${bailId}`, payload);
  return data;
}

export async function deleteBail(bailId) {
  await apiClient.delete(`/leases/${bailId}`);
}
