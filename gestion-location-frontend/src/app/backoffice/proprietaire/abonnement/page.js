"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { extractErrorMessage } from "@/lib/apiClient";
import {
  fetchMySubscription,
  fetchMyUsage,
  LIMIT_FIELDS,
  LIMIT_TO_USAGE_KEY,
  UNLIMITED,
  formatLimit,
  isSubscriptionUsable,
  trialInfo,
  subscriptionStatusLabel,
  billingLabel,
} from "@/lib/subscriptions";
import PlanLimitPopup from "@/components/PlanLimitPopup";
import { useLanguage } from "@/context/LanguageContext";
import styles from "../proprietaire.module.css";

function formatCurrency(value) {
  return `${Number(value || 0).toLocaleString("fr-FR", { maximumFractionDigits: 0 })} MAD`;
}

function usageFillClass(percent) {
  if (percent === null) return styles.usageFill;
  if (percent >= 100) return `${styles.usageFill} ${styles.usageFillDanger}`;
  if (percent >= 75) return `${styles.usageFill} ${styles.usageFillWarning}`;
  return styles.usageFill;
}

function trialPillClass(state) {
  if (state === "expired") return styles.trialPillExpired;
  if (state === "warning") return styles.trialPillWarning;
  return styles.trialPillActive;
}

export default function ProprietaireAbonnementPage() {
  const { t } = useLanguage();
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [subscription, setSubscription] = useState(null);
  const [usage, setUsage] = useState(null);
  const [planPopupMessage, setPlanPopupMessage] = useState(null);

  useEffect(() => {
    async function init() {
      setIsLoading(true);
      try {
        const [sub, use] = await Promise.all([fetchMySubscription(), fetchMyUsage()]);
        setSubscription(sub);
        setUsage(use);
      } catch (err) {
        setLoadError(extractErrorMessage(err));
      } finally {
        setIsLoading(false);
      }
    }
    init();
  }, []);

  if (isLoading) {
    return <p>{t("bo.common.loading")}</p>;
  }

  if (loadError || !subscription) {
    return (
      <div className={`${styles.banner} ${styles.bannerError}`}>
        {loadError || t("bo.proprietaireAbonnement.noSubscription")}
      </div>
    );
  }

  const trial = trialInfo(subscription);
  const subscriptionBlocked = !isSubscriptionUsable(subscription);

  return (
    <div>
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>
          <span className={styles.sectionIconBadge}>
            <i className="bi bi-credit-card-2-front-fill" />
          </span>
          {t("bo.proprietaireAbonnement.title")}
        </h2>
        <p className={styles.sectionSubtitle}>{t("bo.proprietaireAbonnement.subtitle")}</p>
      </div>

      <PlanLimitPopup message={planPopupMessage} onClose={() => setPlanPopupMessage(null)} />

      {subscriptionBlocked && (
        <div className={`${styles.banner} ${styles.bannerError}`} style={{ marginBottom: "1.4rem" }}>
          <i className="bi bi-exclamation-triangle-fill" />
          <span>
            {subscription.plan?.is_trial
              ? t("bo.proprietaireAbonnement.trialEnded")
              : t("bo.proprietaireAbonnement.subscriptionStatus", {
                  plan: subscription.plan?.name,
                  status: subscriptionStatusLabel(subscription, subscriptionBlocked).toLowerCase(),
                })}{" "}
            {t("bo.proprietaireAbonnement.blockedInfo")}{" "}
            <button
              type="button"
              className={styles.btn}
              style={{ padding: "0.2rem 0.5rem", fontSize: "0.85rem", marginLeft: "0.5rem" }}
              onClick={() => setPlanPopupMessage(t("bo.proprietaireAbonnement.popupMessage"))}
            >
              {t("bo.proprietaireAbonnement.changePlan", "Mettre à niveau")}
            </button>
          </span>
        </div>
      )}

      <div className={styles.section} style={{ marginBottom: 0 }}>
        <div className={styles.card}>
          <div className={styles.planHeader}>
            <div>
              <div className={styles.planName}>{subscription.plan.name}</div>
              <div className={styles.planMeta}>
                {subscription.plan.is_trial ? billingLabel(subscription.plan) : `${formatCurrency(subscription.plan.price)} · ${billingLabel(subscription.plan)}`}
              </div>
            </div>
            <span
              className={styles.badge}
              style={
                subscriptionBlocked
                  ? { background: "var(--danger-soft)", color: "var(--danger)" }
                  : { background: "var(--primary-soft)", color: "#4e5738" }
              }
            >
              {subscriptionStatusLabel(subscription, subscriptionBlocked)}
            </span>
          </div>

          {trial && (
            <span className={`${styles.trialPill} ${trialPillClass(trial.state)}`} style={{ marginBottom: "1rem", display: "inline-flex" }}>
              <i className="bi bi-hourglass-split" />
              {trial.state === "expired"
                ? t("bo.proprietaireAbonnement.trialExpired")
                : t("bo.proprietaireAbonnement.trialDaysRemaining", { count: trial.daysRemaining })}
            </span>
          )}

          {usage && (
            <div className={styles.usageGrid}>
              {LIMIT_FIELDS[subscription.plan.target_type || 'PROPRIETAIRE'].map((f) => {
                const limit = subscription.plan[f.key];
                const used = usage[LIMIT_TO_USAGE_KEY[f.key]];
                const percent = limit === UNLIMITED ? null : Math.min(100, (used / Math.max(limit, 1)) * 100);
                return (
                  <div className={styles.usageItem} key={f.key}>
                    <div className={styles.usageLabelRow}>
                      <span className={styles.usageLabelText}>
                        <i className={`bi ${f.icon}`} />
                        {f.label}
                      </span>
                      <span className={styles.usageCount}>
                        {used} / {formatLimit(limit)}
                      </span>
                    </div>
                    <div className={styles.usageTrack}>
                      <div className={usageFillClass(percent)} style={{ width: `${percent === null ? 100 : percent}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className={styles.editActions} style={{ marginTop: "1.4rem" }}>
            <button
              type="button"
              className={styles.btn}
              onClick={() => setPlanPopupMessage(t("bo.proprietaireAbonnement.popupMessage"))}
            >
              <i className="bi bi-arrow-repeat" />
              {t("bo.proprietaireAbonnement.changePlan")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
