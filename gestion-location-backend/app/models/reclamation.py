import enum
from datetime import datetime

from sqlalchemy import Column, DateTime, Enum, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from app.database import Base


class ReclamationStatus(int, enum.Enum):
    EN_ATTENTE = 1
    ACCEPTEE = 2
    REJETEE = 3


class Reclamation(Base):
    """Réclamation soumise par un propriétaire à l'administration. C'est le seul
    point d'entrée pour qu'un propriétaire contacte l'admin : tant qu'elle n'est
    pas acceptée, aucune messagerie libre n'est autorisée entre les deux (voir
    _is_legitimate_contact dans app/api/discussions.py)."""

    __tablename__ = "reclamations"

    id = Column(Integer, primary_key=True, index=True)
    proprietaire_id = Column(Integer, ForeignKey("utilisateurs.id"), nullable=False)
    sujet = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    statut = Column(
        Enum(ReclamationStatus, name="reclamation_status"), nullable=False, default=ReclamationStatus.EN_ATTENTE
    )
    date_creation = Column(DateTime, nullable=False, default=datetime.utcnow)
    date_traitement = Column(DateTime, nullable=True)
    traite_par_id = Column(Integer, ForeignKey("utilisateurs.id"), nullable=True)

    proprietaire = relationship("Utilisateur", foreign_keys=[proprietaire_id])
    traite_par = relationship("Utilisateur", foreign_keys=[traite_par_id])
