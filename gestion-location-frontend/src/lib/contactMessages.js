import apiClient from "@/lib/apiClient";

export const CONTACT_MESSAGE_STATUS = { NOUVEAU: 1, TRAITE: 2 };
export const CONTACT_MESSAGE_STATUS_LABELS = { 1: "Nouveau", 2: "Traité" };

export async function createContactMessage({ prenom, nom, email, telephone, sujet, message }) {
  const { data } = await apiClient.post("/contact-messages/", {
    prenom,
    nom,
    email,
    telephone: telephone || null,
    sujet,
    message,
  });
  return data;
}

export async function fetchContactMessages() {
  const { data } = await apiClient.get("/contact-messages/");
  return data;
}

export async function updateContactMessageStatut(messageId, statut) {
  const { data } = await apiClient.put(`/contact-messages/${messageId}`, { statut });
  return data;
}
