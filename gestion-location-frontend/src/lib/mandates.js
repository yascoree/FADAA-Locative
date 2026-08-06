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

export async function createMandate({ agenceId, proprietaireId, bienId }) {
  const { data } = await apiClient.post("/mandates/", {
    agence_id: agenceId,
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

/** Portée d'un mandat, en texte : soit un bien précis, soit "tout le portefeuille"
    — le libellé de ce dernier cas diffère selon qui regarde (le propriétaire dit
    "mes" biens, l'agence dit "ses" biens en parlant de son client), d'où le
    paramètre plutôt qu'une clé de traduction fixe ici. */
export function mandatScopeLabel(mandat, allBiensLabel) {
  if (!mandat.bien_id) return allBiensLabel;
  return mandat.bien?.designation || `Bien #${mandat.bien_id}`;
}

/** Libellé lisible d'un niveau d'accès (voir summarizeAccessLevel) — même texte
    qu'on regarde depuis le côté propriétaire ou le côté agence. */
export function accessLevelLabel(level, t) {
  if (level === "full") return t("bo.common.accessFull");
  if (level === "readonly") return t("bo.common.accessReadOnly");
  if (level === "custom") return t("bo.common.accessCustom");
  return t("bo.common.accessNone");
}

/** Résume un ensemble de permissions accordées en un niveau lisible plutôt que
    d'obliger à lire la matrice : "full" si tout le catalogue est accordé,
    "readonly" si seuls des droits VIEW_* le sont, "custom" sinon. */
export function summarizeAccessLevel(grantedCodes, catalog) {
  if (!grantedCodes || grantedCodes.size === 0) return "none";
  if (catalog.length > 0 && grantedCodes.size >= catalog.length) return "full";
  const onlyView = [...grantedCodes].every((code) => code.startsWith("VIEW_"));
  return onlyView ? "readonly" : "custom";
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
