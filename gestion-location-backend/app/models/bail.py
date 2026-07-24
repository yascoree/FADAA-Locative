import enum

from datetime import datetime

from sqlalchemy import DECIMAL, Column, Date, Enum, ForeignKey, Integer, DateTime
from sqlalchemy.orm import relationship

from app.database import Base


class BailStatus(int, enum.Enum):
    EN_ATTENTE = 1
    ACTIF = 2
    RESILIE = 3
    EXPIRE = 4


class FrequencePaiement(int, enum.Enum):
    JOUR = 1
    SEMAINE = 2
    MOIS = 3  
    ANNEE = 4


class Bail(Base):
    __tablename__ = "baux"

    id = Column(Integer, primary_key=True, index=True)
    lot_id = Column(Integer, ForeignKey("lots.id"), nullable=False)
    locataire_id = Column(Integer, ForeignKey("utilisateurs.id"), nullable=False)
    date_debut = Column(Date, nullable=True)
    date_fin = Column(Date, nullable=True)
    loyer = Column(DECIMAL(10, 2), nullable=True)
    charges = Column(DECIMAL(10, 2), nullable=True)
    depot = Column(DECIMAL(10, 2), nullable=True)
    statut = Column(Enum(BailStatus, name="bail_status"), nullable=True)
    frequence_paiement = Column(
        Enum(FrequencePaiement, name="frequence_paiement"),
        nullable=False,
        default=FrequencePaiement.MOIS,
        server_default="MOIS",
    )
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)
    deleted_at = Column(DateTime, nullable=True)

    # Relationships
    lot = relationship("Lot", back_populates="baux")
    locataire = relationship("Utilisateur", back_populates="baux", foreign_keys=[locataire_id])
    echeances = relationship("Echeance", back_populates="bail", cascade="all, delete-orphan")
