import enum
from datetime import datetime

from sqlalchemy import DECIMAL, Column, DateTime, Enum, ForeignKey, Integer
from sqlalchemy.orm import relationship

from app.database import Base


class ModePaiement(int, enum.Enum):
    ESPECES = 1
    VIREMENT = 2
    CHEQUE = 3
    CARTE = 4
    MOBILE_MONEY = 5


class PaiementStatus(int, enum.Enum):
    VALIDE = 1
    ANNULE = 2


class Paiement(Base):
    __tablename__ = "paiements"

    id = Column(Integer, primary_key=True, index=True)
    echeance_id = Column(Integer, ForeignKey("echeances.id"), nullable=False)
    montant = Column(DECIMAL(10, 2), nullable=True)
    date_paiement = Column(DateTime, nullable=False, default=datetime.utcnow)
    mode_paiement = Column(Enum(ModePaiement, name="mode_paiement"), nullable=True)
    statut = Column(
        Enum(PaiementStatus, name="paiement_status"),
        nullable=False,
        default=PaiementStatus.VALIDE,
        server_default="VALIDE",
    )
    encaisse_par = Column(Integer, ForeignKey("utilisateurs.id"), nullable=False)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)
    deleted_at = Column(DateTime, nullable=True)

    # Relationships
    echeance = relationship("Echeance", back_populates="paiements")
    quittance = relationship(
        "Quittance", back_populates="paiement", uselist=False, cascade="all, delete-orphan"
    )

    encaisseur = relationship(
    "Utilisateur",
    back_populates="paiements",
    foreign_keys=[encaisse_par]
    )
