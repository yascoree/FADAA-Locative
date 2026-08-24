"use client";

import { capitalizeTone, billingLabel, priceUnit, planIcon, cheapestPaidPlan, formatLimit, LIMIT_FIELDS } from "@/lib/subscriptions";
import styles from "./PlanChoiceGrid.module.css";

// Grille de cartes de plan sélectionnables — extraite de PlanLimitPopup pour
// être réutilisée telle quelle par la section "Abonnement" des Paramètres
// (voir backoffice/proprietaire/parametres/page.js) : même composant, donc
// garantie du même rendu partout, pas une copie qui pourrait diverger.
export default function PlanChoiceGrid({ plans, selectedPlanId, onSelect }) {
  const popularPlan = cheapestPaidPlan(plans);

  return (
    <div className={styles.planGrid}>
      {plans.map((plan) => {
        const isSelected = selectedPlanId === plan.id;
        const tone = capitalizeTone(plan.color);
        const isPopular = !!popularPlan && plan.id === popularPlan.id;
        // L'essai gratuit est accordé une seule fois, automatiquement, à la
        // création du compte (voir subscription_service.create_trial_subscription)
        // — on ne le propose donc jamais comme choix ici.
        const isLocked = plan.is_trial;
        return (
          <button
            type="button"
            key={plan.id}
            className={`${styles.planCard} ${styles[`planCard${tone}`]} ${isSelected ? styles.planCardSelected : ""} ${
              isLocked ? styles.planCardLocked : ""
            }`}
            onClick={() => !isLocked && onSelect(plan.id)}
            disabled={isLocked}
            aria-disabled={isLocked}
            title={isLocked ? "Votre essai gratuit a déjà été utilisé" : undefined}
          >
            {isPopular && !isLocked && <span className={styles.planRibbon}>Populaire</span>}
            {isLocked ? (
              <span className={styles.planLockBadge}>
                <i className="bi bi-lock-fill" />
                Déjà utilisé
              </span>
            ) : (
              <span className={styles.planCheck}>
                <i className={`bi ${isSelected ? "bi-check-circle-fill" : "bi-circle"}`} />
              </span>
            )}

            <div className={styles.planCardHeader}>
              <span className={styles.planIcon}>
                <i className={`bi ${planIcon(plan, isPopular)}`} />
              </span>
              <div className={styles.planName}>{plan.name}</div>
              <div className={styles.planPriceRow}>
                <span className={styles.planPrice}>{Number(plan.price) === 0 ? "Gratuit" : `${plan.price} DH`}</span>
                {priceUnit(plan) && <span className={styles.planPriceUnit}>{priceUnit(plan)}</span>}
              </div>
              <div className={styles.planMeta}>{billingLabel(plan)}</div>
            </div>

            <div className={styles.planCardBody}>
              <div className={styles.planLimitsList}>
                {LIMIT_FIELDS[plan.target_type || 'PROPRIETAIRE'].map((f) => (
                  <div className={styles.planLimitRow} key={f.key}>
                    <span>{f.label}</span>
                    <span className={styles.planLimitValue}>{formatLimit(plan[f.key])}</span>
                  </div>
                ))}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
