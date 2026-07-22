import enum
from datetime import datetime

from sqlalchemy import Column, DateTime, Enum, ForeignKey, Integer, Text, String
from sqlalchemy.orm import relationship

from app.database import Base


class AvisStatus(int, enum.Enum):
    EN_ATTENTE = 1
    PUBLIE = 2
    REJETE = 3


class Avis(Base):
    __tablename__ = "avis"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("utilisateurs.id"), nullable=True)
    nom = Column(String(100), nullable=False)
    prenom = Column(String(100), nullable=False)
    note = Column(Integer, nullable=False)
    commentaire = Column(Text, nullable=True)
    date_creation = Column(DateTime, nullable=False, default=datetime.utcnow)
    statut = Column(
        Enum(AvisStatus, name="avis_status"), nullable=False, default=AvisStatus.EN_ATTENTE
    )

    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)
    deleted_at = Column(DateTime, nullable=True)

    # Relationships
    user = relationship("Utilisateur", back_populates="avis")
