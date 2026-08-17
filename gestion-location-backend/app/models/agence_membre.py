import enum
from datetime import datetime

from sqlalchemy import Column, Date, DateTime, Enum, ForeignKey, Integer
from sqlalchemy.orm import relationship

from app.database import Base


class RoleAgence(int, enum.Enum):
    ADMIN = 1
    MEMBRE = 2


class AgenceMembreStatus(int, enum.Enum):
    ACTIF = 1
    REVOQUE = 2


class AgenceMembre(Base):
    """Appartenance d'un utilisateur à une agence, avec historique. Volontairement
    une table à part plutôt qu'une colonne agence_id sur Utilisateur : ça préserve
    la trace de qui a travaillé pour quelle agence et quand (important pour l'audit
    des paiements/baux gérés), et ça ouvre la voie à une vraie multi-appartenance
    plus tard sans migration de schéma. Contrainte V1 : au plus une ligne ACTIF par
    utilisateur (voir l'index unique partiel côté migration)."""

    __tablename__ = "agence_membres"

    id = Column(Integer, primary_key=True, index=True)
    agence_id = Column(Integer, ForeignKey("agences.id", ondelete="CASCADE"), nullable=False)
    utilisateur_id = Column(Integer, ForeignKey("utilisateurs.id", ondelete="CASCADE"), nullable=False)
    role_agence = Column(Enum(RoleAgence, name="role_agence"), nullable=False)
    statut = Column(
        Enum(AgenceMembreStatus, name="agence_membre_status"),
        nullable=False,
        default=AgenceMembreStatus.ACTIF,
    )
    date_debut = Column(Date, nullable=True)
    date_fin = Column(Date, nullable=True)

    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    agence = relationship("Agence", back_populates="membres")
    utilisateur = relationship("Utilisateur")
