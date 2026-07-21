from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from app.database import Base


class Quittance(Base):
    __tablename__ = "quittances"

    id = Column(Integer, primary_key=True, index=True)
    paiement_id = Column(Integer, ForeignKey("paiements.id"), unique=True, nullable=False)
    fichier_pdf = Column(String(255), nullable=True)
    date_generation = Column(DateTime, nullable=False, default=datetime.utcnow)

    # Relationships
    paiement = relationship("Paiement", back_populates="quittance")
