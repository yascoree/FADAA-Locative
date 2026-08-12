// "il y a X min/h/j" — plus lisible qu'une date brute pour un horodatage récent
// (ex: dernière connexion). Au-delà de 30 jours, retombe sur une date formatée.
export function timeAgo(value, t) {
  if (!value) return null;
  const diffMs = Date.now() - new Date(value).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return t("bo.common.timeAgoNow");
  if (minutes < 60) return t("bo.common.timeAgoMinutes", { count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t("bo.common.timeAgoHours", { count: hours });
  const days = Math.floor(hours / 24);
  if (days < 30) return t("bo.common.timeAgoDays", { count: days });
  return new Date(value).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}
