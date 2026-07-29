from datetime import datetime

from sqlalchemy import Column, Enum, ForeignKey, Integer, String, Text, DateTime
from sqlalchemy.orm import relationship

from app.database import Base
from app.models.bien import TypeBien


class Categorie(Base):
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True, index=True)
    libelle = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    # Groupe auquel appartient cette sous-catégorie (Appartement -> IMMOBILIER,
    # Voiture -> VEHICULE, ...) — détermine sur quels Lots elle est proposable,
    # selon le type du Bien parent (voir Bien.type).
    type_bien = Column(Enum(TypeBien, name="type_bien"), nullable=False)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)
    deleted_at = Column(DateTime, nullable=True)

    # Relationships
    lots = relationship("Lot", back_populates="categorie")
