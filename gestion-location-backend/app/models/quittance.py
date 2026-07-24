import enum
from datetime import datetime

from sqlalchemy import Column, DateTime, Enum, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from app.database import Base


class QuittanceStatus(int, enum.Enum):
    EMISE = 1
    ANNULEE = 2


class Quittance(Base):
    __tablename__ = "quittances"

    id = Column(Integer, primary_key=True, index=True)
    paiement_id = Column(Integer, ForeignKey("paiements.id"), unique=True, nullable=False)
    fichier_pdf = Column(String(255), nullable=True)
    date_generation = Column(DateTime, nullable=False, default=datetime.utcnow)
    statut = Column(
        Enum(QuittanceStatus, name="quittance_status"),
        nullable=False,
        default=QuittanceStatus.EMISE,
        server_default="EMISE",
    )
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)
    deleted_at = Column(DateTime, nullable=True)

    # Relationships
    paiement = relationship("Paiement", back_populates="quittance")
