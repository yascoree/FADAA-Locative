// Doit rester aligné sur UtilisateurRole (gestion-location-backend/app/models/utilisateur.py)
export const ROLES = {
  ADMINISTRATEUR: 1,
  PROPRIETAIRE: 2,
  GESTIONNAIRE: 3,
  LOCATAIRE: 4,
};

export const ROLE_LABELS = {
  1: "Administrateur",
  2: "Propriétaire",
  3: "Gestionnaire",
  4: "Locataire",
};

export const ROLE_DASHBOARD_PATH = {
  1: "/backoffice/admin",
  2: "/backoffice/proprietaire",
  3: "/backoffice/agence",
  4: "/backoffice/locataire",
};

// Rôles utilisables pour l'inscription publique (voir POST /auth/register côté backend).
export const PUBLIC_REGISTER_ROLES = [
  { value: ROLES.PROPRIETAIRE, label: "Propriétaire", hint: "Je gère mes propres biens" },
  { value: ROLES.GESTIONNAIRE, label: "Gestionnaire", hint: "Je gère des biens pour d'autres" },
];
