from datetime import datetime

from sqlalchemy import Column, DateTime, Integer, String
from sqlalchemy.orm import relationship

from app.database import Base


class Agence(Base):
    __tablename__ = "agences"

    id = Column(Integer, primary_key=True, index=True)
    nom = Column(String(150), nullable=False)

    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)
    deleted_at = Column(DateTime, nullable=True)

    # Relationships
    membres = relationship("AgenceMembre", back_populates="agence", cascade="all, delete-orphan")
    mandats = relationship("Mandat", back_populates="agence")
