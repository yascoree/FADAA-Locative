import enum
from datetime import datetime

from sqlalchemy import Column, DateTime, Enum, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from app.database import Base


class NotificationStatus(int, enum.Enum):
    NON_LUE = 1
    LUE = 2


class NotificationType(int, enum.Enum):
    PAIEMENT = 1
    ECHEANCE = 2
    BAIL = 3
    MANDAT = 4
    DISCUSSION = 5
    RELANCE = 6
    GESTION = 7
    AVIS = 8
    RECLAMATION = 9
    DEMANDE_DEMO = 10
    CONTACT_MESSAGE = 11
    PLAN_CHANGE_REQUEST = 12
    ABONNEMENT = 13
    MAINTENANCE = 14
    INVITATION_CLIENT = 15


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("utilisateurs.id"), nullable=False)
    titre = Column(String(150), nullable=True)
    description = Column(Text, nullable=True)
    statut = Column(
        Enum(NotificationStatus, name="notification_status"),
        nullable=False,
        default=NotificationStatus.NON_LUE,
    )
    type = Column(Enum(NotificationType, name="notification_type"), nullable=True)
    # Référence libre vers l'entité concernée (id d'échéance, de paiement...) selon
    # `type`. Sert notamment au scheduler de rappels pour éviter d'alerter deux fois
    # la même échéance.
    reference_id = Column(Integer, nullable=True)
    date_creation = Column(DateTime, nullable=False, default=datetime.utcnow)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)
    deleted_at = Column(DateTime, nullable=True)

    # Relationships
    user = relationship("Utilisateur", back_populates="notifications")
