from datetime import date, datetime, timedelta

from sqlalchemy.orm import Session

from app.api.deps import gestionnaire_ids_for_proprietaire
from app.core.config import settings
from app.crud import subscription as subscription_crud
from app.models.notification import Notification, NotificationType
from app.models.subscription import Subscription, SubscriptionStatus
from app.models.subscription_plan import SubscriptionPlan
from app.services.push_service import send_push_to_user


from app.models.subscription_plan import SubscriptionTarget

class SubscriptionError(Exception):
    """Raised for subscription business-rule violations (no active trial plan,
    assigning an inactive plan, ...). Routers translate this to an HTTP 400."""


def _get_trial_plan(db: Session, target_type: SubscriptionTarget) -> SubscriptionPlan:
    plan = (
        db.query(SubscriptionPlan)
        .filter(SubscriptionPlan.is_trial.is_(True), SubscriptionPlan.is_active.is_(True), SubscriptionPlan.target_type == target_type)
        .order_by(SubscriptionPlan.id)
        .first()
    )
    if not plan:
        raise SubscriptionError(f"No active trial plan is configured for {target_type.name}")
    return plan


def ensure_trial_plan_available(db: Session, target_type: SubscriptionTarget) -> None:
    """Fail fast, BEFORE any write, when a new account is about to be created"""
    _get_trial_plan(db, target_type)


def create_trial_subscription(db: Session, owner_id: int = None, agence_id: int = None, target_type: SubscriptionTarget = SubscriptionTarget.PROPRIETAIRE) -> Subscription:
    """Assigns the Trial plan for the specified role. Idempotent."""
    if not owner_id and not agence_id:
        raise ValueError("Must provide either owner_id or agence_id")
        
    if owner_id:
        existing = subscription_crud.get_by_owner(db, owner_id)
    else:
        existing = subscription_crud.get_by_agence(db, agence_id)
        
    if existing:
        return existing

    plan = _get_trial_plan(db, target_type)
    now = datetime.utcnow()
    subscription = Subscription(
        owner_id=owner_id,
        agence_id=agence_id,
        plan_id=plan.id,
        status=SubscriptionStatus.ACTIF,
        trial_start=now,
        trial_end=now + timedelta(days=plan.duration_days),
        start_date=now,
        end_date=now + timedelta(days=plan.duration_days),
    )
    db.add(subscription)
    db.commit()
    db.refresh(subscription)
    return subscription


def assign_plan(db: Session, plan: SubscriptionPlan, owner_id: int = None, agence_id: int = None) -> Subscription:
    """Assigns `plan` to an entity, creating the subscription if it doesn't exist
    yet or switching the existing one otherwise. This is how an admin both
    "assigns a plan" and "changes a customer's subscription" — same operation."""
    if not plan.is_active:
        raise SubscriptionError("Cannot assign an inactive plan")

    if not owner_id and not agence_id:
        raise ValueError("Must provide either owner_id or agence_id")

    now = datetime.utcnow()
    
    if owner_id:
        subscription = subscription_crud.get_by_owner(db, owner_id)
        if subscription is None:
            subscription = Subscription(owner_id=owner_id)
            db.add(subscription)
    else:
        subscription = subscription_crud.get_by_agence(db, agence_id)
        if subscription is None:
            subscription = Subscription(agence_id=agence_id)
            db.add(subscription)

    subscription.plan_id = plan.id
    subscription.status = SubscriptionStatus.ACTIF
    subscription.start_date = now
    subscription.end_date = now + timedelta(days=plan.duration_days)
    if plan.is_trial:
        subscription.trial_start = now
        subscription.trial_end = now + timedelta(days=plan.duration_days)

    db.commit()
    db.refresh(subscription)
    return subscription


def is_active(subscription: Subscription) -> bool:
    """True if `subscription` currently grants access: status ACTIF and not past
    its end_date (trial and paid periods both use end_date, see assign_plan/
    create_trial_subscription)."""
    if subscription.status != SubscriptionStatus.ACTIF:
        return False
    if subscription.end_date and subscription.end_date < datetime.utcnow():
        return False
    return True


def _subscription_label(subscription: Subscription) -> str:
    plan = subscription.plan
    return "période d'essai" if plan.is_trial else f"abonnement « {plan.name} »"


def _notify_owner_and_gestionnaires(db: Session, owner_id: int, title: str, body: str, reference_id: int) -> None:
    """Le propriétaire ET les gestionnaires mandatés dépendent du même abonnement
    pour continuer à travailler — les deux doivent être prévenus, pas seulement
    le titulaire du compte (même logique que _notify_stakeholders côté échéances,
    voir app.services.reminder_service)."""
    recipient_ids = {owner_id, *gestionnaire_ids_for_proprietaire(db, owner_id)}
    for recipient_id in recipient_ids:
        send_push_to_user(
            db,
            user_id=recipient_id,
            title=title,
            body=body,
            notif_type=NotificationType.ABONNEMENT,
            reference_id=reference_id,
        )


def _already_notified_recently(db: Session, subscription_id: int, within_days: int) -> bool:
    cutoff = datetime.utcnow() - timedelta(days=within_days)
    return (
        db.query(Notification)
        .filter(
            Notification.type == NotificationType.ABONNEMENT,
            Notification.reference_id == subscription_id,
            Notification.date_creation >= cutoff,
        )
        .first()
        is not None
    )


def send_subscription_expiry_warnings(db: Session) -> int:
    """Prévient le propriétaire (et ses gestionnaires) quand un abonnement actif —
    essai ou payant — arrive à échéance dans settings.push_alert_days_before
    jours, pour qu'il ait le temps de renouveler avant la coupure. Une alerte par
    abonnement (pas de doublon, cf _already_notified_recently). Même logique que
    send_upcoming_echeance_alerts côté échéances."""
    target_date = date.today() + timedelta(days=settings.push_alert_days_before)
    subscriptions = (
        db.query(Subscription)
        .filter(
            Subscription.deleted_at.is_(None),
            Subscription.status == SubscriptionStatus.ACTIF,
            Subscription.end_date.isnot(None),
        )
        .all()
    )
    sent = 0
    for subscription in subscriptions:
        if subscription.end_date.date() != target_date:
            continue
        if _already_notified_recently(db, subscription.id, settings.push_alert_days_before):
            continue
        _notify_owner_and_gestionnaires(
            db,
            subscription.owner_id,
            title="Abonnement bientôt expiré",
            body=(
                f"Votre {_subscription_label(subscription)} se termine dans "
                f"{settings.push_alert_days_before} jour(s), le {subscription.end_date.strftime('%d/%m/%Y')}. "
                "Renouvelez-le pour continuer sans interruption."
            ),
            reference_id=subscription.id,
        )
        sent += 1
    return sent


def expire_overdue_subscriptions(db: Session) -> int:
    """Flips ACTIF subscriptions past their end_date (trial or paid) to EXPIRE,
    then notifies the owner (and their gestionnaires) that access is now blocked.
    Meant to run daily alongside the other scheduled jobs (see app.scheduler)."""
    now = datetime.utcnow()
    overdue = (
        db.query(Subscription)
        .filter(
            Subscription.deleted_at.is_(None),
            Subscription.status == SubscriptionStatus.ACTIF,
            Subscription.end_date.isnot(None),
            Subscription.end_date < now,
        )
        .all()
    )
    for subscription in overdue:
        subscription.status = SubscriptionStatus.EXPIRE
    db.commit()

    for subscription in overdue:
        _notify_owner_and_gestionnaires(
            db,
            subscription.owner_id,
            title="Abonnement expiré",
            body=(
                f"Votre {_subscription_label(subscription)} a expiré. Renouvelez-le ou passez à un plan "
                "supérieur pour continuer à utiliser FADAA Locative."
            ),
            reference_id=subscription.id,
        )
    return len(overdue)


def suspend(db: Session, subscription: Subscription) -> Subscription:
    subscription.status = SubscriptionStatus.SUSPENDU
    db.commit()
    db.refresh(subscription)
    return subscription


def reactivate(db: Session, subscription: Subscription) -> Subscription:
    subscription.status = SubscriptionStatus.ACTIF
    db.commit()
    db.refresh(subscription)
    return subscription


def cancel(db: Session, subscription: Subscription) -> Subscription:
    """Résiliation définitive (contrairement à suspend/reactivate, pensée comme
    réversible). Le propriétaire garde son compte mais n'a plus d'abonnement actif."""
    subscription.status = SubscriptionStatus.RESILIE
    db.commit()
    db.refresh(subscription)
    return subscription


def extend(db: Session, subscription: Subscription, new_end_date: datetime) -> Subscription:
    subscription.end_date = new_end_date
    # Sur un plan d'essai, end_date EST la date de fin d'essai : les laisser
    # diverger ferait dire à l'UI deux choses contradictoires sur le même
    # abonnement (badge "Expiré" basé sur end_date, pastille "X j restants"
    # basée sur trial_end resté à son ancienne valeur).
    if subscription.plan.is_trial:
        subscription.trial_end = new_end_date
    db.commit()
    db.refresh(subscription)
    return subscription
