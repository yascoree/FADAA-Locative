import enum
from datetime import datetime

from sqlalchemy import Column, DateTime, Enum, Integer, String, Text

from app.database import Base


class DemandeDemoStatus(int, enum.Enum):
    NOUVELLE = 1
    CONTACTEE = 2
    EN_COURS = 3


class DemandeDemo(Base):
    """Demande de démo soumise depuis la landing page publique, sans compte —
    visible uniquement par l'administrateur."""

    __tablename__ = "demandes_demo"

    id = Column(Integer, primary_key=True, index=True)
    nom = Column(String(255), nullable=False)
    email = Column(String(255), nullable=False)
    telephone = Column(String(30), nullable=False)
    date_souhaitee = Column(DateTime, nullable=True)
    message = Column(Text, nullable=True)
    statut = Column(
        Enum(DemandeDemoStatus, name="demande_demo_status"), nullable=False, default=DemandeDemoStatus.NOUVELLE
    )
    date_creation = Column(DateTime, nullable=False, default=datetime.utcnow)
