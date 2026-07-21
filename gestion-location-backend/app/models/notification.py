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
    date_creation = Column(DateTime, nullable=False, default=datetime.utcnow)

    # Relationships
    user = relationship("Utilisateur", back_populates="notifications")
