from datetime import datetime

from sqlalchemy.orm import Session

from app.models.subscription import Subscription, SubscriptionStatus
from app.models.subscription_plan import SubscriptionPlan
from app.schemas.subscription_plan import SubscriptionPlanCreate, SubscriptionPlanUpdate


def get(db: Session, plan_id: int) -> SubscriptionPlan | None:
    # return db.get(SubscriptionPlan, plan_id)
        return (
        db.query(SubscriptionPlan)
        .filter(
            SubscriptionPlan.id == plan_id,
            SubscriptionPlan.deleted_at.is_(None)
        )
        .first()
        )


def get_by_name(db: Session, name: str) -> SubscriptionPlan | None:
    # return db.query(SubscriptionPlan).filter(SubscriptionPlan.name == name).first()

        return (
        db.query(SubscriptionPlan)
        .filter(
            SubscriptionPlan.name == name,
            SubscriptionPlan.deleted_at.is_(None)
        )
        .first()
        )


def get_multi(db: Session, skip: int = 0, limit: int = 100) -> list[SubscriptionPlan]:
    # return db.query(SubscriptionPlan).offset(skip).limit(limit).all()

        return (
        db.query(SubscriptionPlan)
        .filter(SubscriptionPlan.deleted_at.is_(None))
        .offset(skip)
        .limit(limit)
        .all()
        )


from app.models.subscription_plan import SubscriptionTarget

def get_active(db: Session, target_type: SubscriptionTarget | None = None) -> list[SubscriptionPlan]:
    """Plans consultables par un propriétaire (pas seulement l'admin) — sert à la
    popup de choix de plan, voir app.services.plan_change_request_service."""
    query = db.query(SubscriptionPlan).filter(SubscriptionPlan.deleted_at.is_(None), SubscriptionPlan.is_active.is_(True))
    if target_type:
        query = query.filter(SubscriptionPlan.target_type == target_type)
    return query.order_by(SubscriptionPlan.id).all()


def create(db: Session, plan_in: SubscriptionPlanCreate) -> SubscriptionPlan:
    plan = SubscriptionPlan(**plan_in.model_dump())
    db.add(plan)
    db.commit()
    db.refresh(plan)
    return plan


def update(db: Session, plan: SubscriptionPlan, plan_in: SubscriptionPlanUpdate) -> SubscriptionPlan:
    for field, value in plan_in.model_dump(exclude_unset=True).items():
        setattr(plan, field, value)
    db.commit()
    db.refresh(plan)
    return plan


def set_active(db: Session, plan: SubscriptionPlan, is_active: bool) -> SubscriptionPlan:
    plan.is_active = is_active
    db.commit()
    db.refresh(plan)
    return plan


def count_subscriptions(db: Session, plan_id: int) -> int:
    """Compte les abonnements encore "en jeu" sur ce plan (actifs ou suspendus,
    donc réactivables) — un plan qui n'a plus que des abonnements résiliés/expirés
    peut être supprimé sans casser personne."""
    return (
        db.query(Subscription)
        .filter(
            Subscription.plan_id == plan_id,
            Subscription.deleted_at.is_(None),
            Subscription.status.in_((SubscriptionStatus.ACTIF, SubscriptionStatus.SUSPENDU)),
        )
        .count()
    )


def remove(db: Session, plan: SubscriptionPlan) -> None:
    plan.deleted_at = datetime.utcnow()
    db.commit()
