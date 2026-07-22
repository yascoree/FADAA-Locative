import enum

from datetime import datetime

from sqlalchemy import DECIMAL, Column, DateTime, Enum, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from app.database import Base


class LotStatus(int, enum.Enum):
    LIBRE = 1
    OCCUPE = 2
    RESERVE = 3


class Lot(Base):
    __tablename__ = "lots"

    id = Column(Integer, primary_key=True, index=True)
    bien_id = Column(Integer, ForeignKey("biens.id"), nullable=False)
    reference = Column(String(50), nullable=True)
    loyer_reference = Column(DECIMAL(10, 2), nullable=True)
    statut = Column(Enum(LotStatus, name="lot_status"), nullable=True)
    attachement = Column(String(255), nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)
    deleted_at = Column(DateTime, nullable=True)

    # Relationships
    bien = relationship("Bien", back_populates="lots")
    baux = relationship("Bail", back_populates="lot", cascade="all, delete-orphan")
