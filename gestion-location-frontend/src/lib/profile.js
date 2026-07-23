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

export async function uploadProfilePhoto(userId, file) {
  const formData = new FormData();
  formData.append("file", file);
  const { data } = await apiClient.post(`/profiles/${userId}/photo`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

export async function deleteProfilePhoto(userId) {
  const { data } = await apiClient.delete(`/profiles/${userId}/photo`);
  return data;
}

export async function verifyCurrentPassword(password) {
  const { data } = await apiClient.post("/auth/verify-password", { password });
  return data.valid;
}
