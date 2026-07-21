from sqlalchemy.orm import Session

from app.models.subscription_plan import SubscriptionPlan
from app.schemas.subscription_plan import SubscriptionPlanCreate, SubscriptionPlanUpdate


def get(db: Session, plan_id: int) -> SubscriptionPlan | None:
    return db.get(SubscriptionPlan, plan_id)


def get_by_name(db: Session, name: str) -> SubscriptionPlan | None:
    return db.query(SubscriptionPlan).filter(SubscriptionPlan.name == name).first()


def get_multi(db: Session, skip: int = 0, limit: int = 100) -> list[SubscriptionPlan]:
    return db.query(SubscriptionPlan).offset(skip).limit(limit).all()


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
