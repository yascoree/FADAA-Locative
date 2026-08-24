"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { ROLES } from "@/lib/roles";
import { fetchActivePlans, fetchMyPlanChangeRequest, createPlanChangeRequest } from "@/lib/subscriptions";
import PlanChoiceGrid from "@/components/PlanChoiceGrid";
import styles from "./PlanLimitPopup.module.css";

const VIEW = { INFO: "info", PICKER: "picker", PENDING: "pending", SENT: "sent" };

// Popup plein écran pour les erreurs HTTP 402 (abonnement expiré/suspendu ou
// limite du plan atteinte, voir app.services.exceptions.PaymentRequired côté
// backend). Rendue par-dessus tout — y compris par-dessus la modale de
// création ouverte derrière — via #portal-root, avec un z-index supérieur à
// celui de Modal (voir ui.module.css .overlay) pour s'empiler dessus plutôt
// que dedans.
//
// Au-delà du simple message, propose de choisir un plan parmi ceux que
// l'admin a créés : le choix est envoyé comme une "demande" (voir
// app.api.plan_change_requests) que l'admin approuve depuis
// /backoffice/admin/abonnements pour l'activer réellement — le propriétaire
// ne peut jamais changer son propre plan, seulement le demander.
export default function PlanLimitPopup({ message, contactHref = "/front/contact", onClose }) {
  const { user } = useAuth();
  const canRequestPlan = user?.role === ROLES.PROPRIETAIRE;
  const isOpen = !!message;
  const [view, setView] = useState(VIEW.INFO);
  const [plans, setPlans] = useState([]);
  const [plansLoading, setPlansLoading] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState(null);
  const [pendingRequest, setPendingRequest] = useState(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);

  // La popup reste montée (juste masquée) entre deux ouvertures tant que le
  // composant parent ne la démonte pas : sur la transition fermée -> ouverte, on
  // réinitialise la vue locale directement pendant le rendu (pattern React
  // "ajuster un state suite au changement d'une prop", avec useState plutôt
  // qu'un ref — inaccessible pendant le rendu), pas dans un effet, pour éviter
  // un rendu en cascade.
  const [wasOpen, setWasOpen] = useState(false);
  if (isOpen !== wasOpen) {
    setWasOpen(isOpen);
    if (isOpen) {
      setView(VIEW.INFO);
      setError(null);
      setSelectedPlanId(null);
    }
  }

  // Recharge la demande en cours à chaque (ré)ouverture — seul un propriétaire a
  // un abonnement, donc une demande à suivre (voir require_proprietaire côté
  // backend sur POST/GET /plan-change-requests).
  useEffect(() => {
    if (!isOpen || !canRequestPlan) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const request = await fetchMyPlanChangeRequest();
        if (cancelled) return;
        if (request) {
          setPendingRequest(request);
          setView(VIEW.PENDING);
        } else {
          setPendingRequest(null);
        }
      } catch {
        // Compte sans abonnement exploitable (gestionnaire, admin...) : on reste
        // sur la vue "info" simple, sans bloquer sur cette vérification.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen, canRequestPlan]);

  useEffect(() => {
    if (!isOpen) return undefined;
    function handleKeyDown(e) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  async function openPicker() {
    setError(null);
    setSelectedPlanId(null);
    setView(VIEW.PICKER);
    if (plans.length > 0) return;
    setPlansLoading(true);
    try {
      setPlans(await fetchActivePlans(user?.role === ROLES.GESTIONNAIRE ? 'AGENCE' : 'PROPRIETAIRE'));
    } catch {
      setError("Impossible de charger les plans disponibles.");
    } finally {
      setPlansLoading(false);
    }
  }

  async function handleSend() {
    if (!selectedPlanId) return;
    setSending(true);
    setError(null);
    try {
      const request = await createPlanChangeRequest({ planId: selectedPlanId });
      setPendingRequest(request);
      setView(VIEW.SENT);
    } catch (err) {
      setError(err?.response?.data?.detail || "Impossible d'envoyer votre demande. Réessayez plus tard.");
    } finally {
      setSending(false);
    }
  }

  if (!isOpen) return null;

  return createPortal(
    <div className={styles.overlay} onClick={onClose}>
      <div
        className={`${styles.card} ${view === VIEW.PICKER ? styles.cardWide : ""}`}
        role="alertdialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className={styles.close} onClick={onClose} aria-label="Fermer">
          <i className="bi bi-x-lg" />
        </button>
        <span className={styles.orbA} aria-hidden="true" />
        <span className={styles.orbB} aria-hidden="true" />

        {view === VIEW.INFO && (
          <>
            <div className={styles.iconBadge}>
              <i className="bi bi-rocket-takeoff-fill" />
            </div>
            <span className={styles.eyebrow}>
              <i className="bi bi-stars" />
              Limite du plan atteinte
            </span>
            <h2 className={styles.title}>Passez à la vitesse supérieure</h2>
            <p className={styles.message}>{message}</p>
            <div className={styles.actions}>
              <button type="button" className={styles.cta} onClick={openPicker}>
                Choisir un abonnement
                <i className="bi bi-arrow-right" />
              </button>
              <Link href={contactHref} className={styles.secondaryLink} onClick={onClose}>
                Nous contacter
              </Link>
              <button type="button" className={styles.dismiss} onClick={onClose}>
                <i className="bi bi-clock" />
                Plus tard
              </button>
            </div>
          </>
        )}

        {view === VIEW.PENDING && pendingRequest && (
          <>
            <div className={styles.iconBadge}>
              <i className="bi bi-hourglass-split" />
            </div>
            <span className={styles.eyebrow}>
              <i className="bi bi-clock-history" />
              En attente de l&apos;admin
            </span>
            <h2 className={styles.title}>Demande déjà envoyée</h2>
            <p className={styles.message}>
              Vous avez demandé le plan « {pendingRequest.plan?.name} ». Un administrateur va l&apos;examiner et
              l&apos;activer sur votre compte.
            </p>
            <div className={styles.actions}>
              <button type="button" className={styles.ctaOutline} onClick={openPicker}>
                <i className="bi bi-arrow-repeat" />
                Changer mon choix
              </button>
              <button type="button" className={styles.dismiss} onClick={onClose}>
                <i className="bi bi-x-lg" />
                Fermer
              </button>
            </div>
          </>
        )}

        {view === VIEW.PICKER && (
          <div className={styles.pickerView}>
            <span className={styles.eyebrow}>
              <i className="bi bi-stars" />
              {canRequestPlan ? "Choisir un plan" : "Plans disponibles"}
            </span>
            <h2 className={styles.title}>
              {canRequestPlan ? "Quel abonnement voulez-vous ?" : "Plans proposés par la plateforme"}
            </h2>
            <p className={styles.pickerHint}>
              {canRequestPlan
                ? "Votre choix sera envoyé à l'administrateur, qui l'activera sur votre compte."
                : "Seul le propriétaire peut demander un changement de plan pour son compte — prévenez-le de votre côté."}
            </p>

            {plansLoading && <p className={styles.pickerLoading}>Chargement des plans...</p>}
            {error && <p className={styles.pickerError}>{error}</p>}

            {!plansLoading && plans.length > 0 && (
              <PlanChoiceGrid plans={plans} selectedPlanId={selectedPlanId} onSelect={setSelectedPlanId} />
            )}

            <div className={styles.actions}>
              {canRequestPlan ? (
                <button
                  type="button"
                  className={styles.cta}
                  onClick={handleSend}
                  disabled={!selectedPlanId || sending}
                >
                  {sending ? "Envoi..." : "Envoyer ma demande"}
                  <i className="bi bi-send" />
                </button>
              ) : (
                <Link href={contactHref} className={styles.cta} onClick={onClose}>
                  Nous contacter
                  <i className="bi bi-arrow-right" />
                </Link>
              )}
              <button
                type="button"
                className={styles.dismiss}
                onClick={() => setView(pendingRequest ? VIEW.PENDING : VIEW.INFO)}
              >
                <i className="bi bi-arrow-left" />
                Retour
              </button>
            </div>
          </div>
        )}

        {view === VIEW.SENT && (
          <>
            <div className={styles.iconBadge}>
              <i className="bi bi-check-lg" />
            </div>
            <span className={styles.eyebrow}>
              <i className="bi bi-check-circle" />
              Demande envoyée
            </span>
            <h2 className={styles.title}>C&apos;est envoyé !</h2>
            <p className={styles.message}>
              L&apos;administrateur a reçu votre choix ({pendingRequest?.plan?.name}) et activera votre nouveau plan
              prochainement.
            </p>
            <div className={styles.actions}>
              <button type="button" className={styles.cta} onClick={onClose}>
                Compris
              </button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.getElementById("portal-root") || document.body
  );
}
