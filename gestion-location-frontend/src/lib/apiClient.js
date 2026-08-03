import axios from "axios";

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const apiClient = axios.create({
  baseURL: API_BASE_URL,
});

export function setAuthToken(token) {
  if (token) {
    apiClient.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete apiClient.defaults.headers.common.Authorization;
  }
}

// 402 = abonnement expiré/suspendu ou limite du plan atteinte (voir
// app.services.exceptions.PaymentRequired côté backend) : signal dédié pour que
// l'UI distingue ce cas d'une erreur de validation classique.
export function isPlanLimitError(error) {
  return error?.response?.status === 402;
}

export function extractErrorMessage(error) {
  const detail = error?.response?.data?.detail;
  if (Array.isArray(detail)) {
    return detail.map((item) => item.msg).join(" — ");
  }
  if (typeof detail === "string") {
    return detail;
  }
  return `Impossible de contacter l'API sur ${API_BASE_URL}. Le serveur tourne-t-il ?`;
}

export default apiClient;
