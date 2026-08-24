import enum
from datetime import datetime

from sqlalchemy import DECIMAL, Boolean, Column, DateTime, Enum, Integer, String, Text
from sqlalchemy.orm import relationship

from app.database import Base


class SubscriptionTarget(str, enum.Enum):
    PROPRIETAIRE = "PROPRIETAIRE"
    AGENCE = "AGENCE"


class SubscriptionPlan(Base):
    __tablename__ = "subscription_plans"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False)
    description = Column(Text, nullable=True)
    price = Column(DECIMAL(10, 2), nullable=False, default=0)
    duration_days = Column(Integer, nullable=False)
    is_trial = Column(Boolean, nullable=False, default=False)
    is_active = Column(Boolean, nullable=False, default=True)
    # Teinte de la carte plan côté admin (voir PLAN_COLOR_OPTIONS côté front) :
    # une des 4 teintes de la palette de marque, pas une couleur libre.
    color = Column(String(20), nullable=False, default="olive")

    # Cible de l'abonnement : PROPRIETAIRE (par défaut) ou AGENCE.
    target_type = Column(
        Enum(SubscriptionTarget, name="subscription_target_enum", create_type=True),
        nullable=False,
        default=SubscriptionTarget.PROPRIETAIRE,
    )

    # Limites d'usage : combien de ressources un propriétaire/agence sur ce plan peut avoir. -1 = illimité.
    max_biens = Column(Integer, nullable=False, default=-1)
    max_lots = Column(Integer, nullable=False, default=-1)
    max_baux_actifs = Column(Integer, nullable=False, default=-1)
    max_gestionnaires = Column(Integer, nullable=False, default=-1) # Limite pour les PROPRIETAIRE (partage via mandat)
    max_locataires = Column(Integer, nullable=False, default=-1)
    max_quittances_mois = Column(Integer, nullable=False, default=-1)

    # Limites spécifiques AGENCE
    max_membres_agence = Column(Integer, nullable=False, default=-1)
    max_storage_mb = Column(Integer, nullable=False, default=-1)
    can_export = Column(Boolean, nullable=False, default=True)

    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)
    deleted_at = Column(DateTime, nullable=True)

    # Relationships
    permissions = relationship(
        "PlanPermission", back_populates="plan", cascade="all, delete-orphan"
    )
    subscriptions = relationship("Subscription", back_populates="plan")
