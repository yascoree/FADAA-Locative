from sqlalchemy import Column, Integer, String, Text
from sqlalchemy.orm import relationship

from app.database import Base


class Categorie(Base):
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True, index=True)
    libelle = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)

    # Relationships
    biens = relationship("Bien", back_populates="categorie")
