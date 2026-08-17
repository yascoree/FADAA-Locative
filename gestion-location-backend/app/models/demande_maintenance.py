import enum
from datetime import datetime

from sqlalchemy import Column, DateTime, Enum, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from app.database import Base


class DemandeMaintenanceStatus(int, enum.Enum):
    NOUVELLE = 1
    EN_COURS = 2
    RESOLUE = 3
    REJETEE = 4


class DemandeMaintenance(Base):
    """Signalement d'un problème par un locataire sur le bien/lot qu'il loue —
    traité par le propriétaire ou un gestionnaire mandaté sur ce bien."""

    __tablename__ = "demandes_maintenance"

    id = Column(Integer, primary_key=True, index=True)
    bail_id = Column(Integer, ForeignKey("baux.id"), nullable=False)
    locataire_id = Column(Integer, ForeignKey("utilisateurs.id"), nullable=False)
    titre = Column(String(150), nullable=False)
    description = Column(Text, nullable=False)
    statut = Column(
        Enum(DemandeMaintenanceStatus, name="demande_maintenance_status"),
        nullable=False,
        default=DemandeMaintenanceStatus.NOUVELLE,
        server_default="NOUVELLE",
    )
    reponse = Column(Text, nullable=True)
    traite_par_id = Column(Integer, ForeignKey("utilisateurs.id"), nullable=True)
    date_creation = Column(DateTime, nullable=False, default=datetime.utcnow)
    date_traitement = Column(DateTime, nullable=True)

    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)
    deleted_at = Column(DateTime, nullable=True)

    bail = relationship("Bail")
    locataire = relationship("Utilisateur", foreign_keys=[locataire_id])
    traite_par = relationship("Utilisateur", foreign_keys=[traite_par_id])
