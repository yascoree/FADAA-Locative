import apiClient from "@/lib/apiClient";
import { ROLES } from "@/lib/roles";

export async function fetchLocataires() {
  const { data } = await apiClient.get("/tenants/");
  return data;
}

export async function createLocataire({ nom, prenom, email, motDePasse, statutCompte }) {
  const { data } = await apiClient.post("/tenants/", {
    nom,
    prenom,
    email,
    mot_de_passe: motDePasse,
    role: ROLES.LOCATAIRE,
    statut_compte: statutCompte,
  });
  return data;
}

export async function deactivateLocataire(locataireId) {
  const { data } = await apiClient.post(`/tenants/${locataireId}/deactivate`);
  return data;
}

export async function activateLocataire(locataireId) {
  const { data } = await apiClient.post(`/tenants/${locataireId}/activate`);
  return data;
}
