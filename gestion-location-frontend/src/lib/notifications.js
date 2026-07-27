import apiClient from "@/lib/apiClient";

export const NOTIFICATION_STATUS = {
  NON_LUE: 1,
  LUE: 2,
};

export const NOTIFICATION_TYPE = {
  PAIEMENT: 1,
  ECHEANCE: 2,
  BAIL: 3,
  MANDAT: 4,
  DISCUSSION: 5,
  RELANCE: 6,
  GESTION: 7,
  AVIS: 8,
  RECLAMATION: 9,
  DEMANDE_DEMO: 10,
};

export const NOTIFICATION_TYPE_LABELS = {
  1: "Paiement",
  2: "Échéance",
  3: "Bail",
  4: "Mandat",
  5: "Discussion",
  6: "Relance",
  7: "Activité gestionnaire",
  8: "Avis",
  9: "Réclamation",
  10: "Demande de démo",
};

export async function fetchNotifications() {
  const { data } = await apiClient.get("/notifications/", { params: { limit: 50 } });
  return data;
}

export async function markNotificationRead(notificationId) {
  const { data } = await apiClient.put(`/notifications/${notificationId}`, {
    statut: NOTIFICATION_STATUS.LUE,
  });
  return data;
}

export async function deleteNotification(notificationId) {
  await apiClient.delete(`/notifications/${notificationId}`);
}
