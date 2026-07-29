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
    INACTIF = 2
    ARCHIVE = 3


class TypeBien(int, enum.Enum):
    """Catégorie générale de l'actif loué. Détermine quelles Categorie (voir
    Categorie.type_bien) sont proposées comme sous-catégorie sur les Lots de
    ce bien — ex. un bien VEHICULE ne propose que des sous-catégories Voiture/
    Moto/... à ses lots, jamais Appartement/Villa/..."""

    IMMOBILIER = 1
    VEHICULE = 2
    MATERIEL = 3
    AUTRE = 4


class Bien(Base):
    __tablename__ = "biens"

    id = Column(Integer, primary_key=True, index=True)
    proprietaire_id = Column(Integer, ForeignKey("utilisateurs.id"), nullable=False)
    type = Column(Enum(TypeBien, name="type_bien"), nullable=False)

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