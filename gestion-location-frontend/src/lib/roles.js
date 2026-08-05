// Doit rester aligné sur UtilisateurRole (gestion-location-backend/app/models/utilisateur.py)
export const ROLES = {
  ADMINISTRATEUR: 1,
  PROPRIETAIRE: 2,
  GESTIONNAIRE: 3,
  LOCATAIRE: 4,
};

export function roleLabels(t) {
  return {
    1: t("bo.roles.administrateur"),
    2: t("bo.roles.proprietaire"),
    3: t("bo.roles.gestionnaire"),
    4: t("bo.roles.locataire"),
  };
}

export const ROLE_DASHBOARD_PATH = {
  1: "/backoffice/admin",
  2: "/backoffice/proprietaire",
  3: "/backoffice/agence",
  4: "/backoffice/locataire",
};

// Rôles utilisables pour l'inscription publique (voir POST /auth/register côté backend).
export const PUBLIC_REGISTER_ROLES = [
  { value: ROLES.PROPRIETAIRE, label: "Propriétaire", hint: "Je gère mes propres biens" },
];
