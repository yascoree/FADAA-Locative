from datetime import datetime

from sqlalchemy import DECIMAL, Boolean, Column, DateTime, Integer, String, Text
from sqlalchemy.orm import relationship

from app.database import Base


class SubscriptionPlan(Base):
    __tablename__ = "subscription_plans"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False)
    description = Column(Text, nullable=True)
    price = Column(DECIMAL(10, 2), nullable=False, default=0)
    duration_days = Column(Integer, nullable=False)
    is_trial = Column(Boolean, nullable=False, default=False)
    is_active = Column(Boolean, nullable=False, default=True)

    # Limites d'usage : combien de ressources un propriétaire sur ce plan peut
    # avoir. -1 = illimité. Ce ne sont PAS des permissions — les permissions
    # restent gérées séparément par le propriétaire via les Mandats.
    max_biens = Column(Integer, nullable=False, default=-1)
    max_lots = Column(Integer, nullable=False, default=-1)
    max_baux_actifs = Column(Integer, nullable=False, default=-1)
    max_gestionnaires = Column(Integer, nullable=False, default=-1)
    max_locataires = Column(Integer, nullable=False, default=-1)
    max_quittances_mois = Column(Integer, nullable=False, default=-1)

    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    permissions = relationship(
        "PlanPermission", back_populates="plan", cascade="all, delete-orphan"
    )
    subscriptions = relationship("Subscription", back_populates="plan")
