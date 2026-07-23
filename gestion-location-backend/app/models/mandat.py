import enum
from datetime import datetime

from sqlalchemy import Column, DateTime, Date, Enum, ForeignKey, Integer
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
    # NULL = couvre tous les biens du propriétaire (comportement historique). Non-NULL
    # restreint le mandat à ce bien précis, pour pouvoir assigner un même gestionnaire
    # à plusieurs biens indépendamment, chacun avec ses propres permissions.
    bien_id = Column(Integer, ForeignKey("biens.id", ondelete="CASCADE"), nullable=True)
    date_debut = Column(Date, nullable=True)
    statut = Column(Enum(MandatStatus, name="mandat_status"), nullable=True)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)
    deleted_at = Column(DateTime, nullable=True)
    

    # Relationships
    gestionnaire = relationship(
        "Utilisateur", back_populates="mandats_gestionnaire", foreign_keys=[gestionnaire_id]
    )
    proprietaire = relationship(
        "Utilisateur", back_populates="mandats_proprietaire", foreign_keys=[proprietaire_id]
    )
    bien = relationship("Bien", foreign_keys=[bien_id])
    permissions = relationship(
        "ManagerPermission", back_populates="mandat", cascade="all, delete-orphan"
    )
