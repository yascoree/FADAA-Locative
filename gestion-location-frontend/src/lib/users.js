import apiClient from "@/lib/apiClient";

export const ACCOUNT_STATUS = {
  ACTIF: 1,
  INVITE_EN_ATTENTE: 2,
  CREE_SANS_ACCES: 3,
};

export function accountStatusLabels(t) {
  return {
    1: t("bo.accountStatus.actif"),
    2: t("bo.accountStatus.invitePending"),
    3: t("bo.accountStatus.disabled"),
  };
}

export async function createUser(payload) {
  const { data } = await apiClient.post("/users/", payload);
  return data;
}

export async function updateUser(userId, payload) {
  const { data } = await apiClient.put(`/users/${userId}`, payload);
  return data;
}

export async function deleteUser(userId) {
  await apiClient.delete(`/users/${userId}`);
}

export async function activateUser(userId) {
  const { data } = await apiClient.post(`/users/${userId}/activate`);
  return data;
}

export async function deactivateUser(userId) {
  const { data } = await apiClient.post(`/users/${userId}/deactivate`);
  return data;
}
