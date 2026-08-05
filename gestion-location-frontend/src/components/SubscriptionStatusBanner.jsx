"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  fetchMySubscription,
  isSubscriptionUsable,
  subscriptionDaysRemaining,
} from "@/lib/subscriptions";
import { useLanguage } from "@/context/LanguageContext";
import styles from "./SubscriptionStatusBanner.module.css";

const ABONNEMENT_PATH = "/backoffice/proprietaire/abonnement";

/** Bannière persistante, visible sur tout l'espace propriétaire (pas seulement
    la page Abonnement), quand l'abonnement est bientôt expiré ou déjà bloqué —
    pour que l'info ne dépende pas d'une visite volontaire de cette page (ce
    que font toutes les apps SaaS modernes : Slack, Notion, etc. préviennent
    partout, pas seulement sur /billing).
    Fermable pour la session en cours (redémontage du layout = réapparaît),
    mais jamais fermable tant que l'accès est réellement bloqué : à ce
    stade ce n'est plus une info, c'est la raison pour laquelle des actions
    échouent ailleurs dans l'app. */
export default function SubscriptionStatusBanner() {
  const { t } = useLanguage();
  const pathname = usePathname();
  const [subscription, setSubscription] = useState(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchMySubscription()
      .then((sub) => {
        if (!cancelled) setSubscription(sub);
      })
      .catch(() => {
        // Compte sans abonnement exploitable (gestionnaire connecté sur une route
        // propriétaire ne devrait pas arriver, mais on ne casse rien si c'est le cas).
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!subscription || pathname === ABONNEMENT_PATH) return null;

  const blocked = !isSubscriptionUsable(subscription);
  const daysRemaining = subscriptionDaysRemaining(subscription);
  const warning = !blocked && daysRemaining !== null && daysRemaining >= 0 && daysRemaining <= 3;

  if (!blocked && !warning) return null;
  if (warning && dismissed) return null;

  const isTrial = subscription.plan?.is_trial;
  let text;
  if (blocked) {
    text = isTrial
      ? t("bo.subscriptionBanner.trialBlockedText")
      : t("bo.subscriptionBanner.planBlockedText", { plan: subscription.plan?.name });
  } else {
    text = isTrial
      ? t("bo.subscriptionBanner.trialWarningText", { count: daysRemaining })
      : t("bo.subscriptionBanner.planWarningText", { plan: subscription.plan?.name, count: daysRemaining });
  }

  return (
    <div className={`${styles.banner} ${blocked ? styles.bannerDanger : styles.bannerWarning}`}>
      <i className={`bi ${blocked ? "bi-exclamation-octagon-fill" : "bi-hourglass-split"}`} />
      <span className={styles.text}>{text}</span>
      <Link href={ABONNEMENT_PATH} className={styles.cta}>
        {t("bo.subscriptionBanner.cta")}
        <i className="bi bi-arrow-right" />
      </Link>
      {!blocked && (
        <button
          type="button"
          className={styles.dismiss}
          onClick={() => setDismissed(true)}
          aria-label={t("bo.subscriptionBanner.dismiss")}
        >
          <i className="bi bi-x" />
        </button>
      )}
    </div>
  );
}
