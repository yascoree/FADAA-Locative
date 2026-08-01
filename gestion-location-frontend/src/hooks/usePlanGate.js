"use client";

import { useCallback, useEffect, useState } from "react";
import {
  fetchMySubscription,
  fetchMyUsage,
  isSubscriptionUsable,
  LIMIT_TO_USAGE_KEY,
  UNLIMITED,
} from "@/lib/subscriptions";

// Inverse de LIMIT_TO_USAGE_KEY : clé d'usage ("biens", "quittances_mois", ...)
// -> nom du champ limite sur le plan ("max_biens", "max_quittances_mois", ...).
const USAGE_KEY_TO_LIMIT_FIELD = Object.fromEntries(
  Object.entries(LIMIT_TO_USAGE_KEY).map(([limitField, usageKey]) => [usageKey, limitField])
);

/** Vérifie l'abonnement AVANT d'ouvrir un formulaire de création (bouton
    "Nouveau X"), plutôt que de laisser l'utilisateur remplir le formulaire
    pour échouer seulement à la soumission (voir enforce_limit côté backend,
    même règle appliquée ici côté client de façon préventive).

    `resource` est optionnel — une des clés de SubscriptionUsageRead ("biens",
    "lots", "baux_actifs", "gestionnaires", "locataires", "quittances_mois") —
    et permet de bloquer aussi sur le quota du plan, pas seulement sur un
    abonnement expiré/suspendu. Sans `resource`, seul l'état de l'abonnement
    est vérifié. */
export function usePlanGate(resource) {
  const [subscription, setSubscription] = useState(null);
  const [usage, setUsage] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [sub, use] = await Promise.all([fetchMySubscription(), fetchMyUsage()]);
        if (!cancelled) {
          setSubscription(sub);
          setUsage(use);
        }
      } catch {
        // Pas d'abonnement exploitable (compte non-propriétaire, etc.) : on ne
        // bloque rien préventivement, le backend tranchera à la soumission.
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  // Retourne un message si l'action doit être bloquée, sinon null.
  const checkBeforeOpen = useCallback(() => {
    if (!subscription) return null;
    if (!isSubscriptionUsable(subscription)) {
      return subscription.plan?.is_trial
        ? "Votre période d'essai est terminée. Renouvelez votre abonnement pour continuer à créer des ressources."
        : `Votre abonnement « ${subscription.plan?.name} » a expiré ou est suspendu. Renouvelez-le ou passez à un plan supérieur pour continuer.`;
    }
    if (resource && usage && subscription.plan) {
      const limitField = USAGE_KEY_TO_LIMIT_FIELD[resource];
      const limit = subscription.plan[limitField];
      if (limit !== undefined && limit !== UNLIMITED && usage[resource] >= limit) {
        return `Limite du plan « ${subscription.plan.name} » atteinte (${limit}). Passez à un plan supérieur pour continuer.`;
      }
    }
    return null;
  }, [subscription, usage, resource]);

  return { checkBeforeOpen };
}
