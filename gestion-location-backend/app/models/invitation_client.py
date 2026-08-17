import enum
from datetime import datetime

from sqlalchemy import Column, DateTime, Enum, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from app.database import Base


class InvitationClientStatus(int, enum.Enum):
    EN_ATTENTE = 1
    ACCEPTEE = 2
    REFUSEE = 3
    EXPIREE = 4


class InvitationClient(Base):
    """Une agence propose à un propriétaire de devenir son client. Volontairement
    séparée du Mandat (voir app.models.mandat) : accepter une invitation crée la
    relation de confiance, mais ne configure rien — c'est ensuite le propriétaire
    qui crée lui-même le Mandat (portée, permissions) via le flux "agence
    existante" déjà en place, exactement comme s'il l'avait choisie spontanément.
    Une invitation ne contient donc aucune portée/permission proposée."""

    __tablename__ = "invitations_client"

    id = Column(Integer, primary_key=True, index=True)
    agence_id = Column(Integer, ForeignKey("agences.id", ondelete="CASCADE"), nullable=False, index=True)
    # Toujours résolu à la création (compte existant réutilisé, ou nouveau compte
    # PROPRIETAIRE créé en INVITE_EN_ATTENTE — voir invitation_client_service) :
    # jamais nul, jamais "en attente d'inscription" côté propriétaire.
    proprietaire_id = Column(Integer, ForeignKey("utilisateurs.id", ondelete="CASCADE"), nullable=False, index=True)
    # Copie de l'email au moment de l'invitation — reste lisible même si le compte
    # change d'adresse plus tard, sans jointure supplémentaire pour l'afficher.
    email = Column(String(255), nullable=False)
    statut = Column(Enum(InvitationClientStatus, name="invitation_client_status"), nullable=False, default=InvitationClientStatus.EN_ATTENTE)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)
    responded_at = Column(DateTime, nullable=True)

    agence = relationship("Agence")
    proprietaire = relationship("Utilisateur")
