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

export async function fetchGestionnaires() {
  const { data } = await apiClient.get("/users/gestionnaires");
  return data;
}

/** Crée un tout nouveau compte gestionnaire et lui donne l'accès (mandat) en une
    seule étape — un gestionnaire ne pouvant plus s'inscrire lui-même, c'est
    désormais le seul moyen pour lui d'obtenir un compte. Retourne aussi
    invite_link quand aucun email n'a pu être envoyé (mode test, SMTP non
    configuré) pour que le propriétaire puisse le transmettre manuellement. */
export async function createGestionnaireInvite({ nom, prenom, email, bienId }) {
  const { data } = await apiClient.post("/users/gestionnaires", {
    nom,
    prenom,
    email,
    bien_id: bienId || null,
  });
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
// Le libellé venant du backend (permission.libelle) n'est pas traduit ; on garde
// seulement la clé de ressource/action ici, l'affichage traduit label/action côté
// composant via `_action` et `resource`.
const ACTION_ORDER = { VIEW: 0, CREATE: 1, UPDATE: 2, DELETE: 3 };

export function groupPermissionCatalog(catalog) {
  const groups = new Map();
  catalog.forEach((permission) => {
    const [action, ...rest] = permission.code.split("_");
    const resource = rest.join("_");
    if (!groups.has(resource)) {
      groups.set(resource, { resource, permissions: [] });
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

/** Construit un vérificateur de droits pour le gestionnaire connecté, à partir de
    ses propres mandats et des permissions accordées sur chacun. Reflète côté
    interface exactement ce que le backend vérifie (bien_ids_with_permission /
    has_permission_for_bien dans deps.py) : un mandat "tous mes biens" (bien_id
    null) couvre tout le portefeuille du propriétaire, un mandat scopé à un bien
    ne couvre que celui-là. Sert à cacher les boutons d'action que le gestionnaire
    n'a pas le droit d'utiliser, plutôt que de les laisser échouer côté serveur. */
export async function fetchGestionnairePermissionIndex() {
  const mandates = (await fetchMandates()).filter((m) => m.statut === MANDAT_STATUS.ACTIF);
  const permsByMandat = new Map(
    await Promise.all(
      mandates.map(async (m) => [m.id, new Set((await fetchMandatePermissions(m.id)).map((p) => p.permission.code))])
    )
  );

  function mandateHasCode(mandat, code) {
    return permsByMandat.get(mandat.id)?.has(code) ?? false;
  }

  function hasForProprietaire(proprietaireId, code) {
    return mandates.some((m) => m.proprietaire_id === proprietaireId && m.bien_id == null && mandateHasCode(m, code));
  }

  function hasForBien(bienId, proprietaireId, code) {
    // Un mandat scopé à ce bien précis fait autorité et prime sur un mandat
    // "tous mes biens" du même gestionnaire — sinon révoquer un droit sur le
    // mandat scopé n'aurait aucun effet tant que le mandat global l'accorde.
    const bienSpecific = mandates.find((m) => m.bien_id === bienId);
    if (bienSpecific) return mandateHasCode(bienSpecific, code);
    return hasForProprietaire(proprietaireId, code);
  }

  function proprietairesWithCode(code) {
    return [...new Set(mandates.filter((m) => m.bien_id == null && mandateHasCode(m, code)).map((m) => m.proprietaire_id))];
  }

  return { mandates, hasForProprietaire, hasForBien, proprietairesWithCode };
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
