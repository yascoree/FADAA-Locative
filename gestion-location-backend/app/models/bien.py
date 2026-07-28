import enum

from datetime import datetime

from sqlalchemy import Column, Enum, ForeignKey, Integer, String, DateTime, Text
from sqlalchemy.orm import relationship

from app.database import Base


class BienStatus(int, enum.Enum):
    """État du bien (immeuble/propriété) lui-même — indépendant de l'occupation,
    qui se gère au niveau du Lot (voir LotStatus) puisqu'un bien peut avoir
    plusieurs lots dans des états d'occupation différents."""

    ACTIF = 1
    EN_TRAVAUX = 2
    HORS_SERVICE = 3


class Bien(Base):
    __tablename__ = "biens"

    id = Column(Integer, primary_key=True, index=True)
    proprietaire_id = Column(Integer, ForeignKey("utilisateurs.id"), nullable=False)
    categorie_id = Column(Integer, ForeignKey("categories.id"), nullable=False)

    designation = Column(String(150), nullable=True)
    description = Column(Text, nullable=True)

    statut = Column(Enum(BienStatus, name="bien_status"), nullable=True)
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
    proprietaire = relationship(
        "Utilisateur",
        back_populates="biens",
        foreign_keys=[proprietaire_id]
    )
    categorie = relationship("Categorie", back_populates="biens")
    lots = relationship(
        "Lot",
        back_populates="bien",
        cascade="all, delete-orphan"
    )
    photos = relationship(
        "BienPhoto",
        back_populates="bien",
        cascade="all, delete-orphan",
        order_by="BienPhoto.date_ajout"
    )