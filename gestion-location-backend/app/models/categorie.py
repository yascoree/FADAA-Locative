from datetime import datetime

from sqlalchemy import Column, Date, ForeignKey, Integer, String, Text, DateTime
from sqlalchemy.orm import relationship

from app.database import Base


class Categorie(Base):
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True, index=True)
    libelle = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)
    deleted_at = Column(DateTime, nullable=True)

    # Relationships
    biens = relationship("Bien", back_populates="categorie")
