from sqlalchemy.orm import Session

from app.models.subscription import Subscription


def get(db: Session, subscription_id: int) -> Subscription | None:
    return db.get(Subscription, subscription_id)


def get_by_owner(db: Session, owner_id: int) -> Subscription | None:
    return db.query(Subscription).filter(Subscription.owner_id == owner_id).first()


def get_multi(db: Session, skip: int = 0, limit: int = 100) -> list[Subscription]:
    return db.query(Subscription).offset(skip).limit(limit).all()
