import enum
from datetime import datetime

from sqlalchemy import Column, DateTime, Enum, ForeignKey, Integer, CheckConstraint
from sqlalchemy.orm import relationship

from app.database import Base


class SubscriptionStatus(int, enum.Enum):
    ACTIF = 1
    SUSPENDU = 2
    EXPIRE = 3
    RESILIE = 4


class Subscription(Base):
    """Links an entity to exactly one subscription plan. One row per
    owner_id OR agence_id, updated in place whenever the plan changes (see
    app.services.subscription_service.assign_plan)."""

    __tablename__ = "subscriptions"
    __table_args__ = (
        CheckConstraint(
            "owner_id IS NOT NULL OR agence_id IS NOT NULL", name="chk_subscription_owner_or_agence"
        ),
    )

    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("utilisateurs.id"), unique=True, nullable=True)
    agence_id = Column(Integer, ForeignKey("agences.id"), unique=True, nullable=True)
    plan_id = Column(Integer, ForeignKey("subscription_plans.id"), nullable=False)
    status = Column(
        Enum(SubscriptionStatus, name="subscription_status"), nullable=False, default=SubscriptionStatus.ACTIF
    )
    trial_start = Column(DateTime, nullable=True)
    trial_end = Column(DateTime, nullable=True)
    start_date = Column(DateTime, nullable=True)
    end_date = Column(DateTime, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)
    deleted_at = Column(DateTime, nullable=True)

    # Relationships
    owner = relationship("Utilisateur")
    agence = relationship("Agence")
    plan = relationship("SubscriptionPlan", back_populates="subscriptions")
