import enum
from datetime import datetime

from sqlalchemy import Column, DateTime, Enum, ForeignKey, Integer, Text
from sqlalchemy.orm import relationship

from app.database import Base


class PlanChangeRequestStatus(int, enum.Enum):
    EN_ATTENTE = 1
    APPROUVEE = 2
    REJETEE = 3


class PlanChangeRequest(Base):
    """Choix de plan qu'un propriétaire soumet depuis la popup de blocage
    (abonnement expiré/quota atteint) — l'admin la consulte et assigne (ou
    rejette) via app.services.subscription_service.assign_plan. Un propriétaire
    n'a jamais plus d'une demande EN_ATTENTE à la fois (voir
    plan_change_request_service.create_request)."""

    __tablename__ = "plan_change_requests"

    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("utilisateurs.id"), nullable=False)
    plan_id = Column(Integer, ForeignKey("subscription_plans.id"), nullable=False)
    message = Column(Text, nullable=True)
    statut = Column(
        Enum(PlanChangeRequestStatus, name="plan_change_request_status"),
        nullable=False,
        default=PlanChangeRequestStatus.EN_ATTENTE,
    )
    date_creation = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    owner = relationship("Utilisateur", foreign_keys=[owner_id])
    plan = relationship("SubscriptionPlan")
