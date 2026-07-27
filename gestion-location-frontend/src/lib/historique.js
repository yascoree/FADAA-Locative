import apiClient from "@/lib/apiClient";

export const HISTORIQUE_ACTIONS = ["CREATE", "UPDATE", "DELETE", "GET"];

export async function fetchHistorique() {
  const { data } = await apiClient.get("/historique/", { params: { limit: 200 } });
  return data;
}
