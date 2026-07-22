import apiClient from "@/lib/apiClient";

export async function fetchDiscussions(withUserId) {
  const { data } = await apiClient.get("/discussions/", {
    params: withUserId ? { with_user_id: withUserId, limit: 200 } : { limit: 200 },
  });
  return data;
}

export async function sendMessage({ destinataireId, message }) {
  const { data } = await apiClient.post("/discussions/", { destinataire_id: destinataireId, message });
  return data;
}

export async function deleteDiscussion(discussionId) {
  await apiClient.delete(`/discussions/${discussionId}`);
}
