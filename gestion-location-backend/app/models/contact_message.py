import enum
from datetime import datetime

from sqlalchemy import Column, DateTime, Enum, Integer, String, Text

from app.database import Base


class ContactMessageStatus(int, enum.Enum):
    NOUVEAU = 1
    TRAITE = 2
    EN_COURS = 3


class ContactMessage(Base):
    """Message soumis depuis le formulaire de contact public — visible
    uniquement par l'administrateur."""

    __tablename__ = "contact_messages"

    id = Column(Integer, primary_key=True, index=True)
    prenom = Column(String(255), nullable=False)
    nom = Column(String(255), nullable=False)
    email = Column(String(255), nullable=False)
    telephone = Column(String(30), nullable=True)
    sujet = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    statut = Column(
        Enum(ContactMessageStatus, name="contact_message_status"),
        nullable=False,
        default=ContactMessageStatus.NOUVEAU,
    )
    date_creation = Column(DateTime, nullable=False, default=datetime.utcnow)
