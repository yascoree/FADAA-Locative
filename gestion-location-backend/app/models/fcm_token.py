from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from app.database import Base


class FCMToken(Base):
    """Un jeton d'appareil (navigateur/mobile) enregistré pour recevoir des push
    FCM. Un utilisateur peut avoir plusieurs jetons (plusieurs appareils)."""

    __tablename__ = "fcm_tokens"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("utilisateurs.id"), nullable=False)
    token = Column(String(255), nullable=False, unique=True)
    date_creation = Column(DateTime, nullable=False, default=datetime.utcnow)

    user = relationship("Utilisateur")
