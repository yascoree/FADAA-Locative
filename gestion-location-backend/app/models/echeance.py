import enum

from sqlalchemy import DECIMAL, Column, Date, Enum, ForeignKey, Integer
from sqlalchemy.orm import relationship

from app.database import Base


class EcheanceStatus(int, enum.Enum):
    PAYE = 1
    PARTIEL = 2
    IMPAYE = 3


class Echeance(Base):
    __tablename__ = "echeances"

    id = Column(Integer, primary_key=True, index=True)
    bail_id = Column(Integer, ForeignKey("baux.id"), nullable=False)
    date_echeance = Column(Date, nullable=True)
    montant_du = Column(DECIMAL(10, 2), nullable=True)
    statut = Column(Enum(EcheanceStatus, name="echeance_status"), nullable=True)

    # Relationships
    bail = relationship("Bail", back_populates="echeances")
    paiements = relationship("Paiement", back_populates="echeance", cascade="all, delete-orphan")
