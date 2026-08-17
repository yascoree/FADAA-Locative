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
// "Gestionnaire" (nom interne du rôle) n'est jamais montré tel quel : côté
// inscription publique, ce choix se présente comme "Je suis une agence" — le
// gestionnaire individuel n'existe qu'en tant que collaborateur d'une agence.
// Fonction (pas un tableau statique) pour rester traduisible, comme roleLabels ci-dessus.
export function publicRegisterRoles(t) {
  return [
    {
      value: ROLES.PROPRIETAIRE,
      label: t("login.roleProprietaireLabel"),
      hint: t("login.roleProprietaireHint"),
      icon: "bi-house",
    },
    {
      value: ROLES.GESTIONNAIRE,
      label: t("login.roleAgenceLabel"),
      hint: t("login.roleAgenceHint"),
      icon: "bi-building",
    },
  ];
}
