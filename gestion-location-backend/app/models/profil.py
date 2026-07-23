from sqlalchemy import Column, Date, ForeignKey, Integer, String, Text, DateTime
from sqlalchemy.orm import relationship
from datetime import datetime

from app.database import Base


class Profil(Base):
    __tablename__ = "profils"

    id = Column(Integer, primary_key=True, index=True)
    utilisateur_id = Column(Integer, ForeignKey("utilisateurs.id"), unique=True, nullable=False)
    telephone = Column(String(20), nullable=True)
    adresse = Column(Text, nullable=True)
    photo = Column(String(255), nullable=True)
    date_naissance = Column(Date, nullable=True)
    piece_identite = Column(String(255), nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)
    deleted_at = Column(DateTime, nullable=True)

    # Relationships
    utilisateur = relationship("Utilisateur", back_populates="profil")
