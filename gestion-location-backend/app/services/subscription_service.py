from datetime import datetime, timedelta

from sqlalchemy.orm import Session

from app.crud import subscription as subscription_crud
from app.models.subscription import Subscription, SubscriptionStatus
from app.models.subscription_plan import SubscriptionPlan


class SubscriptionError(Exception):
    """Raised for subscription business-rule violations (no active trial plan,
    assigning an inactive plan, ...). Routers translate this to an HTTP 400."""


def _get_trial_plan(db: Session) -> SubscriptionPlan:
    plan = (
        db.query(SubscriptionPlan)
        .filter(SubscriptionPlan.is_trial.is_(True), SubscriptionPlan.is_active.is_(True))
        .order_by(SubscriptionPlan.id)
        .first()
    )
    if not plan:
        raise SubscriptionError("No active trial plan is configured")
    return plan


def create_trial_subscription(db: Session, owner_id: int) -> Subscription:
    """Called right after a property owner registers: assigns the Trial plan for
    duration_days, starting now. Idempotent — returns the existing subscription
    unchanged if the owner already has one."""
    existing = subscription_crud.get_by_owner(db, owner_id)
    if existing:
        return existing

    plan = _get_trial_plan(db)
    now = datetime.utcnow()
    subscription = Subscription(
        owner_id=owner_id,
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


def assign_plan(db: Session, owner_id: int, plan: SubscriptionPlan) -> Subscription:
    """Assigns `plan` to `owner_id`, creating the subscription if it doesn't exist
    yet or switching the existing one otherwise. This is how an admin both
    "assigns a plan" and "changes a customer's subscription" — same operation."""
    if not plan.is_active:
        raise SubscriptionError("Cannot assign an inactive plan")

    now = datetime.utcnow()
    subscription = subscription_crud.get_by_owner(db, owner_id)
    if subscription is None:
        subscription = Subscription(owner_id=owner_id)
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


def expire_overdue_subscriptions(db: Session) -> int:
    """Flips ACTIF subscriptions past their end_date (trial or paid) to EXPIRE.
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
