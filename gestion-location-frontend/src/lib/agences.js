import apiClient from "@/lib/apiClient";

export const ROLE_AGENCE = {
  ADMIN: 1,
  MEMBRE: 2,
};

export const AGENCE_MEMBRE_STATUS = {
  ACTIF: 1,
  REVOQUE: 2,
};

export async function fetchMyAgence() {
  const { data } = await apiClient.get("/agences/me");
  return data;
}

export async function fetchAgenceMembers(agenceId) {
  const { data } = await apiClient.get(`/agences/${agenceId}/membres`);
  return data;
}

/** Ajoute un collaborateur à l'agence courante (réservé à un membre ADMIN) — crée
    son compte et lui donne immédiatement accès à tous les mandats existants de
    l'agence. Retourne invite_link quand aucun email n'a pu être envoyé (mode
    test, SMTP non configuré). */
export async function inviteAgenceMember(agenceId, { nom, prenom, email, roleAgence }) {
  const { data } = await apiClient.post(`/agences/${agenceId}/membres`, {
    nom,
    prenom,
    email,
    role_agence: roleAgence || ROLE_AGENCE.MEMBRE,
  });
  return data;
}

export async function removeAgenceMember(agenceId, utilisateurId) {
  await apiClient.delete(`/agences/${agenceId}/membres/${utilisateurId}`);
}

/** nom/prenom ne sont acceptés par le backend que si le compte du collaborateur
    est encore INVITE_EN_ATTENTE (voir agence_service.update_agence_member) — les
    omettre ici (undefined) quand ce n'est pas le cas plutôt que d'envoyer des
    valeurs qui seront de toute façon rejetées. */
export async function updateAgenceMember(agenceId, utilisateurId, { roleAgence, nom, prenom }) {
  const { data } = await apiClient.patch(`/agences/${agenceId}/membres/${utilisateurId}`, {
    role_agence: roleAgence,
    ...(nom !== undefined ? { nom } : {}),
    ...(prenom !== undefined ? { prenom } : {}),
  });
  return data;
}
