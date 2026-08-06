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
    # Le mandat lie une Agence (pas un utilisateur précis) à un propriétaire : le
    # contrat commercial est Agence <-> Propriétaire, il ne doit pas dépendre de la
    # présence d'un employé donné (voir created_by, purement informatif).
    agence_id = Column(Integer, ForeignKey("agences.id"), nullable=False)
    proprietaire_id = Column(Integer, ForeignKey("utilisateurs.id"), nullable=False)
    # Qui a initié ce mandat — informatif uniquement, jamais utilisé pour
    # l'autorisation (voir app.api.deps, qui résout toujours via agence_id).
    created_by = Column(Integer, ForeignKey("utilisateurs.id"), nullable=False)
    # NULL = couvre tous les biens du propriétaire (comportement historique). Non-NULL
    # restreint le mandat à ce bien précis, pour pouvoir assigner une même agence
    # à plusieurs biens indépendamment, chacun avec ses propres permissions.
    bien_id = Column(Integer, ForeignKey("biens.id", ondelete="CASCADE"), nullable=True)
    date_debut = Column(Date, nullable=True)
    statut = Column(Enum(MandatStatus, name="mandat_status"), nullable=True)

    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)
    deleted_at = Column(DateTime, nullable=True)

    # Relationships
    agence = relationship("Agence", back_populates="mandats")
    proprietaire = relationship(
        "Utilisateur", back_populates="mandats_proprietaire", foreign_keys=[proprietaire_id]
    )
    createur = relationship("Utilisateur", foreign_keys=[created_by])
    bien = relationship("Bien", foreign_keys=[bien_id])
    permissions = relationship(
        "ManagerPermission", back_populates="mandat", cascade="all, delete-orphan"
    )
