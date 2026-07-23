import apiClient from "@/lib/apiClient";
import { ROLES } from "@/lib/roles";

export const MANDAT_STATUS = {
  ACTIF: 1,
  REVOQUE: 2,
};

export async function fetchMandates() {
  const { data } = await apiClient.get("/mandates/");
  return data;
}

export async function fetchMandate(mandatId) {
  const { data } = await apiClient.get(`/mandates/${mandatId}`);
  return data;
}

export async function lookupGestionnaireByEmail(email) {
  const { data } = await apiClient.get("/users/lookup", { params: { email, role: "GESTIONNAIRE" } });
  return data;
}

export async function lookupLocataireByEmail(email) {
  const { data } = await apiClient.get("/users/lookup", { params: { email, role: "LOCATAIRE" } });
  return data;
}

export async function createMandate({ gestionnaireId, proprietaireId, bienId }) {
  const { data } = await apiClient.post("/mandates/", {
    gestionnaire_id: gestionnaireId,
    proprietaire_id: proprietaireId,
    bien_id: bienId || null,
    statut: MANDAT_STATUS.ACTIF,
    date_debut: new Date().toISOString().slice(0, 10),
  });
  return data;
}

export async function setMandateStatus(mandatId, statut) {
  const { data } = await apiClient.put(`/mandates/${mandatId}`, { statut });
  return data;
}

export async function deleteMandate(mandatId) {
  await apiClient.delete(`/mandates/${mandatId}`);
}

export async function fetchPermissionCatalog() {
  const { data } = await apiClient.get("/permissions/");
  return data;
}

export async function fetchMandatePermissions(mandatId) {
  const { data } = await apiClient.get(`/mandates/${mandatId}/permissions`);
  return data;
}

export async function saveMandatePermissions(mandatId, permissionCodes) {
  const { data } = await apiClient.put(`/mandates/${mandatId}/permissions`, {
    permissions: permissionCodes,
  });
  return data;
}

// Regroupe le catalogue plat (CREATE_PROPERTY, UPDATE_PROPERTY, ...) par ressource,
// pour l'affichage en tableau (une section par ressource, une case par action).
const RESOURCE_LABELS = {
  PROPERTY: "Biens",
  LOT: "Lots",
  LEASE: "Baux",
  DUE_DATE: "Échéances",
  PAYMENT: "Paiements",
};

const ACTION_ORDER = { VIEW: 0, CREATE: 1, UPDATE: 2, DELETE: 3 };

export function groupPermissionCatalog(catalog) {
  const groups = new Map();
  catalog.forEach((permission) => {
    const [action, ...rest] = permission.code.split("_");
    const resource = rest.join("_");
    if (!groups.has(resource)) {
      groups.set(resource, { resource, label: RESOURCE_LABELS[resource] || resource, permissions: [] });
    }
    groups.get(resource).permissions.push({ ...permission, _action: action });
  });
  groups.forEach((group) => {
    group.permissions.sort((a, b) => (ACTION_ORDER[a._action] ?? 9) - (ACTION_ORDER[b._action] ?? 9));
  });
  return Array.from(groups.values());
}

export function isGestionnaire(user) {
  return user?.role === ROLES.GESTIONNAIRE;
}

export function formatMandateStatusLine(mandat) {
  const isActive = mandat.statut === MANDAT_STATUS.ACTIF;
  const dateSource = isActive ? mandat.date_debut || mandat.updated_at : mandat.updated_at;
  const formatted = dateSource
    ? new Date(dateSource).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })
    : null;
  if (!formatted) return isActive ? "actif" : "révoqué";
  return isActive ? `actif depuis ${formatted}` : `révoqué le ${formatted}`;
}
