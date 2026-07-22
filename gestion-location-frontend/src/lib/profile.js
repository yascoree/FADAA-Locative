import apiClient from "@/lib/apiClient";

export async function fetchProfile(userId) {
  const { data } = await apiClient.get(`/profiles/${userId}`);
  return data;
}

export async function createProfile(userId, payload) {
  const { data } = await apiClient.post("/profiles/", { utilisateur_id: userId, ...payload });
  return data;
}

export async function updateProfile(userId, payload) {
  const { data } = await apiClient.put(`/profiles/${userId}`, payload);
  return data;
}
