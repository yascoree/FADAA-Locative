import apiClient from "@/lib/apiClient";

export async function fetchDiscussions(withUserId) {
  const { data } = await apiClient.get("/discussions/", {
    params: withUserId ? { with_user_id: withUserId, limit: 200 } : { limit: 200 },
  });
  return data;
}

export async function uploadDiscussionAttachment(file) {
  const formData = new FormData();
  formData.append("file", file);
  const { data } = await apiClient.post("/discussions/attachments", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

export async function sendMessage({ destinataireId, message, attachment }) {
  const { data } = await apiClient.post("/discussions/", {
    destinataire_id: destinataireId,
    message: message || "",
    piece_jointe: attachment?.piece_jointe || null,
    piece_jointe_nom: attachment?.piece_jointe_nom || null,
    piece_jointe_type: attachment?.piece_jointe_type || null,
  });
  return data;
}

export async function deleteDiscussion(discussionId) {
  await apiClient.delete(`/discussions/${discussionId}`);
}
