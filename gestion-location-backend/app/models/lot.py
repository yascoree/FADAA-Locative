import enum

from datetime import datetime

from sqlalchemy import DECIMAL, Column, DateTime, Enum, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from app.database import Base


class LotStatus(int, enum.Enum):
    DISPONIBLE = 1
    LOUE = 2
    RESERVE = 3
    EN_MAINTENANCE = 4
    HORS_SERVICE = 5


class Lot(Base):
    __tablename__ = "lots"

    id = Column(Integer, primary_key=True, index=True)
    bien_id = Column(Integer, ForeignKey("biens.id"), nullable=False)
    # Sous-catégorie (Appartement, Voiture, ...) — doit appartenir au même
    # type_bien que le Bien parent (voir Categorie.type_bien), vérifié en service.
    categorie_id = Column(Integer, ForeignKey("categories.id"), nullable=True)

    reference = Column(String(50), nullable=True)
    description = Column(Text, nullable=True)

    loyer_reference = Column(DECIMAL(10, 2), nullable=True)
    statut = Column(Enum(LotStatus, name="lot_status"), nullable=True)
    attachement = Column(String(255), nullable=True)

    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(
        DateTime,
        nullable=False,
        default=datetime.utcnow,
        onupdate=datetime.utcnow
    )
    deleted_at = Column(DateTime, nullable=True)

    # Relationships
    bien = relationship("Bien", back_populates="lots")
    categorie = relationship("Categorie", back_populates="lots")
    baux = relationship(
        "Bail",
        back_populates="lot",
        cascade="all, delete-orphan"
    )