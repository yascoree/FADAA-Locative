import apiClient from "@/lib/apiClient";

export async function fetchCategories() {
  const { data } = await apiClient.get("/categories/");
  return data;
}

export async function fetchBiens() {
  const { data } = await apiClient.get("/properties/");
  return data;
}

export async function createBien({ proprietaireId, categorieId, designation }) {
  const { data } = await apiClient.post("/properties/", {
    proprietaire_id: proprietaireId,
    categorie_id: categorieId,
    designation: designation || null,
  });
  return data;
}

export async function fetchLots() {
  const { data } = await apiClient.get("/lots/");
  return data;
}

export async function createLot({ bienId, reference, loyerReference }) {
  const { data } = await apiClient.post("/lots/", {
    bien_id: bienId,
    reference: reference || null,
    loyer_reference: loyerReference || null,
  });
  return data;
}

export async function fetchBaux() {
  const { data } = await apiClient.get("/leases/");
  return data;
}

export async function createBail({ lotId, locataireId, dateDebut, dateFin, loyer, charges, depot }) {
  const { data } = await apiClient.post("/leases/", {
    lot_id: lotId,
    locataire_id: locataireId,
    date_debut: dateDebut || null,
    date_fin: dateFin || null,
    loyer: loyer || null,
    charges: charges || null,
    depot: depot || null,
  });
  return data;
}
