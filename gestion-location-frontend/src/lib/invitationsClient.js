import apiClient from "@/lib/apiClient";

export const INVITATION_CLIENT_STATUS = {
  EN_ATTENTE: 1,
  ACCEPTEE: 2,
  REFUSEE: 3,
  EXPIREE: 4,
};

/** Côté agence : liste les invitations envoyées par l'agence courante. */
export async function fetchAgenceInvitations(agenceId) {
  const { data } = await apiClient.get(`/agences/${agenceId}/invitations`);
  return data;
}

/** Réservé à un membre ADMIN de l'agence — n'établit que la relation, aucune
    portée/permission n'est proposée ici (le propriétaire configure le Mandat
    lui-même après acceptation). Retourne invite_link quand aucun email n'a pu
    être envoyé (mode test, SMTP non configuré). */
export async function createAgenceInvitation(agenceId, email) {
  const { data } = await apiClient.post(`/agences/${agenceId}/invitations`, { email });
  return data;
}

export async function cancelAgenceInvitation(agenceId, invitationId) {
  const { data } = await apiClient.post(`/agences/${agenceId}/invitations/${invitationId}/annuler`);
  return data;
}

/** Côté propriétaire : ses propres invitations, tous statuts confondus. */
export async function fetchMyInvitations() {
  const { data } = await apiClient.get("/invitations-client/me");
  return data;
}

export async function acceptInvitation(invitationId) {
  const { data } = await apiClient.post(`/invitations-client/${invitationId}/accepter`);
  return data;
}

export async function declineInvitation(invitationId) {
  const { data } = await apiClient.post(`/invitations-client/${invitationId}/refuser`);
  return data;
}
