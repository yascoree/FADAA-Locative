import enum

from sqlalchemy import Column, Date, Enum, ForeignKey, Integer
from sqlalchemy.orm import relationship

from app.database import Base


class MandatStatus(int, enum.Enum):
    ACTIF = 1
    REVOQUE = 2


class Mandat(Base):
    __tablename__ = "mandats"

    id = Column(Integer, primary_key=True, index=True)
    gestionnaire_id = Column(Integer, ForeignKey("utilisateurs.id"), nullable=False)
    proprietaire_id = Column(Integer, ForeignKey("utilisateurs.id"), nullable=False)
    date_debut = Column(Date, nullable=True)
    statut = Column(Enum(MandatStatus, name="mandat_status"), nullable=True)

    # Relationships
    gestionnaire = relationship(
        "Utilisateur", back_populates="mandats_gestionnaire", foreign_keys=[gestionnaire_id]
    )
    proprietaire = relationship(
        "Utilisateur", back_populates="mandats_proprietaire", foreign_keys=[proprietaire_id]
    )
