import enum

from sqlalchemy import Column, Enum, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from app.database import Base


class BienStatus(int, enum.Enum):
    DISPONIBLE = 1
    LOUE = 2
    MAINTENANCE = 3
    HORS_SERVICE = 4


class Bien(Base):
    __tablename__ = "biens"

    id = Column(Integer, primary_key=True, index=True)
    proprietaire_id = Column(Integer, ForeignKey("utilisateurs.id"), nullable=False)
    categorie_id = Column(Integer, ForeignKey("categories.id"), nullable=False)
    designation = Column(String(150), nullable=True)
    statut = Column(Enum(BienStatus, name="bien_status"), nullable=True)
    attachement = Column(String(255), nullable=True)

    # Relationships
    proprietaire = relationship("Utilisateur", back_populates="biens", foreign_keys=[proprietaire_id])
    categorie = relationship("Categorie", back_populates="biens")
    lots = relationship("Lot", back_populates="bien", cascade="all, delete-orphan")
