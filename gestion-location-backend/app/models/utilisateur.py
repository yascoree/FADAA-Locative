import enum
from datetime import datetime

from sqlalchemy import Column, DateTime, Enum, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from app.database import Base


class UtilisateurRole(int, enum.Enum):
    ADMINISTRATEUR = 1
    PROPRIETAIRE = 2
    GESTIONNAIRE = 3
    LOCATAIRE = 4
    


class StatutCompte(int, enum.Enum):
    ACTIF = 1
    INVITE_EN_ATTENTE = 2
    CREE_SANS_ACCES = 3


class Utilisateur(Base):
    __tablename__ = "utilisateurs"

    id = Column(Integer, primary_key=True, index=True)
    nom = Column(String(100), nullable=False)
    prenom = Column(String(100), nullable=False)
    email = Column(String(255), unique=True, nullable=False, index=True)
    mot_de_passe = Column(String(255), nullable=False)
    role = Column(Enum(UtilisateurRole, name="utilisateur_role"), nullable=False)
    date_creation = Column(DateTime, nullable=False, default=datetime.utcnow)
    statut_compte = Column(
        Enum(StatutCompte, name="statut_compte"), nullable=False, default=StatutCompte.ACTIF
    )
    cree_par_id = Column(Integer, ForeignKey("utilisateurs.id"), nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)
    deleted_at = Column(DateTime, nullable=True)

    # Relationships
    profil = relationship(
        "Profil", back_populates="utilisateur", uselist=False, cascade="all, delete-orphan"
    )
    biens = relationship("Bien", back_populates="proprietaire", foreign_keys="Bien.proprietaire_id")
    baux = relationship("Bail", back_populates="locataire", foreign_keys="Bail.locataire_id")
    mandats_gestionnaire = relationship(
        "Mandat", back_populates="gestionnaire", foreign_keys="Mandat.gestionnaire_id"
    )
    mandats_proprietaire = relationship(
        "Mandat", back_populates="proprietaire", foreign_keys="Mandat.proprietaire_id"
    )
    discussions = relationship(
    "Discussion",
    foreign_keys="Discussion.user_id",
    back_populates="user"
)

    received_discussions = relationship(
        "Discussion",
        foreign_keys="Discussion.receiver_id",
        back_populates="receiver"
    )
    avis = relationship("Avis", back_populates="user")
    notifications = relationship("Notification", back_populates="user")
    cree_par = relationship("Utilisateur", remote_side=[id], back_populates="utilisateurs_crees")
    utilisateurs_crees = relationship("Utilisateur", back_populates="cree_par")

    paiements = relationship(
        "Paiement",
        back_populates="encaisseur",
        foreign_keys="Paiement.encaisse_par"
    )

    historiques = relationship(
        "Historique",
        back_populates="utilisateur"
    )
