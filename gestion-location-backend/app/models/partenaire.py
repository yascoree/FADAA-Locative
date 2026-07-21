import enum
from datetime import datetime

from sqlalchemy import Column, DateTime, Enum, Integer, String, Text

from app.database import Base


class PartenaireStatus(int, enum.Enum):
    ACTIF = 1
    INACTIF = 2


class Partenaire(Base):
    __tablename__ = "partenaires"

    id = Column(Integer, primary_key=True, index=True)
    nom = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    logo = Column(String(255), nullable=True)
    site_web = Column(String(255), nullable=True)
    email = Column(String(255), nullable=True)
    telephone = Column(String(30), nullable=True)
    adresse = Column(Text, nullable=True)
    statut = Column(
        Enum(PartenaireStatus, name="partenaire_status"), nullable=False, default=PartenaireStatus.ACTIF
    )
    date_creation = Column(DateTime, nullable=False, default=datetime.utcnow)
